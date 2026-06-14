# Database PasarKita

Folder ini menjadi sumber schema PostgreSQL/Supabase PasarKita yang portabel.

## Struktur

- `schema/000_full_schema.sql`: setup lengkap untuk project Supabase baru.
- `migrations/000_core_compatibility.sql`: index, trigger, dan RLS schema lama.
- `migrations/001_product_images.sql`: kolom dan bucket gambar produk.
- `migrations/002_observability.sql`: audit log admin dan log integrasi.
- `migrations/003_checkout_hardening.sql`: checkout idempotent, stok atomik, dan
  snapshot nama produk.
- `migrations/004_order_history_notifications.sql`: histori status bertimestamp
  dan notifikasi transaksional pembeli.
- `migrations/005_seller_inventory_basics.sql`: batas stok minimum dan index
  inventori seller.
- `migrations/006_seller_profiles.sql`: identitas toko, operasional, alamat pickup,
  dan bucket logo toko.
- `migrations/007_seller_fulfillment.sql`: status proses, snapshot pickup, timestamp
  SLA, dan status sinkronisasi LogistiKita.
- `scripts/apply-migrations.sh`: menjalankan migration berurutan melalui `psql`.

## Project Supabase Baru

Jalankan satu file berikut melalui Supabase SQL Editor:

```text
backend/database/schema/000_full_schema.sql
```

File tersebut sudah mencakup seluruh tabel, index, trigger, storage bucket,
observability, dan RPC checkout.

## Database PasarKita yang Sudah Ada

Jalankan migration sesuai nomor urut:

```text
000_core_compatibility.sql
001_product_images.sql
002_observability.sql
003_checkout_hardening.sql
004_order_history_notifications.sql
005_seller_inventory_basics.sql
006_seller_profiles.sql
007_seller_fulfillment.sql
```

Semua migration dibuat idempotent dan tidak menghapus tabel atau data transaksi.

Alternatif melalui terminal:

```bash
cd backend
DATABASE_URL='postgresql://...' npm run db:migrate
```

Gunakan **Session pooler URI** dari Supabase Dashboard pada **Connect**, terutama
jika mesin tidak memiliki jaringan IPv6. Direct connection `db.<ref>.supabase.co`
sering hanya tersedia melalui IPv6. Jangan commit `DATABASE_URL`, password
database, service-role key, atau secret lain.

## Keamanan

- Backend menggunakan service-role key dan tetap menjadi satu-satunya pihak yang
  mengakses tabel aplikasi.
- RLS diaktifkan tanpa policy permisif `USING (true)` untuk `anon` atau
  `authenticated`.
- RPC checkout dicabut dari `PUBLIC`, `anon`, dan `authenticated`, lalu hanya
  diberikan kepada `service_role`.
- Bucket gambar bersifat publik hanya untuk membaca URL gambar. Upload tetap
  dilakukan backend menggunakan service role.

## Memindahkan Database

1. Buat project Supabase tujuan.
2. Jalankan `schema/000_full_schema.sql`.
3. Salin environment backend ke project tujuan dengan secret baru.
4. Jalankan seed hanya jika memang memerlukan data demo.
5. Uji register, login, upload gambar, checkout, order, rating, dan admin.

Schema ini tidak memindahkan data lama. Untuk data, gunakan backup/restore
PostgreSQL (`pg_dump` dan `pg_restore`) dari project sumber.
