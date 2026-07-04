# Audit SOLID dan Clean Code PasarKita

Tanggal audit: 24 Juni 2026

Audit ini dibuat dari pembacaan source code, README, AGENTS, PRD, schema
database, dan smoke check ringan. File `.env` tidak dibaca dan tidak dijadikan
sumber audit.

## Ringkasan Eksekutif

Status umum: **cukup baik untuk tugas besar dan demo, tetapi belum ideal untuk
maintenance jangka panjang.**

Yang sudah baik:

- Struktur backend sudah memakai pola `routes -> controller -> service`.
- Controller umumnya tipis dan service menjadi pusat business logic.
- Validasi input sudah memakai Zod pada banyak endpoint.
- Frontend sudah punya API wrapper per domain dan state store terpisah.
- Algoritma penting sudah diisolasi di utility, misalnya KMP dan fee.
- Integrasi eksternal sudah punya wrapper `smartbank.js`, `logistikita.js`, dan
  target switching mock/Gateway.

Masalah utama:

- Beberapa service backend terlalu besar dan memegang banyak tanggung jawab.
- Dependency langsung ke singleton Supabase dan integrasi eksternal membuat unit
  test sulit.
- Aturan status/role/order tersebar di beberapa tempat sehingga rawan tidak
  sinkron.
- Frontend punya beberapa page/component besar yang mencampur fetching, state,
  mutation, validasi, dan tampilan.
- Helper response dan validation masih punya detail kecil yang berisiko membuat
  kontrak API tidak konsisten.

Kesimpulan: **sebagian prinsip SOLID sudah diterapkan secara struktural, tetapi
SRP, OCP, dan DIP masih perlu diperbaiki.**

## Kondisi Verifikasi Saat Audit

- `frontend/package-lock.json` sudah punya perubahan lokal sebelum audit ini.
  Audit tidak mengubah file tersebut.
- `npm run lint` di `frontend/` gagal dengan 2 error dan 5 warning.
  Error utama ada di `frontend/app/(main)/chats/page.tsx:63` karena tanda kutip
  JSX belum di-escape.
- `npm test` di `backend/` gagal karena script masih placeholder:
  `Error: no test specified`.

## Penilaian SOLID

| Prinsip | Status | Catatan |
|---|---|---|
| S - Single Responsibility | Belum konsisten | Struktur folder bagus, tetapi beberapa service terlalu gemuk. |
| O - Open/Closed | Belum konsisten | Aturan status, role, sort, dan analytics masih banyak hard-coded. |
| L - Liskov Substitution | Tidak terlalu relevan | Codebase dominan functional CommonJS/React, hampir tidak memakai inheritance. |
| I - Interface Segregation | Cukup, perlu dirapikan | API wrapper frontend sudah per domain, tetapi `types/api.ts` terlalu besar. |
| D - Dependency Inversion | Lemah | Service langsung import Supabase, payment, logistics, notification, dan clock. |

## Temuan Utama

### 1. Service Backend Terlalu Besar

Severity: tinggi.

Bukti:

- `backend/src/modules/admin/admin.service.js`: 1428 baris.
- `backend/src/modules/orders/order.service.js`: 698 baris.
- `backend/src/modules/products/product.service.js`: 584 baris.
- `backend/src/modules/checkout/checkout.service.js`: 393 baris.

Dampak:

- Sulit membaca alur bisnis karena query database, policy, formatting response,
  analytics, report, dan audit log bercampur.
- Perubahan kecil berisiko menyentuh file besar.
- Unit test menjadi sulit karena fungsi punya banyak dependency implisit.

Contoh:

- `admin.service.js` berisi user management, moderation, analytics, health score,
  anomaly detection, report export, dan fee simulation sekaligus.
- `checkout.service.js` berisi validasi stok, pembuatan order, payment,
  rollback, shipping, notification, atomic RPC, dan fallback legacy.

Rekomendasi:

- Pecah `admin.service.js` menjadi:
  - `admin-user.service.js`
  - `admin-moderation.service.js`
  - `admin-analytics.service.js`
  - `admin-report.service.js`
  - `admin-fee-simulator.service.js`
- Pecah checkout menjadi orchestration kecil:
  - `checkout-pricing.js`
  - `checkout-stock.js`
  - `checkout-payment.js`
  - `checkout-shipping.js`
  - `checkout-response.mapper.js`

Checklist:

- [ ] Pindahkan analytics admin ke service khusus.
- [ ] Pindahkan report/export admin ke service khusus.
- [ ] Pindahkan moderation admin ke service khusus.
- [ ] Ekstrak payment dan shipping step dari checkout service.
- [ ] Pastikan controller tetap memanggil API service yang sama agar frontend
      tidak berubah.

### 2. Dependency Inversion Masih Lemah

Severity: tinggi.

Bukti:

- Banyak service langsung import `../../config/supabase`.
- `checkout.service.js` langsung import `sendPaymentRequest`,
  `triggerShipping`, dan notification service.
- `orders.service.js` langsung import `axios`, env, Gateway target, Supabase,
  audit log, integration log, dan shipping integration.

Dampak:

- Sulit mengetes checkout tanpa koneksi Supabase atau mock manual besar.
- Sulit mengganti payment/logistics provider tanpa mengubah service utama.
- Business logic bercampur dengan detail infrastruktur.

Rekomendasi:

- Buat adapter/repository tipis:
  - `order.repository.js`
  - `product.repository.js`
  - `payment.gateway.js`
  - `shipping.gateway.js`
  - `notification.gateway.js`
- Untuk modul kritis, pakai factory:

```js
const createCheckoutService = ({ db, payment, shipping, notifications, clock }) => ({
  processCheckout: async (buyerId, payload) => {
    // orchestration only
  },
});
```

Checklist:

- [ ] Mulai dari checkout karena risikonya paling tinggi.
- [ ] Buat adapter payment dan shipping yang membungkus fungsi saat ini.
- [ ] Buat fake adapter untuk unit test checkout sukses/gagal.
- [ ] Setelah checkout stabil, lanjut orders dan admin analytics.

### 3. Order Status dan Role Policy Tersebar

Severity: tinggi.

Bukti:

- `backend/src/modules/orders/order.service.js:8` punya `ORDER_STATUSES`
  tanpa `cancelled`.
- `backend/src/modules/orders/order.service.js:338-358` punya allowed status per
  role secara inline.
- `backend/src/modules/orders/order.service.js:655-684` bisa update order menjadi
  `cancelled`.
- Frontend type `Order.status` sudah memasukkan `cancelled`.

Dampak:

- Filter order berstatus `cancelled` bisa tidak diterima oleh backend karena
  status list tidak sinkron.
- Setiap status baru harus dicari manual di banyak file.
- Ini melanggar Open/Closed Principle: menambah status berarti memodifikasi
  banyak cabang kondisi.

Rekomendasi:

- Buat satu sumber kebenaran:
  `backend/src/modules/orders/order.constants.js`.
- Isi dengan:
  - `ORDER_STATUSES`
  - `PAID_STATUSES`
  - `ORDER_TRANSITIONS`
  - `ROLE_STATUS_POLICY`
- Frontend tetap punya type sendiri, tetapi disinkronkan dengan backend.

Checklist:

- [ ] Tambahkan `cancelled` ke status backend yang relevan.
- [ ] Ekstrak role/status policy dari `order.service.js`.
- [ ] Tambahkan unit test untuk transisi status.
- [ ] Pastikan query/filter order menerima semua status yang valid.

### 4. Checkout Duplikatif dan Sulit Diuji

Severity: tinggi.

Bukti:

- `processLegacyCheckout` dan `processAtomicCheckout` sama-sama melakukan payment,
  update order paid, notifikasi seller, trigger shipping, dan update sync status.
- Keduanya menangani error payment/logistics dengan pola mirip.

Dampak:

- Perbaikan bug di satu alur bisa lupa diterapkan di alur lain.
- Behavior atomic dan legacy bisa makin berbeda dari waktu ke waktu.
- Risiko regression tinggi karena checkout menyentuh stok, pembayaran, order,
  pengiriman, dan notifikasi.

Rekomendasi:

- Jadikan atomic/legacy hanya berbeda pada tahap "buat order dan reserve stok".
- Setelah order tercipta, gunakan flow bersama:
  - `capturePayment(order, payload)`
  - `markPaid(order, transactionId)`
  - `notifySellers(order)`
  - `syncShipping(order, payload)`
  - `buildCheckoutResponse(order, syncResult)`

Checklist:

- [ ] Ekstrak `finalizeCheckoutPayment`.
- [ ] Ekstrak `syncCheckoutShipping`.
- [ ] Ekstrak `buildCheckoutResponse`.
- [ ] Tambahkan test untuk payment gagal dan shipping gagal.

### 5. Helper Response Tidak Aman untuk Data Falsy

Severity: sedang.

Bukti:

`backend/src/utils/response.js:4`:

```js
if (data) response.data = data;
```

Dampak:

- Jika endpoint perlu mengembalikan `0`, `false`, string kosong, atau `null`
  secara eksplisit, field `data` akan hilang.
- Kontrak API bisa tidak konsisten.

Rekomendasi:

Ganti menjadi check terhadap jumlah argumen atau `data !== undefined`:

```js
if (data !== undefined) response.data = data;
```

Checklist:

- [ ] Ubah helper response agar menyertakan data falsy.
- [ ] Cek endpoint delete/update yang mungkin mengembalikan `null` atau boolean.
- [ ] Pastikan frontend tidak bergantung pada hilangnya `data`.

### 6. Middleware Validasi Berpotensi Salah untuk Zod v4

Severity: sedang.

Bukti:

`backend/src/middlewares/validate.js:8` memakai `err.errors`.

Zod v4 umumnya mengekspos detail issue melalui `err.issues`.

Dampak:

- Detail validasi bisa tidak tampil.
- Debug request invalid lebih susah.

Rekomendasi:

Normalisasi error Zod:

```js
const details = err.issues ?? err.errors ?? null;
```

Checklist:

- [ ] Update middleware validate.
- [ ] Tambahkan test validasi untuk body invalid.
- [ ] Pastikan response tetap memakai `VALIDATION_ERROR`.

### 7. Error Handling Menggunakan Plain Object

Severity: sedang.

Bukti:

Banyak service melempar object:

```js
throw { status: 400, code: 'INVALID_STATUS', message: '...' };
```

Dampak:

- Stack trace tidak konsisten.
- Sulit membedakan operational error dan bug runtime.
- Error contract tersebar di banyak file.

Rekomendasi:

Buat helper `AppError` atau `createHttpError`:

```js
class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

Checklist:

- [ ] Tambahkan `backend/src/utils/app-error.js`.
- [ ] Migrasi bertahap mulai dari checkout dan orders.
- [ ] Update `errorHandler` agar menerima `AppError` dan fallback object lama.

### 8. Frontend Component Masih Banyak yang Terlalu Besar

Severity: sedang.

Bukti file terbesar:

- `frontend/components/pk/seller-product-form.tsx`: 662 baris.
- `frontend/components/pk/admin-analytics.tsx`: 598 baris.
- `frontend/app/(main)/profile/page.tsx`: 564 baris.
- `frontend/app/(seller)/seller/orders/page.tsx`: 553 baris.
- `frontend/app/(main)/products/[id]/page.tsx`: 539 baris.
- `frontend/app/(main)/checkout/page.tsx`: 417 baris.

Dampak:

- Page mencampur data fetching, mutation, state UI, validasi, dan rendering.
- Sulit reuse komponen dan sulit membuat test komponen kecil.
- Perubahan UI kecil berisiko mengganggu flow data.

Rekomendasi:

- Ekstrak custom hooks:
  - `useCheckoutFee`
  - `useCheckoutSubmit`
  - `useSellerOrders`
  - `useProductForm`
- Ekstrak komponen presentational:
  - `CheckoutSummary`
  - `CheckoutAddressForm`
  - `SellerOrderFilters`
  - `SellerOrderTable`
  - `AdminMetricGrid`

Checklist:

- [ ] Mulai dari `checkout/page.tsx` karena flow-nya penting.
- [ ] Ekstrak hook data/mutation tanpa mengubah UI.
- [ ] Ekstrak komponen presentational kecil.
- [ ] Jalankan lint setelah tiap refactor kecil.

### 9. Type Frontend Terlalu Tersentralisasi

Severity: sedang.

Bukti:

- `frontend/types/api.ts`: 614 baris, mencampur buyer, seller, admin, order,
  rating, complaint, analytics, dan report.

Dampak:

- Interface Segregation belum maksimal.
- Perubahan type admin bisa membuat konflik import di halaman buyer.
- File menjadi sulit dinavigasi.

Rekomendasi:

Pecah type per domain:

- `frontend/types/common.ts`
- `frontend/types/user.ts`
- `frontend/types/product.ts`
- `frontend/types/order.ts`
- `frontend/types/admin.ts`
- `frontend/types/seller.ts`
- `frontend/types/complaint.ts`
- `frontend/types/rating.ts`

Checklist:

- [ ] Buat file type domain baru.
- [ ] Re-export dari `frontend/types/api.ts` sementara untuk menjaga import lama.
- [ ] Migrasi import bertahap per folder/page.

### 10. Inline Style Banyak dan Mengurangi Konsistensi UI

Severity: rendah-sedang.

Bukti:

- Banyak page dan komponen memakai object `style={{ ... }}` panjang.
- Design token `.pk-*` sudah ada di `frontend/app/globals.css`, tetapi belum
  digunakan merata.

Dampak:

- Duplikasi spacing, ukuran, dan layout.
- Responsive behavior lebih sulit distandardisasi.
- Clean code UI menurun karena JSX menjadi sangat panjang.

Rekomendasi:

- Gunakan class utilitas dan komponen kecil untuk pola yang berulang.
- Pertahankan style inline hanya untuk nilai dinamis.

Checklist:

- [ ] Inventaris pola card/table/filter yang sering muncul.
- [ ] Buat class atau komponen reusable.
- [ ] Hindari refactor visual besar sekaligus.

## Temuan Positif

### Backend

- `app.js` cukup bersih sebagai composition root Express.
- Route per modul sudah jelas.
- Controller rata-rata tipis dan mudah dipahami.
- Schema validasi Zod sudah tersedia untuk endpoint penting.
- Integrasi SmartBank/LogistiKita sudah dipisah dari controller.
- Utility KMP dan fee sudah terisolasi.

### Frontend

- API wrapper sudah per domain: auth, products, checkout, orders, admin, seller,
  notifications, dan lain-lain.
- Zustand store sudah terpisah untuk auth, cart, buyer preferences.
- `getApiBaseUrl()` sudah menyelesaikan masalah base URL `/api`.
- Route guard di `proxy.ts` hanya UX guard; backend tetap sumber otorisasi.
- Design token `.pk-*` sudah ada dan bisa menjadi dasar refactor UI.

## Backlog Perbaikan Bertahap

### P0 - Wajib, Risiko Tinggi

- [ ] Perbaiki lint error frontend di `frontend/app/(main)/chats/page.tsx:63`.
- [ ] Perbaiki `successResponse` agar data falsy tidak hilang.
- [ ] Perbaiki middleware Zod agar memakai `err.issues ?? err.errors`.
- [ ] Tambahkan `cancelled` ke status backend yang relevan dan satukan constants.
- [ ] Ekstrak order status policy dari `order.service.js`.
- [ ] Ekstrak payment/shipping shared flow dari `checkout.service.js`.

### P1 - Refactor untuk Maintainability

- [ ] Pecah `admin.service.js` berdasarkan domain.
- [ ] Pecah `frontend/types/api.ts` berdasarkan domain.
- [ ] Ekstrak hook dan komponen kecil dari checkout page.
- [ ] Ekstrak hook dan komponen kecil dari seller order page.
- [ ] Buat repository/adapter minimal untuk checkout.

### P2 - Kualitas Engineering Lanjutan

- [ ] Tambahkan `AppError` dan migrasi throw object secara bertahap.
- [ ] Tambahkan unit test untuk fee, KMP, order status policy, checkout payment
      failed, checkout shipping failed.
- [ ] Tambahkan integration smoke test backend dengan mocked Supabase/integration
      adapter atau test DB lokal.
- [ ] Pertimbangkan contract test untuk response API yang dipakai frontend.

## Urutan Kerja yang Disarankan

1. Bereskan lint kecil dan helper response/validation.
2. Satukan order constants dan status transition.
3. Refactor checkout menjadi beberapa step reusable.
4. Tambahkan test untuk checkout dan status order.
5. Pecah admin service.
6. Pecah type frontend dan komponen besar secara bertahap.

Urutan ini sengaja dimulai dari perubahan kecil yang dampaknya besar, lalu masuk
ke refactor besar setelah baseline lebih aman.

## Catatan Akhir

Codebase ini sudah punya fondasi yang bagus untuk ukuran tugas besar: domainnya
jelas, route terstruktur, dan fitur sudah cukup banyak. Masalahnya bukan
"berantakan total", melainkan beberapa file sudah melewati batas nyaman dan
mulai menjadi pusat gravitasi terlalu besar. Fokus refactor sebaiknya bukan
mengubah gaya seluruh repo, tetapi memotong bagian yang paling sering berubah:
checkout, order status, admin analytics/report, dan page frontend yang besar.
