# 📋 Laporan Migrasi: Supabase (PostgreSQL) → MySQL

> **Tanggal:** 1 Juli 2026
> **Status:** ✅ Selesai
> **Author:** Ridwan & Buffy (AI Assistant)
> **Commit:** `cb4a211` — feat(migration): migrate from Supabase PostgreSQL to MySQL

---

## 📌 Ringkasan Eksekutif

PasarKita, sebuah platform marketplace untuk UMKM Indonesia, dimigrasikan dari **Supabase (PostgreSQL + Storage + Auth)** ke **MySQL (MariaDB)** dengan **express.js + mysql2** sebagai backend dan **local filesystem** untuk storage file. Migrasi mencakup 7 fase dan menyentuh 31+ file dalam satu commit.

---

## 📊 Before vs After

### Database

| Aspek | **Before (Supabase)** | **After (MySQL)** |
|-------|----------------------|-------------------|
| Database Engine | PostgreSQL 15 (via Supabase) | MariaDB 12.3.2 (lokal) |
| Koneksi | `@supabase/supabase-js` client | `mysql2/promise` pool |
| ID Generator | `gen_random_uuid()` (server-side) | `UUID()` di application layer |
| Tipe UUID | `UUID` | `CHAR(36)` |
| Tipe Boolean | `BOOLEAN` | `TINYINT(1) DEFAULT 1` |
| Tipe JSON | `JSONB` | `JSON` |
| Tipe Array | `TEXT[]` (PostgreSQL ARRAY) | `JSON` |
| Timestamp | `TIMESTAMPTZ` | `DATETIME` |
| Locking | `pg_advisory_xact_lock()` | `GET_LOCK()` (MySQL SP) |
| Auth/RLS | Supabase RLS Policies | Backend app layer (Express middleware) |
| Storage | Supabase Storage (buckets) | Local filesystem (`uploads/` + `express.static`) |
| Tabel | 23 | 23 (identik) |
| Stored Procedures | 6 (PostgreSQL RPC) | 6 (MySQL SP) |
| Triggers | 4 | 4 (MySQL triggers) |

### Backend

| Aspek | **Before** | **After** |
|-------|-----------|----------|
| Database Client | `@supabase/supabase-js` | `mysql2/promise` |
| Config | `src/config/supabase.js` | `src/config/mysql.js` |
| Query Pattern | `supabase.from('table').select()` | `pool.query('SELECT ...')` |
| Environment | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` |
| RPC Calls | `supabase.rpc('fn_name', params)` | `pool.query('CALL sp_name(?)', [params])` |
| File Upload | Supabase Storage API | Local `fs.writeFile()` + `express.static` |
| Service Files | 13 files menggunakan Supabase client | 13 files menggunakan `pool.query()` |

### Frontend

| Aspek | **Before** | **After** |
|-------|-----------|----------|
| Supabase Dependency | Tidak ada (sudah pakai API calls) | Tidak ada |
| Supabase References | 2 referensi kosmetik (komentar/teks UI) | 0 (sudah dihapus) |
| API Communication | Axios → Backend API | Axios → Backend API (tidak berubah) |

---

## 🔧 Fase-Fase Migrasi

### Fase 1: Analisis & Normalisasi Skema (3NF) ✅

**Yang dilakukan:**
- Audit seluruh 23 tabel untuk compliance 3NF
- Identifikasi kolom redundant (snapshot columns di orders, vouchers, order_vouchers)
- Verifikasi denormalisasi yang disengaja untuk akurasi historis

**Hasil:** Semua tabel sudah 3NF. Tidak perlu restrukturisasi.

---

### Fase 2: Konversi Tipe Data + Schema MySQL ✅

**Yang dilakukan:**
- Konversi semua tipe data PostgreSQL → MySQL
- Buat `000_mysql_full_schema.sql` (23 tabel)
- Fix: TEXT column prefix index untuk `target_type` dan `service` (VARCHAR(100) prefix)
- Fix: CHECK constraints kompatibel dengan MySQL 8.0+

**Tabel yang dibuat:**
```
users, seller_profiles, products, user_addresses, vouchers,
product_discounts, orders, order_items, order_status_history,
ratings, notifications, complaints, order_chat_messages,
product_chat_threads, product_chat_messages, product_ads,
ad_analytics, marketplace_banners, banner_analytics,
user_vouchers, order_vouchers, admin_audit_logs, integration_logs
```

---

### Fase 3: Stored Procedures & Triggers ✅

**Stored Procedures (6):**
| SP | Fungsi | Perubahan dari PostgreSQL |
|----|--------|--------------------------|
| `sp_create_checkout_order` | Checkout dengan locking | `pg_advisory_xact_lock` → `GET_LOCK()` |
| `sp_release_checkout_stock` | Release stok jika checkout gagal | Konversi syntax |
| `sp_increment_banner_views` | Hitung views banner | Konversi syntax |
| `sp_increment_ad_views` | Hitung views iklan | Konversi syntax |
| `sp_increment_banner_clicks` | Hitung clicks banner | Konversi syntax |
| `sp_increment_ad_clicks` | Hitung clicks iklan | Konversi syntax |

**Triggers (4):**
| Trigger | Fungsi |
|---------|--------|
| `trg_product_chat_messages_touch_thread` | Auto-update `updated_at` thread chat |
| `trg_orders_record_status_event` | Record status history saat INSERT order |
| `trg_orders_record_status_update` | Record status history saat UPDATE order |
| `trg_orders_set_fulfillment_timestamps` | Auto-set `processing_at`/`shipped_at` |

**Fix: CONCAT di SIGNAL statements**
MariaDB tidak mengizinkan fungsi CONCAT langsung di `SIGNAL ... SET MESSAGE_TEXT`. Solusi: pre-concat ke variabel `DECLARE v_err_msg VARCHAR(500)`.

**Perubahan Signifikan:**
- Hapus semua RLS policies (otorisasi di backend app layer)
- Notification creation dipindah dari database trigger ke application layer

---

### Fase 4: Storage (Supabase Storage → Local Filesystem) ✅

**Yang dilakukan:**
- Pilih local filesystem (Express.js `express.static`)
- Buat directory structure: `uploads/product-images/`, `uploads/store-assets/`, `uploads/review-images/`
- Tambah `express.static` middleware di `app.js` untuk serve `/uploads`
- Fix upload functions di 3 service files (mkdirSync recursive untuk subdirectory)
- Migrate `verify-schema.js` dari Supabase ke mysql2 pool
- Tambah `/uploads/` ke `.gitignore`

**Service Files yang diupdate:**
- `product.service.js` → `uploads/product-images/{sellerId}/{uuid}.png`
- `seller.service.js` → `uploads/store-assets/{sellerId}/logo-{uuid}.png`
- `rating.service.js` → `uploads/review-images/{userId}/{uuid}.png`

---

### Fase 5: Refactoring Backend ✅

**Config & Dependencies:**
- Buat `src/config/mysql.js` (connection pool dengan `mysql2/promise`)
- Update `src/config/env.js` — MySQL env vars dengan Zod validation
- Install `mysql2` package
- Hapus `@supabase/supabase-js` dari `package.json`
- Hapus `src/config/supabase.js`
- Update `.env` dan `.env.example` dari PostgreSQL ke MySQL config

**Service Files (13 files):**
| File | Fungsi |
|------|--------|
| `auth.service.js` | Register, login, getMe, updateProfile, changePassword |
| `product.service.js` | CRUD, search, seller products, store page |
| `checkout.service.js` | Checkout, cancel (RPC → SP) |
| `order.service.js` | List, detail, status, fulfillment, export |
| `admin.service.js` | Analytics, users, products, reports, audit |
| `profile.service.js` | GetProfile, updateProfile, address CRUD |
| `rating.service.js` | Submit, list, reply, seller reviews |
| `notification.service.js` | List, markRead, create, notify helpers |
| `complaint.service.js` | CRUD, reply, resolve |
| `chat.service.js` | OrderChat & productChat CRUD |
| `seller.service.js` | Analytics, profile, logo upload |
| `promotion.service.js` | Discounts, vouchers, quote |
| `ads.service.js` | Banners, product ads, analytics |

**Utility:**
- `src/utils/observability.js` — MySQL inserts
- `src/app.js` — Dev endpoint MySQL + express.static uploads

**Seed Scripts:**
- `seed.js` — 3 users + 4 products + 1 seller_profile
- `seed-demo-catalog.js` — 5 sellers + 9 buyers + 32 products + 5 seller_profiles

---

### Fase 6: Refactoring Frontend ✅

**Yang dilakukan:**
- Verifikasi API endpoint compatibility (frontend sudah pakai API calls ke backend)
- Hapus referensi Supabase kosmetik:
  - `product-image.tsx` — hapus komentar "URL berasal dari bucket publik Supabase"
  - `admin/audit-logs/page.tsx` — ubah teks "jalankan di Supabase" → "jalankan di MySQL"
- Tidak ada dependensi Supabase di `package.json`

---

### Fase 7: Testing & Validasi ✅

**Database:**
- 23 tabel berhasil dibuat
- 6 stored procedures berhasil dibuat
- 4 triggers berhasil dibuat
- Backend connection test passed
- Seed data: 16 users, 37 products, 5 seller_profiles

**Backend Smoke Test (15/16 PASS):**
| Endpoint | Status |
|----------|--------|
| `GET /api/health` | ✅ |
| `POST /api/auth/register` | ✅ |
| `POST /api/auth/login` | ✅ |
| `GET /api/auth/me` | ✅ |
| `GET /api/products` | ✅ (36 items, paginated) |
| `GET /api/products/:id` | ✅ |
| `GET /api/orders` | ✅ |
| `GET /api/admin/users` | ✅ (16 users) |
| `GET /api/admin/analytics` | ✅ |
| `GET /api/products/mine` | ✅ (4 items) |
| `POST /api/fee/calculate` | ⚠️ Validation error (known contract mismatch) |
| `GET /api/seller/profile` | ✅ |
| `GET /api/seller/analytics` | ✅ |
| `GET /api/products/stores/:id` | ✅ |
| `GET /api/notifications` | ✅ |
| Unauth access → 401 | ✅ |

**Frontend:**
- TypeScript build — 0 errors
- Lint — 0 errors, 6 warnings (non-blocking)

**Storage:**
- Upload product image — ✅
- Upload seller logo — ✅
- Serve uploaded file via HTTP — ✅ HTTP 200

---

## 🐛 Issues yang Ditemukan & Diperbaiki

| Issue | Severity | Fix |
|-------|----------|-----|
| TEXT column index too long (3072 bytes) | High | Prefix index VARCHAR(100) untuk `target_type` dan `service` |
| CONCAT in SIGNAL statements (MariaDB) | High | Pre-concat ke variabel DECLARE sebelum SIGNAL |
| `fs.mkdirSync` tidak create subdirectory | Medium | Tambah `{ recursive: true }` di semua upload functions |
| `verify-schema.js` pakai path relatif | Low | Ganti ke `path.join(__dirname, ...)` |
| Turbopack panic (corrupt `.next/` cache) | Medium | Hapus `.next/` cache 1.9GB |
| Turbopack multiple lockfiles warning | Low | Set `turbopack.root` di `next.config.ts` |

---

## 📁 File yang Diubah

### Total: 31 files (1,994 insertions, 5,291 deletions)

**Backend Modified (25 files):**
- `.env.example`, `.gitignore`, `package-lock.json`, `package.json`
- `database/verify-schema.js`, `seed-demo-catalog.js`, `seed.js`
- `src/app.js`, `src/config/env.js`, `src/utils/observability.js`
- 13 service files (admin, ads, auth, chats, checkout, complaints, notifications, orders, products, profile, promotions, ratings, seller)

**Backend Added (5 files):**
- `database/schema/000_mysql_full_schema.sql`
- `database/schema/001_mysql_stored_procedures.sql`
- `database/schema/002_mysql_triggers.sql`
- `src/config/mysql.js`
- `migration_checklist.md`

**Backend Deleted (1 file):**
- `src/config/supabase.js`

**Frontend Modified (2 files):**
- `app/(admin)/admin/audit-logs/page.tsx`
- `components/pk/product-image.tsx`

---

## 🔑 Credential & Setup Info

**Database:**
```
Host: localhost:3306
Database: pasarkita
User: ridwan
Password: (diketahui oleh developer)
```

**Login Akun Demo:**
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@pasarkita.com | password123 |
| Seller | seller@pasarkita.com | password123 |
| Buyer | buyer@pasarkita.com | password123 |

**Server Commands:**
```bash
# Backend
cd pasarkita-monorepo/backend && node api/index.js

# Frontend
cd pasarkita-monorepo/frontend && npm run dev

# Seed Data
cd pasarkita-monorepo/backend && node seed.js && node seed-demo-catalog.js

# Verify Schema
cd pasarkita-monorepo/backend && node database/verify-schema.js
```

---

## ⚠️ Known Issues (Pre-existing, bukan migration regression)

1. **Fee Calculate** — endpoint expects `items: [...]` array, bukan `subtotal`
2. **Frontend `<img>` warnings** — cosmetic, bukan blocker
3. **Checkout masih dummy** — tidak pakai SmartBank/LogistiKita secara nyata
4. **Upload foto produk** — belum terintegrasi dengan product creation flow
5. **Admin/users masih hardcoded** — beberapa halaman belum terkoneksi ke backend

---

## 📈 Statistik Migrasi

| Metrik | Nilai |
|--------|-------|
| Total Fase | 7 (semua selesai) |
| File Diubah | 31 |
| Insertions | 1,994 |
| Deletions | 5,291 |
| Tabel MySQL | 23 |
| Stored Procedures | 6 |
| Triggers | 4 |
| Service Files Refactored | 13 |
| Backend Endpoints Tested | 16 (15/16 PASS) |
| Demo Users | 16 |
| Demo Products | 37 |
| Demo Seller Profiles | 5 |
| Commit Hash | `cb4a211` |
