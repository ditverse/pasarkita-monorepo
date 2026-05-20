-- ============================================================
-- PasarKita — Database Schema
-- Jalankan di SQL Editor Supabase dashboard
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tabel orders ─────────────────────────────────────────────
-- Field name sesuai PRD: subtotal, fee_marketplace, total
-- (bukan total_amount / app_fee / shipping_fee seperti versi lama)

CREATE TABLE IF NOT EXISTS public.orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    seller_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'payment_failed')),
    subtotal         INTEGER NOT NULL CHECK (subtotal > 0),
    fee_marketplace  INTEGER NOT NULL DEFAULT 0,
    total            INTEGER NOT NULL CHECK (total > 0),
    shipping_address TEXT NOT NULL,
    transaction_id   VARCHAR(100),
    tracking_id      VARCHAR(100),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_orders" ON public.orders FOR ALL USING (true);

-- ── Tabel order_items ─────────────────────────────────────────
-- Field name sesuai PRD: qty, price_at_purchase
-- (bukan quantity / price_at_time seperti versi lama)

CREATE TABLE IF NOT EXISTS public.order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    qty               INTEGER NOT NULL CHECK (qty > 0),
    price_at_purchase INTEGER NOT NULL CHECK (price_at_purchase > 0),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_order_items" ON public.order_items FOR ALL USING (true);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id     ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id    ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON public.orders(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ── Trigger: auto-update updated_at ──────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Stored procedure: increment stok (rollback payment gagal) ─

CREATE OR REPLACE FUNCTION increment_stock(product_id UUID, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products SET stock = stock + amount WHERE id = product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CATATAN MIGRASI dari schema lama:
-- Jika tabel orders sudah ada dengan kolom lama, jalankan:
--
--   ALTER TABLE public.orders
--     RENAME COLUMN total_amount TO total;
--   ALTER TABLE public.orders
--     RENAME COLUMN app_fee TO fee_marketplace;
--   ALTER TABLE public.orders
--     DROP COLUMN IF EXISTS shipping_fee;
--   ALTER TABLE public.orders
--     ADD COLUMN IF NOT EXISTS subtotal INTEGER;
--   ALTER TABLE public.orders
--     ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
--   ALTER TABLE public.orders
--     ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(100);
--   ALTER TABLE public.orders
--     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
--
--   ALTER TABLE public.order_items
--     RENAME COLUMN quantity TO qty;
--   ALTER TABLE public.order_items
--     RENAME COLUMN price_at_time TO price_at_purchase;
-- ============================================================

-- ── Tabel ratings ─────────────────────────────────────────────
-- Jalankan di SQL Editor Supabase

CREATE TABLE IF NOT EXISTS public.ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Satu order hanya bisa rating satu produk satu kali
  CONSTRAINT ratings_order_product_unique UNIQUE (order_id, product_id)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_bypass_ratings" ON public.ratings FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_ratings_product_id ON public.ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_buyer_id   ON public.ratings(buyer_id);
