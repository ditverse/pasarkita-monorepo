-- Migration: 012_rating_photos.sql
-- Deskripsi: Menambahkan dukungan foto pada ulasan (Rating & Review dengan Foto)
-- Tanggal: 2026-06-14

BEGIN;

-- 1. Tambah kolom image_urls pada tabel ratings
--    Berisi array URL foto yang diupload ke bucket review-images
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';

-- 2. Buat bucket review-images di Supabase Storage
--    Public: foto dapat dilihat siapa saja tanpa auth
--    Limit: 5 MB per file, hanya JPG / PNG / WebP
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'review-images',
  'review-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public            = EXCLUDED.public,
  file_size_limit   = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. RLS Policy — Upload hanya oleh authenticated user
--    Path convention: {userId}/{uuid}.{ext}
CREATE POLICY IF NOT EXISTS "review_images_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-images');

-- 4. RLS Policy — Public bisa membaca semua foto ulasan
CREATE POLICY IF NOT EXISTS "review_images_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'review-images');

-- 5. RLS Policy — Pemilik file bisa menghapus foto miliknya
CREATE POLICY IF NOT EXISTS "review_images_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'review-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
