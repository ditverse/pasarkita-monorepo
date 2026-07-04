BEGIN;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed'));

ALTER TABLE public.order_status_history
  DROP CONSTRAINT IF EXISTS order_status_history_status_check;
ALTER TABLE public.order_status_history
  ADD CONSTRAINT order_status_history_status_check
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed'));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_address_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS shipping_sync_status VARCHAR(20) NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS shipping_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS shipping_sync_updated_at TIMESTAMPTZ;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_sync_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_sync_status_check
  CHECK (shipping_sync_status IN ('not_requested', 'pending', 'synced', 'failed'));

UPDATE public.orders
SET
  shipping_sync_status = 'synced',
  shipping_sync_updated_at = COALESCE(updated_at, created_at)
WHERE tracking_id IS NOT NULL
  AND shipping_sync_status = 'not_requested';

UPDATE public.orders
SET shipped_at = COALESCE(updated_at, created_at)
WHERE status IN ('shipped', 'delivered')
  AND shipped_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_seller_fulfillment
  ON public.orders(status, processing_at, shipped_at);

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

COMMIT;
