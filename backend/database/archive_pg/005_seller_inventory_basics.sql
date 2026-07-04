BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS minimum_stock INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_low_stock BOOLEAN
  GENERATED ALWAYS AS (stock > 0 AND stock <= minimum_stock) STORED;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_minimum_stock_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_minimum_stock_check
      CHECK (minimum_stock >= 0);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_seller_stock
  ON public.products(seller_id, is_low_stock, stock);

COMMIT;
