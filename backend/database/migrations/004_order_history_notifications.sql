BEGIN;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL
    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'payment_failed')),
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'system',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
  ON public.order_status_history(order_id, created_at);

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

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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

  INSERT INTO public.order_status_history (
    order_id,
    status,
    source,
    note,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.status,
    CASE
      WHEN TG_OP = 'INSERT' THEN 'checkout'
      ELSE 'order_update'
    END,
    CASE NEW.status
      WHEN 'pending' THEN 'Order dibuat dan menunggu hasil pembayaran.'
      WHEN 'paid' THEN 'Pembayaran berhasil dikonfirmasi.'
      WHEN 'payment_failed' THEN 'Pembayaran gagal dikonfirmasi.'
      WHEN 'shipped' THEN 'Pesanan telah diserahkan untuk pengiriman.'
      WHEN 'delivered' THEN 'Pesanan telah dikonfirmasi diterima.'
    END,
    CASE WHEN TG_OP = 'INSERT' THEN NEW.created_at ELSE NOW() END
  );

  IF NEW.status = 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE NEW.status
      WHEN 'paid' THEN 'payment'
      WHEN 'payment_failed' THEN 'payment'
      WHEN 'shipped' THEN 'shipped'
      WHEN 'delivered' THEN 'rating'
      ELSE 'order'
    END,
    CASE NEW.status
      WHEN 'paid' THEN 'Pembayaran berhasil'
      WHEN 'payment_failed' THEN 'Pembayaran gagal'
      WHEN 'shipped' THEN 'Pesanan sedang dikirim'
      WHEN 'delivered' THEN 'Pesanan telah selesai'
      ELSE 'Status pesanan diperbarui'
    END,
    CASE NEW.status
      WHEN 'paid' THEN 'Pembayaran pesanan berhasil dikonfirmasi oleh SmartBank.'
      WHEN 'payment_failed' THEN 'Pembayaran pesanan belum berhasil. Buka detail pesanan untuk informasi lebih lanjut.'
      WHEN 'shipped' THEN 'Penjual telah menyerahkan pesanan Anda untuk dikirim.'
      WHEN 'delivered' THEN 'Pesanan selesai. Anda dapat memberikan ulasan untuk produk.'
      ELSE 'Status pesanan Anda telah diperbarui.'
    END
  INTO v_type, v_title, v_message;

  INSERT INTO public.notifications (
    user_id,
    order_id,
    type,
    title,
    message,
    href
  )
  VALUES (
    NEW.buyer_id,
    NEW.id,
    v_type,
    v_title,
    v_message,
    '/orders/' || NEW.id::TEXT
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_record_status_event ON public.orders;
CREATE TRIGGER orders_record_status_event
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_status_event();

INSERT INTO public.order_status_history (
  order_id,
  status,
  source,
  note,
  created_at
)
SELECT
  orders.id,
  orders.status,
  'migration',
  'Status terakhir sebelum histori event diaktifkan.',
  COALESCE(orders.updated_at, orders.created_at)
FROM public.orders AS orders
WHERE NOT EXISTS (
  SELECT 1
  FROM public.order_status_history AS history
  WHERE history.order_id = orders.id
);

COMMIT;
