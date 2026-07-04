BEGIN;

-- Add profile fields to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone VARCHAR(30),
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create user_addresses table for Address Book feature
CREATE TABLE IF NOT EXISTS public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label VARCHAR(50) NOT NULL, -- e.g., 'Rumah', 'Kantor'
  recipient_name VARCHAR NOT NULL,
  phone VARCHAR(30) NOT NULL,
  full_address TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying addresses by user
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id
  ON public.user_addresses(user_id);

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS user_addresses_set_updated_at ON public.user_addresses;
CREATE TRIGGER user_addresses_set_updated_at
BEFORE UPDATE ON public.user_addresses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce only one primary address per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_addresses_one_primary
  ON public.user_addresses(user_id)
  WHERE is_primary = TRUE;

-- Enable Row Level Security
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

-- Storage Bucket for User Avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  TRUE,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
