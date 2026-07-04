BEGIN;

-- Product Chat (pre-purchase)
-- Thread = buyer + seller + product. Messages are append-only.

CREATE TABLE IF NOT EXISTS public.product_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_chat_threads_unique UNIQUE (product_id, buyer_id, seller_id),
  CONSTRAINT product_chat_no_self CHECK (buyer_id <> seller_id)
);

CREATE TABLE IF NOT EXISTS public.product_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.product_chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_chat_threads_buyer_updated
  ON public.product_chat_threads(buyer_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_chat_threads_seller_updated
  ON public.product_chat_threads(seller_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_chat_threads_product
  ON public.product_chat_threads(product_id);
CREATE INDEX IF NOT EXISTS idx_product_chat_messages_thread_created
  ON public.product_chat_messages(thread_id, created_at DESC);

ALTER TABLE public.product_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_chat_messages ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS product_chat_threads_set_updated_at ON public.product_chat_threads;
CREATE TRIGGER product_chat_threads_set_updated_at
BEFORE UPDATE ON public.product_chat_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.touch_product_chat_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.product_chat_threads
  SET updated_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_chat_messages_touch_thread ON public.product_chat_messages;
CREATE TRIGGER product_chat_messages_touch_thread
AFTER INSERT ON public.product_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_product_chat_thread();

DROP POLICY IF EXISTS "Participants can read product chat threads" ON public.product_chat_threads;
CREATE POLICY "Participants can read product chat threads"
  ON public.product_chat_threads FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

DROP POLICY IF EXISTS "Buyer can create product chat thread" ON public.product_chat_threads;
CREATE POLICY "Buyer can create product chat thread"
  ON public.product_chat_threads FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND buyer_id <> seller_id
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_chat_threads.product_id
        AND p.seller_id = product_chat_threads.seller_id
        AND p.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Participants can read product chat messages" ON public.product_chat_messages;
CREATE POLICY "Participants can read product chat messages"
  ON public.product_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.product_chat_threads t
      WHERE t.id = product_chat_messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send product chat messages" ON public.product_chat_messages;
CREATE POLICY "Participants can send product chat messages"
  ON public.product_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.product_chat_threads t
      WHERE t.id = product_chat_messages.thread_id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

COMMIT;
