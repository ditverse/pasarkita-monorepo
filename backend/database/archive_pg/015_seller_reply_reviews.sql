-- Migration: 015_seller_reply_reviews.sql
-- Deskripsi: Balasan Ulasan bagi Seller (Seller Reply Reviews)
-- Tanggal: 2026-06-15

BEGIN;

-- 1. Tambah kolom seller_reply pada tabel ratings
ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS seller_reply TEXT,
  ADD COLUMN IF NOT EXISTS seller_replied_at TIMESTAMPTZ;

COMMIT;
