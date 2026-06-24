# Tabel Temuan SOLID dan Clean Code PasarKita

Tanggal audit: 24 Juni 2026

Dokumen ini adalah versi tabel dari audit SOLID dan Clean Code. Tujuannya agar
temuan lebih mudah dipindahkan ke backlog, laporan, atau pembagian tugas tim.

| No | File/Method | Masalah Kode | Prinsip Terkait | Dampak Negatif |
|---:|---|---|---|---|
| 1 | `backend/src/modules/admin/admin.service.js` | File terlalu besar dan menangani user management, moderation, analytics, report, audit log, health score, anomaly detection, dan fee simulation dalam satu service. | SRP, Clean Code | Sulit dibaca, sulit dites, dan perubahan kecil berisiko mengganggu fitur admin lain. |
| 2 | `backend/src/modules/orders/order.service.js` | File menangani query order, authorization, status transition, seller projection, shipping sync, export CSV, tracking, dan cancel order sekaligus. | SRP, Clean Code | Business logic order menjadi padat dan rawan regression saat flow pesanan berubah. |
| 3 | `backend/src/modules/products/product.service.js` | Service mencampur upload gambar, katalog public, seller inventory, search KMP, sorting rating/terlaris, CRUD produk, dan export CSV. | SRP | Perubahan fitur katalog atau seller product bisa saling memengaruhi karena berada dalam satu modul besar. |
| 4 | `backend/src/modules/checkout/checkout.service.js` - `processLegacyCheckout` dan `processAtomicCheckout` | Alur payment, update order paid, notifikasi seller, trigger shipping, dan sync status berulang pada atomic dan legacy checkout. | DRY, SRP | Bug fix di satu alur dapat lupa diterapkan di alur lain sehingga behavior checkout tidak konsisten. |
| 5 | `backend/src/modules/checkout/checkout.service.js` | Service langsung bergantung pada Supabase, SmartBank integration, LogistiKita integration, dan notification service. | DIP | Unit test checkout sulit dibuat tanpa mock besar atau koneksi service eksternal. |
| 6 | `backend/src/modules/orders/order.service.js` - `ORDER_STATUSES` | Daftar status order tidak memasukkan `cancelled`, padahal method `cancelOrder` mengubah status menjadi `cancelled`. | OCP, Clean Code | Filter atau validasi status bisa tidak sinkron dan fitur cancel order rawan gagal di bagian lain. |
| 7 | `backend/src/modules/orders/order.service.js` - `updateOrderStatus` | Policy status per role ditulis inline dalam method. | OCP, SRP | Menambah status atau role baru harus mengubah banyak cabang kondisi dan rawan salah izin. |
| 8 | `backend/src/utils/response.js` - `successResponse` | Field `data` hanya dikirim jika truthy dengan `if (data)`. | Clean Code, Contract Consistency | Response dengan `0`, `false`, string kosong, atau `null` akan kehilangan field `data`. |
| 9 | `backend/src/utils/response.js` - `errorResponse` | Field `details` hanya dikirim jika truthy dengan `if (details)`. | Clean Code | Detail error bernilai kosong atau false bisa hilang sehingga debugging kurang jelas. |
| 10 | `backend/src/middlewares/validate.js` | Middleware memakai `err.errors`, sementara Zod v4 umum memakai `err.issues`. | Clean Code, Robustness | Detail validasi bisa tidak muncul pada response error. |
| 11 | Banyak service backend | Error dilempar sebagai plain object, misalnya `throw { status, code, message }`. | Clean Code | Stack trace tidak konsisten dan sulit membedakan operational error dari bug runtime. |
| 12 | `backend/src/modules/admin/admin.service.js` - `getAnalytics` | Method melakukan fetch data, agregasi, comparison, funnel, anomaly, health score, dan response shaping dalam satu blok besar. | SRP, Clean Code | Sulit menambah metrik baru tanpa memperbesar kompleksitas dan risiko bug analytics. |
| 13 | `backend/src/modules/admin/admin.service.js` - `buildReport` dan `exportReport` | Report builder dan export CSV berada dalam service admin utama. | SRP | Fitur laporan sulit dikembangkan independen dari fitur admin lain. |
| 14 | `backend/src/modules/orders/order.service.js` - `syncShipping` | Method menggabungkan create shipping, update tracking, call Gateway, write integration log, dan update sync status. | SRP, DIP | Sulit mengganti mekanisme shipping atau mengetes retry shipping secara terisolasi. |
| 15 | `backend/src/modules/fee/fee.controller.js` | Controller melakukan akses Supabase langsung untuk mengambil produk dan menghitung fee. | Layering, SRP | Controller tidak lagi tipis; logic fee sulit dipakai ulang di tempat lain. |
| 16 | `backend/src/config/env.js` | Config melakukan `console.log` saat load env. | Clean Code, Security Hygiene | Log env bisa menjadi kebiasaan berbahaya jika nanti menampilkan informasi sensitif lain. |
| 17 | `frontend/types/api.ts` | Semua type API buyer, seller, admin, order, analytics, rating, complaint, dan report dikumpulkan dalam satu file besar. | ISP, Clean Code | File sulit dinavigasi dan perubahan type domain tertentu bisa mengganggu import domain lain. |
| 18 | `frontend/components/pk/seller-product-form.tsx` | Komponen sangat besar dan mencampur form state, upload image, validation, navigation guard, dan rendering UI. | SRP, Clean Code | Sulit dites dan sulit reuse bagian form untuk create/edit flow lain. |
| 19 | `frontend/components/pk/admin-analytics.tsx` | Komponen besar berisi rendering banyak metrik, chart-like blocks, dan logic tampilan analytics. | SRP | UI analytics sulit dipelihara ketika metrik atau layout berubah. |
| 20 | `frontend/app/(main)/checkout/page.tsx` | Page mencampur cart state, fee calculation, address handling, idempotency key, confirmation, mutation checkout, dan rendering. | SRP | Flow checkout sulit dites dan rawan rusak saat mengubah tampilan atau validasi. |
| 21 | `frontend/app/(seller)/seller/orders/page.tsx` | Page menggabungkan filter, fetch list order, mutation ship/retry, export, dan tabel UI. | SRP | Perubahan workflow seller order dapat memicu bug UI list, filter, atau export. |
| 22 | Banyak page/component frontend | Banyak inline style panjang langsung di JSX. | Clean Code | JSX menjadi panjang, style sulit distandardisasi, dan responsive behavior sulit dijaga. |
| 23 | `frontend/app/(main)/chats/page.tsx` | Ada lint error `react/no-unescaped-entities` pada teks dengan tanda kutip langsung. | Clean Code | Frontend lint gagal sehingga CI/build quality gate bisa terhambat. |
| 24 | `frontend/components/pk/rating-modal.tsx` | Ada variable `setUploading` yang tidak digunakan. | Clean Code | Menambah noise dan warning lint yang menurunkan kualitas kode. |
| 25 | `backend/package.json` - `npm test` | Script test masih placeholder dan selalu gagal. | Clean Code, Testability | Regression sulit dideteksi otomatis, terutama pada checkout, order status, dan admin flow. |

## Prioritas Pengerjaan

| Prioritas | Temuan | Alasan |
|---|---|---|
| P0 | No. 4, 5, 6, 7, 8, 10, 23 | Berdampak langsung pada checkout, status order, kontrak API, dan lint. |
| P1 | No. 1, 2, 12, 14, 17, 20, 21 | Refactor besar untuk maintainability area yang sering berubah. |
| P2 | No. 3, 9, 11, 13, 15, 16, 18, 19, 22, 24, 25 | Peningkatan kualitas lanjutan setelah risiko utama stabil. |

## Saran Urutan Singkat

1. Perbaiki lint error dan warning kecil yang mudah.
2. Perbaiki helper response dan middleware validasi.
3. Satukan constants status order dan role policy.
4. Refactor checkout agar payment/shipping flow tidak duplikatif.
5. Pecah admin service dan type frontend secara bertahap.
6. Tambahkan test minimal untuk area checkout, order status, fee, dan KMP.
