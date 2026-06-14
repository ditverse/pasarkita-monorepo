# Testing Audit PasarKita

Tanggal audit: 19 Mei 2026

Audit ini dibuat dari testing ringan dan inspeksi kontrak frontend-backend. Tidak ada
fitur yang diimplementasikan dalam proses audit ini.

## Ringkasan

Status saat ini:

- Frontend belum lolos lint.
- Frontend production build belum berhasil.
- Backend bisa start dan healthcheck berjalan dengan environment dummy.
- Backend belum punya test suite otomatis.
- Ada beberapa kontrak frontend-backend yang belum sinkron.
- Beberapa halaman/sidebar mengarah ke route yang belum ada.
- Beberapa fitur masih dummy/hardcoded.

## Command yang Dijalankan

### Frontend Lint

Command:

```bash
cd frontend
npm run lint
```

Hasil: gagal.

Ringkasan error:

- 19 error, 3 warning.
- Banyak penggunaan `any` di halaman frontend.
- Ada unused import.
- Ada warning penggunaan `<img>` langsung.
- Ada warning React hook: `setState` dipanggil melalui function di `useEffect`.

File yang terkena lint error/warning:

- `frontend/app/(admin)/admin/analytics/page.tsx`
- `frontend/app/(main)/checkout/page.tsx`
- `frontend/app/(main)/orders/[id]/page.tsx`
- `frontend/app/(main)/orders/page.tsx`
- `frontend/app/(main)/page.tsx`
- `frontend/app/(main)/products/[id]/page.tsx`
- `frontend/app/(main)/products/page.tsx`
- `frontend/app/(seller)/seller/products/add/page.tsx`
- `frontend/app/(seller)/seller/products/page.tsx`
- `frontend/app/(seller)/seller/unauthorized/page.tsx`
- `frontend/app/auth/login/page.tsx`
- `frontend/app/auth/register/page.tsx`

### Frontend Build

Command:

```bash
cd frontend
npm run build
```

Hasil: gagal.

Penyebab utama:

- Halaman `/checkout` memakai `useSearchParams()` tanpa Suspense boundary.
- File terkait: `frontend/app/(main)/checkout/page.tsx`.

Catatan tambahan:

- Next.js juga memberi warning bahwa convention `middleware` deprecated dan
  diarahkan ke `proxy`.

### Backend Test

Command:

```bash
cd backend
npm test
```

Hasil: gagal, tetapi karena script memang placeholder:

```text
Error: no test specified
```

Artinya backend belum memiliki test suite otomatis.

### Backend Smoke Test

Backend dijalankan dengan environment dummy agar tidak membuka nilai `.env` lokal.

Hasil:

- `GET /api/health`: OK.
- `POST /api/checkout` tanpa token: `401 Unauthorized`, sesuai ekspektasi.
- `POST /api/fee/calculate`: `404 Not Found`.

## Fitur yang Bug / Belum Jalan

### 1. Frontend Belum Bisa Production Build

Severity: tinggi.

Masalah:

- `npm run build` gagal di route `/checkout`.
- Penyebabnya `useSearchParams()` dipakai langsung di page client tanpa Suspense
  boundary.

Dampak:

- Frontend tidak siap deploy production.

File:

- `frontend/app/(main)/checkout/page.tsx`

### 2. Frontend Belum Lolos Lint

Severity: sedang-tinggi.

Masalah:

- Banyak `any`.
- Ada import tidak dipakai.
- Ada warning React hook dan image optimization.

Dampak:

- Kualitas TypeScript rendah.
- Potensi bug runtime lebih sulit ketangkap.
- CI/deploy yang menjalankan lint akan gagal.

### 3. Base URL API Rawan Salah

Severity: tinggi.

Masalah:

- Backend memasang endpoint di `/api/*`.
- Axios frontend memanggil path seperti `/products`, `/checkout`, `/orders`.
- Ini hanya benar kalau `NEXT_PUBLIC_API_URL` sudah berisi suffix `/api`.

File:

- `frontend/lib/api.ts`
- `backend/src/app.js`

Dampak:

- Jika `NEXT_PUBLIC_API_URL=http://localhost:3001`, request frontend akan menuju
  `/products`, padahal backend punya `/api/products`.
- Beberapa page fallback memakai `http://localhost:3001/api`, sehingga pola URL
  tidak konsisten.

Yang perlu diputuskan:

- Standarkan `NEXT_PUBLIC_API_URL` selalu sampai `/api`, atau ubah wrapper API agar
  menambahkan `/api` sendiri.

### 4. Endpoint Fee Calculation Belum Ada

Severity: sedang.

Masalah:

- Frontend punya `checkoutApi.calculateFee()` ke `/fee/calculate`.
- README/PRD juga menyebut `/api/fee/calculate`.
- Backend tidak memasang route fee.

File:

- `frontend/lib/api/checkout.ts`
- `backend/src/app.js`
- `backend/src/utils/fee.js`

Dampak:

- Fitur preview/simulasi fee dari backend tidak bisa berjalan.

### 5. Kontrak Checkout Tidak Sinkron

Severity: tinggi.

Masalah:

- Wrapper frontend mendefinisikan payload checkout sebagai:

```ts
{
  items: { product_id: string; qty: number }[];
  shipping_address: string;
}
```

- Page checkout dan backend saat ini memakai:

```ts
{
  productId: string;
  quantity: number;
  shippingAddress: string;
}
```

File:

- `frontend/lib/api/checkout.ts`
- `frontend/app/(main)/checkout/page.tsx`
- `backend/src/modules/checkout/checkout.service.js`

Dampak:

- Jika kode memakai wrapper `checkoutApi.checkout`, request akan gagal.
- Backend belum mendukung multi-item checkout seperti PRD.

### 6. Response Order Tidak Sinkron dengan Type Frontend

Severity: sedang.

Masalah:

- Tipe frontend `Order` memakai field seperti `subtotal`, `fee_marketplace`,
  `total`, `transaction_id`, `tracking_id`.
- Backend database/service saat ini memakai `total_amount`, `app_fee`,
  `shipping_fee`, dan belum menyimpan `transaction_id` / `tracking_id`.

File:

- `frontend/types/api.ts`
- `backend/database/schema/000_full_schema.sql`
- `backend/src/modules/orders/order.service.js`
- `frontend/app/(main)/orders/page.tsx`
- `frontend/app/(main)/orders/[id]/page.tsx`

Dampak:

- UI harus memakai field backend aktual atau backend harus disesuaikan dengan tipe
  PRD.
- Potensi tampilan order kosong/salah jika field yang diharapkan tidak ada.

### 7. Admin Analytics Salah Membaca Response

Severity: sedang.

Masalah:

- Backend membungkus analytics di `data`.
- Frontend menyimpan `res.data` langsung, lalu membaca `data?.metrics`.
- Seharusnya kemungkinan membaca `res.data.data`.

File:

- `frontend/app/(admin)/admin/analytics/page.tsx`
- `backend/src/modules/admin/admin.controller.js`

Dampak:

- Metric admin analytics bisa tampil 0/kosong walaupun backend mengembalikan data.

### 8. Link Sidebar Mengarah ke Halaman yang Tidak Ada

Severity: sedang.

Masalah:

- Sidebar admin punya link `/admin/orders`, tetapi page tidak ditemukan.
- Sidebar seller punya link `/seller/orders`, tetapi page tidak ditemukan.

File:

- `frontend/components/pk/admin-sidebar.tsx`
- `frontend/components/pk/seller-sidebar.tsx`

Dampak:

- User akan masuk ke 404/not found saat klik menu tersebut.

### 9. Admin Users Masih Hardcoded

Severity: sedang.

Masalah:

- Halaman admin users memakai array `USERS` lokal.
- Backend sebenarnya sudah punya endpoint `GET /api/admin/users`.

File:

- `frontend/app/(admin)/admin/users/page.tsx`
- `backend/src/modules/admin/admin.routes.js`

Dampak:

- Data user di admin panel tidak sesuai database.
- Tombol ban/aktifkan belum benar-benar mengubah data.

### 10. Admin Overview Masih Hardcoded

Severity: sedang.

Masalah:

- Halaman admin overview memakai data order/metric statis.

File:

- `frontend/app/(admin)/admin/page.tsx`

Dampak:

- Dashboard admin tidak mencerminkan data aktual.

### 11. Update Status User Masih Dummy

Severity: sedang.

Masalah:

- Backend `updateUserStatus` hanya return `{ success: true }`.
- Tidak ada update ke Supabase.

File:

- `backend/src/modules/admin/admin.service.js`

Dampak:

- Fitur ban/aktifkan user belum benar-benar bekerja.

### 12. Checkout Backend Masih Dummy

Severity: tinggi untuk flow pembayaran asli.

Masalah:

- Checkout langsung membuat order `paid`.
- Tidak memakai wrapper SmartBank.
- Tidak memanggil LogistiKita.
- Tidak menyimpan `transaction_id` atau `tracking_id`.
- Jika insert `order_items` gagal, error hanya dicatat dan checkout tetap sukses.

File:

- `backend/src/modules/checkout/checkout.service.js`
- `backend/src/integrations/smartbank.js`
- `backend/src/integrations/logistikita.js`

Dampak:

- Flow pembayaran/pengiriman belum sesuai README/PRD.
- Data order bisa tidak lengkap.
- Stok bisa berkurang meski detail item gagal tersimpan.

### 13. Upload Foto Produk Belum Disimpan

Severity: rendah-sedang.

Masalah:

- UI add product bisa preview image lokal.
- Payload image tidak dikirim ke backend.
- Backend product belum terlihat mendukung image upload/storage.

File:

- `frontend/app/(seller)/seller/products/add/page.tsx`
- `backend/src/modules/products/product.service.js`

Dampak:

- Produk tidak punya foto nyata dari user.

### 14. Toggle Aktif Produk Seller Berpotensi Salah

Severity: sedang.

Masalah:

- Komponen `Toggle` mengirim nilai `!on`.
- Handler `toggleActive` menerima nilai itu sebagai `currentStatus`, lalu membalik
  lagi dengan `const newStatus = !currentStatus`.

File:

- `frontend/app/(seller)/seller/products/page.tsx`

Dampak:

- Toggle bisa mengirim status yang tidak sesuai dengan intent user.

### 15. Database Schema/Migration Belum Lengkap

Severity: tinggi untuk setup baru.

Masalah:

- Schema database kini dipusatkan di `backend/database/`, dengan full schema
  untuk project baru dan migration berurutan untuk database yang sudah ada.
- Kode membutuhkan tabel `users` dan `products`.
- Tidak ditemukan folder migrations.

File:

- `backend/database/schema/000_full_schema.sql`
- `backend/seed.js`
- `backend/src/modules/auth/auth.service.js`
- `backend/src/modules/products/product.service.js`

Dampak:

- Developer baru tidak bisa setup database lengkap hanya dari file SQL yang ada.

### 16. Backend Test Suite Belum Ada

Severity: sedang.

Masalah:

- `npm test` masih placeholder.
- Tidak ditemukan test files/framework test backend.

Dampak:

- Regressions backend sulit dideteksi otomatis.

## Fitur yang Perlu Dilengkapi

Prioritas disarankan:

1. Perbaiki frontend build `/checkout`.
2. Rapikan lint error yang blocking.
3. Standarkan `NEXT_PUBLIC_API_URL` dan path `/api`.
4. Samakan kontrak checkout frontend-backend.
5. Tambahkan endpoint `/api/fee/calculate` atau hapus wrapper/fitur yang memanggilnya.
6. Samakan tipe order frontend dengan response backend.
7. Buat page `/admin/orders` dan `/seller/orders`, atau hapus link sidebar sementara.
8. Hubungkan admin users dan admin overview ke backend.
9. Implementasikan `updateUserStatus` secara nyata.
10. Implementasikan flow SmartBank/LogistiKita atau beri label jelas bahwa checkout
    masih dummy.
11. Lengkapi schema/migration untuk `users`, `products`, `orders`, `order_items`.
12. Tambahkan test minimal backend dan frontend.

## Rekomendasi Test Berikutnya

Manual smoke test setelah perbaikan awal:

- Register buyer.
- Login buyer.
- Browse produk.
- Detail produk.
- Checkout produk.
- Lihat daftar order.
- Lihat detail order.
- Login seller.
- Tambah produk.
- Toggle status produk.
- Login superadmin.
- Lihat users.
- Ban/aktifkan user.
- Lihat analytics.

Automated test yang disarankan:

- Backend auth register/login/me.
- Backend products list/detail/create/update/delete.
- Backend checkout sukses dan stok berkurang.
- Backend checkout stok habis.
- Backend orders authorization buyer/seller/superadmin.
- Backend admin users/analytics.
- Frontend build test.
- Frontend lint in CI.

## Catatan Keamanan

- Jangan expose isi `.env` atau service role key.
- Jangan jalankan `seed.js` ke database produksi/shared tanpa izin.
- Jika memperbaiki checkout asli, jaga rollback stok dan idempotensi payment.
- Frontend middleware hanya UX guard; authorization tetap harus di backend.
