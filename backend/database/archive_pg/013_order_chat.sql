BEGIN;

-- =========================
-- Order Chat (MVP)
-- Room = order_id (no separate rooms table)
-- Messages Policed via RLS using orders.buyer_id
-- =========================

CREATE TABLE IF NOT EXISTS public.order_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_chat_messages_order_created
  ON public.order_chat_messages(order_id, created_at DESC);

-- Setup RLS
ALTER TABLE public.order_chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper: determine receiver/sender seller_id is not stored in orders table,
-- so authorization uses: 
--  - buyer can always access if orders.buyer_id = auth.uid()
--  - seller can access if seller_id exists via order_items -> products
-- This is consistent with existing complaint logic.

-- SELECT policy: buyer sees messages for own order; seller sees messages for own orders
DROP POLICY IF EXISTS "Buyer can read their order chat" ON public.order_chat_messages;
CREATE POLICY "Buyer can read their order chat"
  ON public.order_chat_messages FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Seller can read order chat for their orders" ON public.order_chat_messages;
CREATE POLICY "Seller can read order chat for their orders"
  ON public.order_chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.products p ON p.id = oi.product_id
      WHERE o.id = order_chat_messages.order_id
        AND p.seller_id = auth.uid()
    )
  );

-- INSERT policy: sender must be buyer or seller of that order
DROP POLICY IF EXISTS "Buyer can send in their order chat" ON public.order_chat_messages;
CREATE POLICY "Buyer can send in their order chat"
  ON public.order_chat_messages FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.buyer_id = auth.uid()
    )
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS "Seller can send in their order chat" ON public.order_chat_messages;
CREATE POLICY "Seller can send in their order chat"
  ON public.order_chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
      JOIN public.products p ON p.id = oi.product_id
      WHERE o.id = order_chat_messages.order_id
        AND p.seller_id = auth.uid()
    )
  );

-- updated_at not needed for messages (append-only)

COMMIT;

