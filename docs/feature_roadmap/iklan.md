# Roadmap Fitur Iklan PasarKita

## Tujuan

Fitur iklan dirancang agar PasarKita memiliki media promosi di halaman utama
melalui carousel seperti marketplace populer. V1 memakai model hybrid:

- Admin dapat membuat banner marketplace.
- Seller dapat booking iklan produk berbayar.
- Admin tetap dapat memoderasi, pause, atau reject iklan seller.

Dokumen ini adalah rancangan sebelum implementasi. Source aktual menunjukkan
bahwa schema baseline sudah memiliki draft `product_ads` dan `ad_analytics`,
tetapi belum ada modul backend/frontend yang memakai fitur iklan.

## Scope V1

| Area | Keputusan |
|---|---|
| Placement utama | Carousel halaman utama |
| Banner admin | Ada, dikelola admin |
| Iklan seller | Ada, berbasis produk |
| Pembayaran seller | SmartBank mock/real melalui backend |
| Moderasi admin | Admin dapat pause/reject iklan seller |
| Analytics | View dan click count |
| UI buyer | Carousel iklan di homepage |
| UI seller | Halaman booking dan riwayat iklan |
| UI admin | Halaman banner dan moderasi iklan |

## Kondisi Codebase Saat Ini

- Homepage berada di `frontend/app/(main)/page.tsx`.
- Belum ada carousel iklan di homepage.
- Schema `product_ads` saat ini mewajibkan `product_id`, sehingga tidak cocok
  untuk banner admin yang tidak selalu terkait produk.
- `ad_analytics` saat ini unik per `ad_id`, cukup untuk counter agregat sederhana.
- Backend sudah punya integrasi SmartBank di `backend/src/integrations/smartbank.js`
  yang dapat dipakai ulang untuk pembayaran iklan.
- Belum ada modul `ads` di backend dan belum ada wrapper API frontend.

## Desain Database

Tambahkan migration baru:

```text
backend/database/migrations/016_promotions_ads.sql
```

Jika implementasi diskon dibuat terpisah, migration iklan dapat memakai nomor
berikutnya, misalnya:

```text
backend/database/migrations/017_ads.sql
```

Migration ini juga harus disinkronkan ke:

```text
backend/database/schema/000_full_schema.sql
```

Tambahkan tabel banner admin:

- `marketplace_banners`
  - `id`
  - `title`
  - `subtitle`
  - `image_url`
  - `target_url`
  - `placement`
  - `start_time`
  - `end_time`
  - `sort_order`
  - `is_active`
  - `created_by`
  - `created_at`
  - `updated_at`

Perluas `product_ads`:

- `placement`
- `title`
- `caption`
- `target_url`
- `rejection_reason`
- `paused_reason`
- `reviewed_by`
- `reviewed_at`

Lifecycle status:

- `pending_payment`
- `scheduled`
- `active`
- `paused`
- `completed`
- `rejected`

Analytics:

- Pertahankan `ad_analytics` untuk agregat view/click.
- Tambahkan kolom atau mekanisme pembeda tipe iklan jika dibutuhkan:
  - `ad_kind`: `product_ad` atau `marketplace_banner`
  - atau buat `banner_analytics` terpisah untuk banner admin.

Rekomendasi v1:

- Gunakan analytics terpisah agar foreign key tetap jelas:
  - `ad_analytics` untuk `product_ads`
  - `banner_analytics` untuk `marketplace_banners`

## Aturan Bisnis Iklan

Banner admin:

- Dibuat dan dikelola superadmin.
- Tampil jika `is_active = true`, `start_time <= now()`, dan `end_time > now()`.
- Klik banner menuju `target_url` internal yang ditentukan admin.
- Urutan tampil memakai `sort_order`, lalu waktu dibuat.

Iklan produk seller:

- Seller memilih produk miliknya sendiri.
- Produk harus aktif dan memiliki stok.
- Seller memilih tanggal mulai, tanggal selesai, dan placement.
- Backend menghitung durasi hari dan total biaya.
- `total_price = jumlah_hari * price_per_day`.
- Payment iklan memakai SmartBank dari user seller.
- Jika payment sukses, status menjadi:
  - `active` jika periode sudah berjalan.
  - `scheduled` jika periode mulai di masa depan.
- Jika payment gagal, status tetap `pending_payment`.
- Admin dapat pause atau reject iklan seller.
- Iklan tampil hanya jika status efektif aktif, payment paid, produk aktif, dan
  periode waktu valid.

Placement v1:

- `home_carousel`

Placement lanjutan:

- `category_carousel`
- `product_detail_sidebar`
- `search_sponsored`

## Backend API

Tambahkan modul:

```text
backend/src/modules/ads
```

Endpoint publik:

- `GET /api/ads/home-carousel`
  - Mengembalikan campuran banner admin dan product ads seller aktif.
  - Response item memiliki tipe:
    - `kind: "banner"` atau `kind: "product_ad"`
    - `id`
    - `title`
    - `subtitle` atau `caption`
    - `image_url`
    - `target_url`
    - `product`

- `POST /api/ads/:id/view`
  - Mencatat impresi iklan.

- `POST /api/ads/:id/click`
  - Mencatat klik iklan.

Endpoint seller:

- `GET /api/seller/ads`
- `POST /api/seller/ads`
- `POST /api/seller/ads/:id/pay`
- `PATCH /api/seller/ads/:id/pause`

Endpoint admin:

- `GET /api/admin/ads`
- `PATCH /api/admin/ads/:id/status`
- `GET /api/admin/banners`
- `POST /api/admin/banners`
- `PATCH /api/admin/banners/:id`
- `DELETE /api/admin/banners/:id` atau soft delete dengan `is_active = false`

Pembayaran seller ads:

- Pakai wrapper SmartBank backend.
- Payload metadata menyertakan `ad_id`, `seller_id`, placement, dan periode.
- Simpan `transaction_id` pada `product_ads`.
- Jangan panggil SmartBank dari frontend.

## Frontend

Tipe baru di `frontend/types/api.ts`:

- `HomeAdItem`
- `MarketplaceBanner`
- `ProductAd`
- `AdAnalytics`

Wrapper API baru:

```text
frontend/lib/api/ads.ts
```

Homepage:

- Tambahkan carousel iklan di halaman utama.
- Carousel tampil setelah hero/search atau sebelum grid produk.
- Item banner admin memakai gambar banner dan target URL.
- Item product ad memakai data produk, gambar produk, nama toko, dan CTA ke detail
  produk.
- Saat item terlihat, frontend memanggil endpoint view.
- Saat item diklik, frontend memanggil endpoint click lalu membuka target.

Halaman seller:

- Tambahkan menu `Iklan` di seller sidebar.
- Tambahkan halaman `/seller/ads`.
- Seller dapat:
  - melihat daftar iklan dan status;
  - membuat booking iklan produk;
  - melihat estimasi biaya;
  - membayar iklan via SmartBank;
  - pause iklan miliknya jika belum selesai.

Halaman admin:

- Tambahkan menu `Iklan` di admin sidebar.
- Tambahkan halaman `/admin/ads`.
- Admin dapat:
  - melihat semua iklan seller;
  - pause/reject iklan seller;
  - melihat analytics view/click;
  - membuat dan mengatur banner marketplace.

## Tampilan Carousel Homepage

Prioritas isi carousel:

1. Banner admin aktif sesuai `sort_order`.
2. Product ads seller aktif dan paid.
3. Jika tidak ada iklan aktif, homepage tetap menampilkan konten produk seperti
   sekarang tanpa empty state iklan.

Prinsip UI:

- Jangan membuat carousel menghalangi pencarian utama.
- Gunakan gambar produk/banner yang jelas.
- Beri label kecil seperti `Iklan` untuk transparansi.
- CTA harus mengarah ke produk atau campaign internal yang valid.

## Test Plan

Backend:

- `GET /api/ads/home-carousel` hanya mengembalikan banner/iklan aktif dalam periode
  valid.
- Seller tidak dapat membuat iklan untuk produk milik seller lain.
- Seller tidak dapat mengiklankan produk inactive atau stok habis.
- Total biaya iklan dihitung dari jumlah hari dan `price_per_day`.
- Payment sukses mengubah status menjadi `active` atau `scheduled`.
- Payment gagal mempertahankan status `pending_payment`.
- Admin dapat pause atau reject iklan seller.
- View dan click counter bertambah sesuai endpoint.

Frontend:

- Homepage menampilkan carousel jika ada iklan aktif.
- Homepage tetap normal jika tidak ada iklan aktif.
- Klik banner menuju `target_url`.
- Klik product ad menuju detail produk.
- Seller dapat membuat booking iklan dan melihat status pembayaran.
- Admin dapat membuat banner dan memoderasi iklan seller.

Smoke test integrasi:

- Jalankan mock SmartBank.
- Booking iklan seller sukses mengurangi saldo SmartBank mock.
- Iklan paid dan aktif muncul di carousel homepage.
- Saldo kurang membuat pembayaran iklan gagal tanpa membuat iklan tampil.

## Asumsi

- V1 hanya memakai placement `home_carousel`.
- Pembayaran iklan seller dilakukan via SmartBank melalui backend.
- Admin banner tidak perlu pembayaran.
- Admin dapat pause/reject iklan seller kapan saja.
- Seller ads tidak menunggu approval manual sebelum tampil, tetapi tetap bisa
  dimoderasi admin.
- Analytics v1 cukup berupa total view dan click, belum perlu event log per user.
