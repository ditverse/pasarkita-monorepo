BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR NOT NULL CHECK (role IN ('buyer', 'seller', 'superadmin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  minimum_stock INTEGER NOT NULL DEFAULT 5 CHECK (minimum_stock >= 0),
  is_low_stock BOOLEAN GENERATED ALWAYS AS
    (stock > 0 AND stock <= minimum_stock) STORED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS public.seller_profiles (
  seller_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  store_name VARCHAR(120) NOT NULL,
  logo_url TEXT,
  description TEXT,
  pickup_address TEXT,
  contact_phone VARCHAR(30),
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  processing_days INTEGER NOT NULL DEFAULT 2 CHECK (processing_days BETWEEN 1 AND 30),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'demo_verified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status VARCHAR NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed')),
  subtotal INTEGER NOT NULL CHECK (subtotal > 0),
  fee_marketplace INTEGER NOT NULL DEFAULT 0 CHECK (fee_marketplace >= 0),
  total INTEGER NOT NULL CHECK (total > 0),
  shipping_address TEXT NOT NULL,
  transaction_id VARCHAR,
  tracking_id VARCHAR,
  processing_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  pickup_address_snapshot TEXT,
  shipping_sync_status VARCHAR(20) NOT NULL DEFAULT 'not_requested'
    CHECK (shipping_sync_status IN ('not_requested', 'pending', 'synced', 'failed')),
  shipping_sync_error TEXT,
  shipping_sync_updated_at TIMESTAMPTZ,
  idempotency_key UUID,
  stock_reserved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty INTEGER NOT NULL CHECK (qty > 0),
  price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase > 0),
  product_name_at_purchase TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ratings_order_product_unique UNIQUE (order_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  reason TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status_code INTEGER,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed')),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('order', 'payment', 'shipped', 'rating', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_seller
  ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON public.products(is_active, category);
CREATE INDEX IF NOT EXISTS idx_products_seller_stock
  ON public.products(seller_id, is_low_stock, stock);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_fulfillment
  ON public.orders(status, processing_at, shipped_at);
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_buyer_idempotency
  ON public.orders(buyer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_product
  ON public.ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_buyer
  ON public.ratings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created
  ON public.integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_service_created
  ON public.integration_logs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_order
  ON public.integration_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
  ON public.order_status_history(order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS seller_profiles_set_updated_at ON public.seller_profiles;
CREATE TRIGGER seller_profiles_set_updated_at
BEFORE UPDATE ON public.seller_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.set_order_fulfillment_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'processing' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.processing_at = COALESCE(NEW.processing_at, NOW());
  END IF;
  IF NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.shipped_at = COALESCE(NEW.shipped_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_set_fulfillment_timestamps ON public.orders;
CREATE TRIGGER orders_set_fulfillment_timestamps
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_order_fulfillment_timestamps();

CREATE OR REPLACE FUNCTION public.record_order_status_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.order_status_history (order_id, status, source, note, created_at)
  VALUES (
    NEW.id,
    NEW.status,
    CASE WHEN TG_OP = 'INSERT' THEN 'checkout' ELSE 'order_update' END,
    CASE NEW.status
      WHEN 'pending' THEN 'Order dibuat dan menunggu hasil pembayaran.'
      WHEN 'paid' THEN 'Pembayaran berhasil dikonfirmasi.'
      WHEN 'processing' THEN 'Penjual mulai menyiapkan pesanan.'
      WHEN 'payment_failed' THEN 'Pembayaran gagal dikonfirmasi.'
      WHEN 'shipped' THEN 'Pesanan telah diserahkan untuk pengiriman.'
      WHEN 'delivered' THEN 'Pesanan telah dikonfirmasi diterima.'
    END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.created_at ELSE NOW() END
  );

  IF NEW.status = 'pending' THEN RETURN NEW; END IF;

  SELECT
    CASE NEW.status WHEN 'paid' THEN 'payment' WHEN 'payment_failed' THEN 'payment'
      WHEN 'shipped' THEN 'shipped' WHEN 'delivered' THEN 'rating' ELSE 'order' END,
    CASE NEW.status WHEN 'paid' THEN 'Pembayaran berhasil'
      WHEN 'processing' THEN 'Pesanan sedang disiapkan'
      WHEN 'payment_failed' THEN 'Pembayaran gagal'
      WHEN 'shipped' THEN 'Pesanan sedang dikirim'
      WHEN 'delivered' THEN 'Pesanan telah selesai'
      ELSE 'Status pesanan diperbarui' END,
    CASE NEW.status WHEN 'paid' THEN 'Pembayaran pesanan berhasil dikonfirmasi oleh SmartBank.'
      WHEN 'processing' THEN 'Penjual sedang menyiapkan dan mengemas pesanan Anda.'
      WHEN 'payment_failed' THEN 'Pembayaran pesanan belum berhasil. Buka detail pesanan untuk informasi lebih lanjut.'
      WHEN 'shipped' THEN 'Penjual telah menyerahkan pesanan Anda untuk dikirim.'
      WHEN 'delivered' THEN 'Pesanan selesai. Anda dapat memberikan ulasan untuk produk.'
      ELSE 'Status pesanan Anda telah diperbarui.' END
  INTO v_type, v_title, v_message;

  INSERT INTO public.notifications (user_id, order_id, type, title, message, href)
  VALUES (NEW.buyer_id, NEW.id, v_type, v_title, v_message, '/orders/' || NEW.id::TEXT);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_record_status_event ON public.orders;
CREATE TRIGGER orders_record_status_event
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_status_event();

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
    SELECT COUNT(*) FROM jsonb_array_elements(p_items)
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

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON FUNCTION public.create_checkout_order(UUID, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_checkout_stock(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order(UUID, UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_stock(UUID)
  TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-assets',
  'store-assets',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
