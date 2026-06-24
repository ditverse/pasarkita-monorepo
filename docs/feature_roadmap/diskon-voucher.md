# Roadmap Fitur Diskon dan Voucher PasarKita

## Tujuan

Fitur diskon dan voucher dirancang untuk membuat PasarKita memiliki mekanisme
promosi yang mirip marketplace populer: flashsale berbasis waktu, voucher
marketplace, dan voucher seller yang dapat digabung dalam satu checkout.

Dokumen ini adalah rancangan sebelum implementasi. Source aktual menunjukkan
bahwa schema baseline sudah memiliki draft `product_discounts`, `vouchers`,
`user_vouchers`, serta kolom `orders.voucher_id` dan `orders.voucher_discount`,
tetapi backend dan frontend belum memakai fitur tersebut.

## Scope V1

| Area | Keputusan |
|---|---|
| Flashsale | Diskon produk otomatis berdasarkan periode aktif |
| Voucher marketplace | Dibuat admin, berlaku lintas toko atau kategori tertentu |
| Voucher seller | Dibuat seller, berlaku untuk produk milik seller tersebut |
| Combine voucher | Satu voucher marketplace + maksimal satu voucher per seller |
| Checkout | Semua diskon dihitung ulang di backend |
| UI buyer | Harga promo, input voucher, breakdown diskon |
| UI seller | Halaman pengelolaan flashsale dan voucher toko |
| UI admin | Halaman pengelolaan voucher marketplace |

## Kondisi Codebase Saat Ini

- Checkout backend memakai `checkout.service.js` dan mencoba RPC
  `create_checkout_order`; fallback legacy masih tersedia.
- Fee marketplace saat ini dihitung 2% dari subtotal melalui `utils/fee.js`.
- Checkout frontend masih menghitung beberapa preview biaya secara lokal, terutama
  di halaman checkout dan detail produk.
- Product API belum mengembalikan `original_price`, `effective_price`, atau
  `active_discount`.
- `orders.voucher_id` hanya mendukung satu voucher, sehingga tidak cukup untuk
  kombinasi marketplace + multi seller voucher.
- Belum ada migration bernomor untuk tabel promo/voucher walaupun baseline schema
  sudah memuat draft tabel.

## Desain Database

Tambahkan migration baru:

```text
backend/database/migrations/016_promotions_discounts.sql
```

Migration ini juga harus disinkronkan ke:

```text
backend/database/schema/000_full_schema.sql
```

Perluasan snapshot order:

- `order_items.original_price_at_purchase`
- `order_items.product_discount_per_unit`
- `order_items.product_discount_id`
- `orders.fee_marketplace_base`
- `orders.fee_discount`
- `orders.voucher_discount_total`
- `orders.discount_total`

Tambahkan ledger voucher:

- `order_vouchers`
  - `order_id`
  - `voucher_id`
  - `voucher_code`
  - `scope`: `marketplace` atau `seller`
  - `seller_id`
  - `discount_type`
  - `discount_amount`
  - `eligible_subtotal`
  - `created_at`

Perluas `user_vouchers` menjadi ledger pemakaian/reservasi:

- `status`: `reserved`, `used`, `released`
- `reserved_at`
- `used_at`
- `released_at`
- `idempotency_key`

Catatan kompatibilitas:

- Pertahankan `orders.voucher_id` dan `orders.voucher_discount` untuk data lama.
- Logic baru membaca detail voucher dari `order_vouchers`.
- `orders.voucher_discount` dapat diisi ringkasan total diskon voucher agar report
  lama tetap bisa berjalan.

## Aturan Bisnis Diskon Produk

`product_discounts` dipakai untuk flashsale.

Aturan aktif:

- `is_active = true`
- `start_time <= now()`
- `end_time > now()`

Jika ada lebih dari satu diskon aktif pada produk yang sama, sistem memakai diskon
terbesar yang valid.

Aturan perhitungan:

- `percentage`: diskon = `price * discount_value / 100`
- `fixed_amount`: diskon = `discount_value`
- Diskon tidak boleh membuat harga efektif kurang dari 0.
- Harga checkout memakai harga setelah flashsale.
- Snapshot harga asli dan diskon per unit disimpan di `order_items`.

## Aturan Bisnis Voucher

Jenis voucher:

- Voucher marketplace: `seller_id = null`
- Voucher seller: `seller_id != null`

Tipe diskon:

- `percentage`
- `fixed_amount`
- `free_marketplace_fee`

Aturan umum:

- Voucher harus aktif, belum expired, sudah masuk periode aktif, dan kuota masih
  tersedia.
- `used_count` tidak boleh melebihi `quota`.
- `min_purchase` dihitung dari subtotal eligible setelah flashsale.
- `category` bersifat opsional; jika ada, voucher hanya berlaku untuk item kategori
  tersebut.
- Diskon voucher tidak boleh membuat subtotal eligible negatif.

Aturan combine:

- Maksimal satu voucher marketplace per checkout.
- Maksimal satu voucher seller per seller dalam checkout yang sama.
- Multi seller checkout boleh memakai beberapa voucher seller selama setiap voucher
  berasal dari seller yang berbeda.
- Voucher seller hanya menghitung produk milik seller tersebut.
- Voucher marketplace menghitung seluruh order atau kategori tertentu.
- `free_marketplace_fee` hanya boleh untuk voucher marketplace dan mengurangi fee,
  bukan subtotal produk.

## Backend API

Tambahkan modul:

```text
backend/src/modules/promotions
```

Endpoint buyer:

- `POST /api/promotions/quote`
  - Body:
    - `items: [{ product_id, qty }]`
    - `marketplace_voucher_code?: string`
    - `seller_voucher_codes?: string[]`
  - Response:
    - `subtotal_original`
    - `product_discount_total`
    - `subtotal_after_product_discount`
    - `fee_marketplace_base`
    - `fee_discount`
    - `fee_marketplace`
    - `voucher_discount_total`
    - `discount_total`
    - `total`
    - `items`
    - `applied_vouchers`
    - `rejected_vouchers`

- `GET /api/promotions/vouchers/available`
  - Mengembalikan voucher aktif yang bisa dipakai buyer.

Endpoint seller:

- `GET /api/seller/promotions`
- `POST /api/seller/promotions/discounts`
- `PATCH /api/seller/promotions/discounts/:id`
- `POST /api/seller/promotions/vouchers`
- `PATCH /api/seller/promotions/vouchers/:id`

Endpoint admin:

- `GET /api/admin/promotions/vouchers`
- `POST /api/admin/promotions/vouchers`
- `PATCH /api/admin/promotions/vouchers/:id`

Checkout:

- Extend `POST /api/checkout` body:
  - `marketplace_voucher_code?: string`
  - `seller_voucher_codes?: string[]`
- Checkout harus memanggil service quote yang sama dengan
  `/api/promotions/quote`.
- Payment SmartBank memakai `total` hasil kalkulasi backend.
- Jika payment gagal, stok dan voucher reservation harus dilepas.
- Idempotency replay tidak boleh menggandakan voucher usage.

Fee:

- `POST /api/fee/calculate` tetap ada untuk kompatibilitas.
- Logic diarahkan ke quote service tanpa voucher, sehingga angka tetap konsisten.

## Frontend

Tipe baru di `frontend/types/api.ts`:

- `Product.active_discount`
- `Product.original_price`
- `Product.effective_price`
- `PromotionQuote`
- `AppliedVoucher`
- `RejectedVoucher`

Perubahan buyer:

- Product card dan detail produk menampilkan harga coret dan harga promo saat
  flashsale aktif.
- Cart dan checkout memakai `effective_price`.
- Checkout page memanggil `POST /api/promotions/quote`.
- Checkout page menampilkan breakdown:
  - subtotal awal
  - diskon produk
  - voucher marketplace
  - voucher seller
  - fee marketplace
  - diskon fee
  - total akhir
- Tombol bayar memakai total dari quote backend.

Perubahan seller:

- Tambahkan menu `Promosi` di seller sidebar.
- Tambahkan halaman `/seller/promotions`.
- Seller dapat membuat flashsale produk, melihat periode aktif, menonaktifkan
  promo, dan membuat voucher toko.

Perubahan admin:

- Tambahkan menu `Promosi` di admin sidebar.
- Tambahkan halaman `/admin/promotions`.
- Admin dapat membuat, mengaktifkan, menonaktifkan, dan memantau voucher
  marketplace.

## Test Plan

Backend:

- Quote tanpa voucher tetap menghasilkan total lama: subtotal + fee 2%.
- Flashsale aktif mengubah harga efektif.
- Flashsale expired atau inactive tidak berlaku.
- Voucher marketplace + voucher seller bisa digabung.
- Multi seller checkout menerapkan satu voucher seller per seller.
- Voucher kategori hanya berlaku pada item kategori yang cocok.
- Voucher quota habis, expired, inactive, atau min purchase tidak terpenuhi
  dikembalikan sebagai rejected voucher.
- Payment gagal melepas stok dan voucher reservation.
- Idempotency replay tidak menggandakan voucher usage, stok, order, atau payment.

Frontend:

- Product card/detail menampilkan harga promo dengan benar.
- Checkout menampilkan breakdown diskon dan total akhir.
- Checkout menolak voucher invalid dengan pesan yang jelas.
- Seller dapat membuat flashsale dan voucher toko.
- Admin dapat membuat voucher marketplace.

Smoke test integrasi:

- Jalankan mock SmartBank dan LogistiKita.
- Checkout sukses dengan voucher menghasilkan `transaction_id`, `tracking_id`, dan
  snapshot diskon benar.
- Checkout gagal karena saldo kurang tidak mengurangi kuota voucher secara permanen.

## Asumsi

- Waktu promo disimpan sebagai `timestamptz`.
- UI menampilkan waktu dalam zona Asia/Jakarta.
- Flashsale adalah diskon produk otomatis, bukan voucher.
- Fee marketplace dihitung dari subtotal setelah flashsale, sebelum voucher produk.
- Voucher `free_marketplace_fee` hanya mengurangi fee marketplace.
- Diskon tidak boleh menghasilkan nilai negatif.
