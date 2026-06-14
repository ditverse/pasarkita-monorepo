BEGIN;

-- Checkout idempotent, reservasi stok atomik, dan snapshot nama produk.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_buyer_idempotency
  ON public.orders(buyer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name_at_purchase TEXT;

UPDATE public.order_items AS item
SET product_name_at_purchase = product.name
FROM public.products AS product
WHERE item.product_id = product.id
  AND item.product_name_at_purchase IS NULL;

CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_buyer_id UUID,
  p_idempotency_key UUID,
  p_shipping_address TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_product_id UUID;
  v_qty INTEGER;
  v_subtotal INTEGER := 0;
  v_fee INTEGER;
BEGIN
  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF p_shipping_address IS NULL OR length(trim(p_shipping_address)) < 10 THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_ADDRESS';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ITEMS_REQUIRED';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_items)
  ) <> (
    SELECT COUNT(DISTINCT value->>'product_id')
    FROM jsonb_array_elements(p_items)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PRODUCTS';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_buyer_id::TEXT || ':' || p_idempotency_key::TEXT, 0)
  );

  SELECT *
  INTO v_existing
  FROM public.orders
  WHERE buyer_id = p_buyer_id
    AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object('created', FALSE, 'order', to_jsonb(v_existing));
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
    ORDER BY value->>'product_id'
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;

    IF v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY:%', v_product_id;
    END IF;

    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;

    IF NOT FOUND OR NOT v_product.is_active THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_product_id;
    END IF;

    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%:%:%',
        v_product.name, v_product.stock, v_qty;
    END IF;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  END LOOP;

  v_fee := round(v_subtotal * 0.02);

  INSERT INTO public.orders (
    buyer_id,
    status,
    subtotal,
    fee_marketplace,
    total,
    shipping_address,
    idempotency_key,
    stock_reserved
  )
  VALUES (
    p_buyer_id,
    'pending',
    v_subtotal,
    v_fee,
    v_subtotal + v_fee,
    trim(p_shipping_address),
    p_idempotency_key,
    TRUE
  )
  RETURNING * INTO v_order;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
    ORDER BY value->>'product_id'
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;

    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_product_id;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      qty,
      price_at_purchase,
      product_name_at_purchase
    )
    VALUES (
      v_order.id,
      v_product_id,
      v_qty,
      v_product.price,
      v_product.name
    );

    UPDATE public.products
    SET
      stock = stock - v_qty,
      is_active = CASE WHEN stock - v_qty <= 0 THEN FALSE ELSE is_active END
    WHERE id = v_product_id;
  END LOOP;

  RETURN jsonb_build_object('created', TRUE, 'order', to_jsonb(v_order));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_checkout_stock(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item RECORD;
BEGIN
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_order.stock_reserved THEN
    RETURN FALSE;
  END IF;

  FOR v_item IN
    SELECT product_id, qty
    FROM public.order_items
    WHERE order_id = p_order_id
  LOOP
    UPDATE public.products
    SET stock = stock + v_item.qty, is_active = TRUE
    WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.orders
  SET stock_reserved = FALSE
  WHERE id = p_order_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order(UUID, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_checkout_stock(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID, UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_stock(UUID)
  TO service_role;

COMMIT;
