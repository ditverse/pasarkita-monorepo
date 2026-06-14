BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE INDEX IF NOT EXISTS idx_products_seller
  ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON public.products(is_active, category);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product
  ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_product
  ON public.ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_ratings_buyer
  ON public.ratings(buyer_id);

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

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_bypass_users" ON public.users;
DROP POLICY IF EXISTS "service_role_bypass_products" ON public.products;
DROP POLICY IF EXISTS "service_role_bypass_orders" ON public.orders;
DROP POLICY IF EXISTS "service_role_bypass_order_items" ON public.order_items;
DROP POLICY IF EXISTS "service_role_bypass_ratings" ON public.ratings;

COMMIT;
