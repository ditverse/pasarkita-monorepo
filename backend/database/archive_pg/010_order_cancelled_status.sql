BEGIN;

-- Drop and recreate the check constraint for orders status
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed', 'cancelled'));

-- Drop and recreate the check constraint for order_status_history status
ALTER TABLE public.order_status_history DROP CONSTRAINT order_status_history_status_check;
ALTER TABLE public.order_status_history ADD CONSTRAINT order_status_history_status_check 
  CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'payment_failed', 'cancelled'));

-- Update the notification trigger to handle cancelled
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
      WHEN 'cancelled' THEN 'Pesanan telah dibatalkan.'
    END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.created_at ELSE NOW() END
  );

  IF NEW.status = 'pending' THEN RETURN NEW; END IF;

  SELECT
    CASE NEW.status WHEN 'paid' THEN 'payment' WHEN 'payment_failed' THEN 'payment'
      WHEN 'shipped' THEN 'shipped' WHEN 'delivered' THEN 'rating' WHEN 'cancelled' THEN 'order' ELSE 'order' END,
    CASE NEW.status WHEN 'paid' THEN 'Pembayaran berhasil'
      WHEN 'processing' THEN 'Pesanan sedang disiapkan'
      WHEN 'payment_failed' THEN 'Pembayaran gagal'
      WHEN 'shipped' THEN 'Pesanan sedang dikirim'
      WHEN 'delivered' THEN 'Pesanan selesai'
      WHEN 'cancelled' THEN 'Pesanan dibatalkan'
      ELSE 'Status pesanan diperbarui' END,
    CASE NEW.status WHEN 'paid' THEN 'Pembayaran pesanan berhasil dikonfirmasi oleh SmartBank.'
      WHEN 'processing' THEN 'Penjual sedang menyiapkan dan mengemas pesanan Anda.'
      WHEN 'payment_failed' THEN 'Pembayaran pesanan belum berhasil. Buka detail pesanan untuk informasi lebih lanjut.'
      WHEN 'shipped' THEN 'Penjual telah menyerahkan pesanan Anda untuk dikirim.'
      WHEN 'delivered' THEN 'Pesanan selesai. Anda dapat memberikan ulasan untuk produk.'
      WHEN 'cancelled' THEN 'Pesanan telah dibatalkan sebelum dibayar.'
      ELSE 'Status pesanan Anda telah diperbarui.' END
  INTO v_type, v_title, v_message;

  INSERT INTO public.notifications (user_id, order_id, type, title, message, href)
  VALUES (NEW.buyer_id, NEW.id, v_type, v_title, v_message, '/orders/' || NEW.id::TEXT);
  RETURN NEW;
END;
$$;

COMMIT;
