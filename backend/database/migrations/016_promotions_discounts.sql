BEGIN;

-- Diskon produk, voucher marketplace/seller, dan snapshot harga checkout.

CREATE TABLE IF NOT EXISTS public.product_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  discount_type VARCHAR NOT NULL,
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_discounts
  DROP CONSTRAINT IF EXISTS product_discounts_discount_type_check,
  DROP CONSTRAINT IF EXISTS product_discounts_time_check;

ALTER TABLE public.product_discounts
  ADD CONSTRAINT product_discounts_discount_type_check
    CHECK (discount_type IN ('percentage', 'fixed_amount')),
  ADD CONSTRAINT product_discounts_time_check
    CHECK (end_time > start_time);

CREATE INDEX IF NOT EXISTS idx_product_discounts_active
  ON public.product_discounts(product_id, is_active, start_time, end_time);

CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.users(id),
  code VARCHAR NOT NULL UNIQUE,
  discount_type VARCHAR NOT NULL,
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_purchase INTEGER NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
  max_discount INTEGER CHECK (max_discount > 0),
  quota INTEGER NOT NULL CHECK (quota > 0),
  used_count INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category VARCHAR
);

ALTER TABLE public.vouchers
  DROP CONSTRAINT IF EXISTS vouchers_discount_type_check,
  DROP CONSTRAINT IF EXISTS vouchers_free_fee_marketplace_only_check,
  DROP CONSTRAINT IF EXISTS vouchers_time_check,
  DROP CONSTRAINT IF EXISTS vouchers_used_count_check;

ALTER TABLE public.vouchers
  ADD CONSTRAINT vouchers_discount_type_check
    CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_marketplace_fee')),
  ADD CONSTRAINT vouchers_free_fee_marketplace_only_check
    CHECK (discount_type <> 'free_marketplace_fee' OR seller_id IS NULL),
  ADD CONSTRAINT vouchers_time_check
    CHECK (end_time > start_time),
  ADD CONSTRAINT vouchers_used_count_check
    CHECK (used_count >= 0 AND used_count <= quota);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(upper(code));
CREATE INDEX IF NOT EXISTS idx_vouchers_seller ON public.vouchers(seller_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_category ON public.vouchers(category);
CREATE INDEX IF NOT EXISTS idx_vouchers_active_period
  ON public.vouchers(is_active, start_time, end_time);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.vouchers(id),
  ADD COLUMN IF NOT EXISTS voucher_discount INTEGER NOT NULL DEFAULT 0 CHECK (voucher_discount >= 0),
  ADD COLUMN IF NOT EXISTS fee_marketplace_base INTEGER NOT NULL DEFAULT 0 CHECK (fee_marketplace_base >= 0),
  ADD COLUMN IF NOT EXISTS fee_discount INTEGER NOT NULL DEFAULT 0 CHECK (fee_discount >= 0),
  ADD COLUMN IF NOT EXISTS voucher_discount_total INTEGER NOT NULL DEFAULT 0 CHECK (voucher_discount_total >= 0),
  ADD COLUMN IF NOT EXISTS discount_total INTEGER NOT NULL DEFAULT 0 CHECK (discount_total >= 0);

UPDATE public.orders
SET fee_marketplace_base = fee_marketplace
WHERE fee_marketplace_base = 0 AND fee_marketplace > 0;

UPDATE public.orders
SET voucher_discount_total = voucher_discount,
    discount_total = voucher_discount
WHERE voucher_discount > 0 AND voucher_discount_total = 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS original_price_at_purchase INTEGER CHECK (original_price_at_purchase > 0),
  ADD COLUMN IF NOT EXISTS product_discount_per_unit INTEGER NOT NULL DEFAULT 0 CHECK (product_discount_per_unit >= 0),
  ADD COLUMN IF NOT EXISTS product_discount_id UUID REFERENCES public.product_discounts(id);

UPDATE public.order_items
SET original_price_at_purchase = price_at_purchase
WHERE original_price_at_purchase IS NULL;

CREATE TABLE IF NOT EXISTS public.order_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id),
  voucher_code VARCHAR NOT NULL,
  scope VARCHAR NOT NULL CHECK (scope IN ('marketplace', 'seller')),
  seller_id UUID REFERENCES public.users(id),
  discount_type VARCHAR NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'free_marketplace_fee')),
  discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  eligible_subtotal INTEGER NOT NULL DEFAULT 0 CHECK (eligible_subtotal >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_vouchers_order ON public.order_vouchers(order_id);
CREATE INDEX IF NOT EXISTS idx_order_vouchers_voucher ON public.order_vouchers(voucher_id);

CREATE TABLE IF NOT EXISTS public.user_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id),
  order_id UUID REFERENCES public.orders(id),
  used_at TIMESTAMPTZ,
  status VARCHAR NOT NULL DEFAULT 'used',
  reserved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  idempotency_key UUID
);

ALTER TABLE public.user_vouchers
  ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'used',
  ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key UUID;

ALTER TABLE public.user_vouchers
  DROP CONSTRAINT IF EXISTS user_vouchers_status_check;

ALTER TABLE public.user_vouchers
  ADD CONSTRAINT user_vouchers_status_check
    CHECK (status IN ('reserved', 'used', 'released'));

UPDATE public.user_vouchers
SET status = CASE
  WHEN released_at IS NOT NULL THEN 'released'
  WHEN used_at IS NOT NULL THEN 'used'
  ELSE status
END;

CREATE INDEX IF NOT EXISTS idx_user_vouchers_user ON public.user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_voucher ON public.user_vouchers(voucher_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_order ON public.user_vouchers(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vouchers_idempotency_active
  ON public.user_vouchers(user_id, voucher_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('reserved', 'used');

CREATE OR REPLACE FUNCTION public.release_checkout_promotions(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released BOOLEAN := FALSE;
  v_usage RECORD;
BEGIN
  BEGIN
    SELECT public.release_checkout_stock(p_order_id) INTO v_released;
  EXCEPTION WHEN undefined_function THEN
    v_released := FALSE;
  END;

  FOR v_usage IN
    SELECT id, voucher_id
    FROM public.user_vouchers
    WHERE order_id = p_order_id
      AND status = 'reserved'
    FOR UPDATE
  LOOP
    UPDATE public.user_vouchers
    SET status = 'released',
        released_at = now()
    WHERE id = v_usage.id;

    UPDATE public.vouchers
    SET used_count = GREATEST(used_count - 1, 0),
        updated_at = now()
    WHERE id = v_usage.voucher_id;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- Promo-aware checkout RPC. Backend may still compute quotes in application code,
-- but this RPC keeps database-side checkout available for atomic deployments.
CREATE OR REPLACE FUNCTION public.create_checkout_order_v2(
  p_buyer_id UUID,
  p_idempotency_key UUID,
  p_shipping_address TEXT,
  p_items JSONB,
  p_marketplace_voucher_code TEXT DEFAULT NULL,
  p_seller_voucher_codes TEXT[] DEFAULT ARRAY[]::TEXT[]
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
  v_best_discount public.product_discounts%ROWTYPE;
  v_discount_per_unit INTEGER;
  v_effective_price INTEGER;
  v_subtotal_original INTEGER := 0;
  v_product_discount_total INTEGER := 0;
  v_subtotal_after_discount INTEGER := 0;
  v_fee_base INTEGER := 0;
  v_fee_discount INTEGER := 0;
  v_fee INTEGER := 0;
  v_voucher_discount_total INTEGER := 0;
  v_discount_total INTEGER := 0;
  v_total INTEGER := 0;
  v_items_snapshot JSONB := '[]'::JSONB;
  v_order_vouchers JSONB := '[]'::JSONB;
  v_voucher public.vouchers%ROWTYPE;
  v_code TEXT;
  v_eligible_subtotal INTEGER;
  v_discount_amount INTEGER;
  v_seen_sellers UUID[] := ARRAY[]::UUID[];
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
    SELECT COUNT(*) FROM jsonb_array_elements(p_items)
  ) <> (
    SELECT COUNT(DISTINCT value->>'product_id') FROM jsonb_array_elements(p_items)
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PRODUCTS';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_buyer_id::TEXT || ':' || p_idempotency_key::TEXT, 0));

  SELECT * INTO v_existing
  FROM public.orders
  WHERE buyer_id = p_buyer_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('created', FALSE, 'order', to_jsonb(v_existing));
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'product_id'
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'qty')::INTEGER;
    IF v_qty < 1 OR v_qty > 100 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY:%', v_product_id;
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id
    FOR UPDATE;
    IF NOT FOUND OR NOT v_product.is_active THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND:%', v_product_id;
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%:%:%', v_product.name, v_product.stock, v_qty;
    END IF;

    SELECT * INTO v_best_discount
    FROM public.product_discounts
    WHERE product_id = v_product.id
      AND is_active = TRUE
      AND start_time <= now()
      AND end_time > now()
    ORDER BY
      CASE
        WHEN discount_type = 'percentage' THEN LEAST(v_product.price, round(v_product.price * discount_value / 100.0)::INTEGER)
        ELSE LEAST(v_product.price, discount_value)
      END DESC,
      created_at DESC
    LIMIT 1;

    IF FOUND THEN
      IF v_best_discount.discount_type = 'percentage' THEN
        v_discount_per_unit := LEAST(v_product.price, round(v_product.price * v_best_discount.discount_value / 100.0)::INTEGER);
      ELSE
        v_discount_per_unit := LEAST(v_product.price, v_best_discount.discount_value);
      END IF;
    ELSE
      v_discount_per_unit := 0;
    END IF;

    v_effective_price := GREATEST(v_product.price - v_discount_per_unit, 0);
    v_subtotal_original := v_subtotal_original + (v_product.price * v_qty);
    v_product_discount_total := v_product_discount_total + (v_discount_per_unit * v_qty);
    v_subtotal_after_discount := v_subtotal_after_discount + (v_effective_price * v_qty);
    v_items_snapshot := v_items_snapshot || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'seller_id', v_product.seller_id,
      'category', v_product.category,
      'name', v_product.name,
      'qty', v_qty,
      'original_price', v_product.price,
      'effective_price', v_effective_price,
      'discount_per_unit', v_discount_per_unit,
      'discount_id', CASE WHEN v_discount_per_unit > 0 THEN v_best_discount.id ELSE NULL END,
      'effective_subtotal', v_effective_price * v_qty
    ));
  END LOOP;

  v_fee_base := round(v_subtotal_after_discount * 0.02);
  v_fee := v_fee_base;

  IF p_marketplace_voucher_code IS NOT NULL AND length(trim(p_marketplace_voucher_code)) > 0 THEN
    SELECT * INTO v_voucher
    FROM public.vouchers
    WHERE upper(code) = upper(trim(p_marketplace_voucher_code))
      AND seller_id IS NULL
    FOR UPDATE;

    IF FOUND AND v_voucher.is_active AND v_voucher.start_time <= now() AND v_voucher.end_time > now() AND v_voucher.used_count < v_voucher.quota THEN
      SELECT COALESCE(SUM((value->>'effective_subtotal')::INTEGER), 0) INTO v_eligible_subtotal
      FROM jsonb_array_elements(v_items_snapshot)
      WHERE v_voucher.category IS NULL OR value->>'category' = v_voucher.category;

      IF v_eligible_subtotal >= v_voucher.min_purchase THEN
        IF v_voucher.discount_type = 'free_marketplace_fee' THEN
          v_discount_amount := v_fee_base;
          v_fee_discount := v_fee_base;
        ELSIF v_voucher.discount_type = 'percentage' THEN
          v_discount_amount := round(v_eligible_subtotal * v_voucher.discount_value / 100.0)::INTEGER;
        ELSE
          v_discount_amount := v_voucher.discount_value;
        END IF;
        IF v_voucher.max_discount IS NOT NULL THEN
          v_discount_amount := LEAST(v_discount_amount, v_voucher.max_discount);
        END IF;
        v_discount_amount := LEAST(v_discount_amount, CASE WHEN v_voucher.discount_type = 'free_marketplace_fee' THEN v_fee_base ELSE v_eligible_subtotal END);
        v_voucher_discount_total := v_voucher_discount_total + CASE WHEN v_voucher.discount_type = 'free_marketplace_fee' THEN 0 ELSE v_discount_amount END;
        v_order_vouchers := v_order_vouchers || jsonb_build_array(jsonb_build_object(
          'voucher_id', v_voucher.id,
          'voucher_code', v_voucher.code,
          'scope', 'marketplace',
          'seller_id', NULL,
          'discount_type', v_voucher.discount_type,
          'discount_amount', v_discount_amount,
          'eligible_subtotal', v_eligible_subtotal
        ));
      END IF;
    END IF;
  END IF;

  FOREACH v_code IN ARRAY COALESCE(p_seller_voucher_codes, ARRAY[]::TEXT[])
  LOOP
    IF v_code IS NULL OR length(trim(v_code)) = 0 THEN
      CONTINUE;
    END IF;
    SELECT * INTO v_voucher
    FROM public.vouchers
    WHERE upper(code) = upper(trim(v_code))
      AND seller_id IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND OR v_voucher.seller_id = ANY(v_seen_sellers) THEN
      CONTINUE;
    END IF;

    IF v_voucher.is_active AND v_voucher.start_time <= now() AND v_voucher.end_time > now() AND v_voucher.used_count < v_voucher.quota THEN
      SELECT COALESCE(SUM((value->>'effective_subtotal')::INTEGER), 0) INTO v_eligible_subtotal
      FROM jsonb_array_elements(v_items_snapshot)
      WHERE (value->>'seller_id')::UUID = v_voucher.seller_id
        AND (v_voucher.category IS NULL OR value->>'category' = v_voucher.category);

      IF v_eligible_subtotal >= v_voucher.min_purchase AND v_eligible_subtotal > 0 THEN
        IF v_voucher.discount_type = 'percentage' THEN
          v_discount_amount := round(v_eligible_subtotal * v_voucher.discount_value / 100.0)::INTEGER;
        ELSE
          v_discount_amount := v_voucher.discount_value;
        END IF;
        IF v_voucher.max_discount IS NOT NULL THEN
          v_discount_amount := LEAST(v_discount_amount, v_voucher.max_discount);
        END IF;
        v_discount_amount := LEAST(v_discount_amount, v_eligible_subtotal);
        v_voucher_discount_total := v_voucher_discount_total + v_discount_amount;
        v_seen_sellers := array_append(v_seen_sellers, v_voucher.seller_id);
        v_order_vouchers := v_order_vouchers || jsonb_build_array(jsonb_build_object(
          'voucher_id', v_voucher.id,
          'voucher_code', v_voucher.code,
          'scope', 'seller',
          'seller_id', v_voucher.seller_id,
          'discount_type', v_voucher.discount_type,
          'discount_amount', v_discount_amount,
          'eligible_subtotal', v_eligible_subtotal
        ));
      END IF;
    END IF;
  END LOOP;

  v_fee_discount := LEAST(v_fee_discount, v_fee_base);
  v_fee := GREATEST(v_fee_base - v_fee_discount, 0);
  v_discount_total := v_product_discount_total + v_voucher_discount_total + v_fee_discount;
  v_total := GREATEST(v_subtotal_after_discount - v_voucher_discount_total + v_fee, 0);
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL';
  END IF;

  INSERT INTO public.orders (
    buyer_id, status, subtotal, fee_marketplace, total, shipping_address,
    idempotency_key, stock_reserved, fee_marketplace_base, fee_discount,
    voucher_discount, voucher_discount_total, discount_total
  )
  VALUES (
    p_buyer_id, 'pending', v_subtotal_after_discount, v_fee, v_total,
    trim(p_shipping_address), p_idempotency_key, TRUE, v_fee_base, v_fee_discount,
    v_voucher_discount_total, v_voucher_discount_total, v_discount_total
  )
  RETURNING * INTO v_order;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items_snapshot)
  LOOP
    INSERT INTO public.order_items (
      order_id, product_id, qty, price_at_purchase, product_name_at_purchase,
      original_price_at_purchase, product_discount_per_unit, product_discount_id
    )
    VALUES (
      v_order.id,
      (v_item->>'product_id')::UUID,
      (v_item->>'qty')::INTEGER,
      (v_item->>'effective_price')::INTEGER,
      v_item->>'name',
      (v_item->>'original_price')::INTEGER,
      (v_item->>'discount_per_unit')::INTEGER,
      NULLIF(v_item->>'discount_id', '')::UUID
    );

    UPDATE public.products
    SET stock = stock - (v_item->>'qty')::INTEGER,
        is_active = CASE WHEN stock - (v_item->>'qty')::INTEGER <= 0 THEN FALSE ELSE is_active END
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_order_vouchers)
  LOOP
    INSERT INTO public.order_vouchers (
      order_id, voucher_id, voucher_code, scope, seller_id, discount_type, discount_amount, eligible_subtotal
    )
    VALUES (
      v_order.id,
      (v_item->>'voucher_id')::UUID,
      v_item->>'voucher_code',
      v_item->>'scope',
      NULLIF(v_item->>'seller_id', '')::UUID,
      v_item->>'discount_type',
      (v_item->>'discount_amount')::INTEGER,
      (v_item->>'eligible_subtotal')::INTEGER
    );

    INSERT INTO public.user_vouchers (
      user_id, voucher_id, order_id, status, reserved_at, idempotency_key
    )
    VALUES (
      p_buyer_id,
      (v_item->>'voucher_id')::UUID,
      v_order.id,
      'reserved',
      now(),
      p_idempotency_key
    );

    UPDATE public.vouchers
    SET used_count = used_count + 1,
        updated_at = now()
    WHERE id = (v_item->>'voucher_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('created', TRUE, 'order', to_jsonb(v_order), 'items', v_items_snapshot, 'vouchers', v_order_vouchers);
END;
$$;

REVOKE ALL ON FUNCTION public.create_checkout_order_v2(UUID, UUID, TEXT, JSONB, TEXT, TEXT[])
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_checkout_promotions(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order_v2(UUID, UUID, TEXT, JSONB, TEXT, TEXT[])
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_promotions(UUID)
  TO service_role;

COMMIT;
