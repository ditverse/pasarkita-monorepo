BEGIN;

CREATE TABLE IF NOT EXISTS public.seller_profiles (
  seller_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  store_name VARCHAR(120) NOT NULL,
  logo_url TEXT,
  description TEXT,
  pickup_address TEXT,
  contact_phone VARCHAR(30),
  open_time TIME NOT NULL DEFAULT '08:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  processing_days INTEGER NOT NULL DEFAULT 2 CHECK (processing_days BETWEEN 1 AND 30),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'demo_verified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.seller_profiles (seller_id, store_name)
SELECT id, name
FROM public.users
WHERE role = 'seller'
ON CONFLICT (seller_id) DO NOTHING;

DROP TRIGGER IF EXISTS seller_profiles_set_updated_at ON public.seller_profiles;
CREATE TRIGGER seller_profiles_set_updated_at
BEFORE UPDATE ON public.seller_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-assets',
  'store-assets',
  TRUE,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
