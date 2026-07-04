BEGIN;

CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('damaged', 'missing_item', 'wrong_item', 'not_received', 'other')),
  description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' 
    CHECK (status IN ('open', 'seller_replied', 'admin_review', 'resolved', 'rejected')),
  seller_response TEXT,
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure one order can only have one active complaint
CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_order_id ON public.complaints(order_id);

-- Setup RLS
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own complaints" ON public.complaints;
CREATE POLICY "Users can view their own complaints"
  ON public.complaints FOR SELECT
  USING (
    buyer_id = auth.uid() OR 
    seller_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "Buyers can create complaints" ON public.complaints;
CREATE POLICY "Buyers can create complaints"
  ON public.complaints FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND buyer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Sellers can update their complaints" ON public.complaints;
CREATE POLICY "Sellers can update their complaints"
  ON public.complaints FOR UPDATE
  USING (
    seller_id = auth.uid() OR
    buyer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS complaints_set_updated_at ON public.complaints;
CREATE TRIGGER complaints_set_updated_at
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add 'complained' status to orders (optional but good for visibility without joining)
-- For simplicity, we just rely on complaints table, but let's add order constraint if needed.
-- We will just join complaints table.

COMMIT;
