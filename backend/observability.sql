-- PasarKita admin observability
-- Jalankan satu kali di Supabase SQL Editor sebelum memakai audit log dan
-- integration health. Tidak mengubah saldo atau data transaksi utama.

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  reason      TEXT,
  before_data JSONB,
  after_data  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs(target_type, target_id);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "service_role_bypass_admin_audit_logs"
  ON public.admin_audit_logs FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.integration_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service     TEXT NOT NULL,
  operation   TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status_code INTEGER,
  error_code  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_created
  ON public.integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_service_created
  ON public.integration_logs(service, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_order
  ON public.integration_logs(order_id);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_bypass_integration_logs" ON public.integration_logs;
CREATE POLICY "service_role_bypass_integration_logs"
  ON public.integration_logs FOR ALL USING (true);
