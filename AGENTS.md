# AGENTS.md

Instruksi ini berlaku untuk seluruh repo. Untuk pekerjaan di `frontend/`, baca juga
`frontend/AGENTS.md`; file itu memperingatkan bahwa Next.js 16.2 dapat berbeda dari
pengetahuan lama agent dan meminta agent membaca docs Next yang relevan sebelum
menulis kode frontend.

## Gambaran Umum Project

PasarKita adalah marketplace digital untuk produk UMKM. README menjelaskan peran
project ini sebagai Demand Generator B2C dalam ekosistem microservices antar
kelompok: frontend Next.js, backend Express API, database Supabase PostgreSQL, dan
integrasi pembayaran/pengiriman melalui API Gateway menuju SmartBank dan
LogistiKita.

Repo ini adalah monorepo sederhana dengan dua aplikasi utama:

- `frontend/`: aplikasi marketplace berbasis Next.js App Router.
- `backend/`: REST API Express yang dibungkus `serverless-http` untuk Vercel.

Folder `mock/` saat ini hanya berisi `mock/docs/prd-mock.md`. Implementasi mock
server yang disebut di README/PRD tidak ditemukan di workspace ini.

## Tech Stack

Frontend (`frontend/package.json`):

- Next.js `16.2.4`, React `19.2.4`, TypeScript strict.
- Tailwind CSS v4, `shadcn`/Base UI, `lucide-react`, `sonner`.
- Zustand untuk auth/cart, TanStack Query untuk server state, Axios untuk HTTP.
- React Hook Form dan Zod untuk form/validasi.

Backend (`backend/package.json`):

- Node.js CommonJS, Express `5.2.1`, `serverless-http`.
- Supabase JS v2, bcrypt, jsonwebtoken, zod, axios, cors, dotenv.
- Nodemon untuk development.

Database/deploy:

- Supabase PostgreSQL.
- Vercel project terpisah untuk `frontend` dan `backend`.
- README menyebut prasyarat Node.js v18+.

## Struktur Folder Penting

- `README.md`: gambaran arsitektur, endpoint, env, deploy, dan role.
- `backend/api/index.js`: entry serverless Vercel dan fallback local server.
- `backend/src/app.js`: Express app, middleware global, mount route `/api/*`.
- `backend/src/modules/*`: modul `auth`, `products`, `checkout`, `orders`, `admin`.
- `backend/src/config`: validasi env dan client Supabase.
- `backend/src/middlewares`: auth JWT/role, validation, error handler.
- `backend/src/integrations`: wrapper SmartBank dan LogistiKita via API Gateway.
- `backend/database.sql`: SQL yang ditemukan untuk `orders` dan `order_items`.
- `backend/docs/prd-backend.md`: PRD backend yang lebih luas dari kode saat ini.
- `frontend/app`: route groups App Router `(main)`, `(admin)`, `(seller)`, `auth`.
- `frontend/components/pk`: komponen UI PasarKita custom.
- `frontend/components/ui`: komponen shadcn/Base UI.
- `frontend/lib/api.ts` dan `frontend/lib/api/*`: Axios instance dan wrapper API.
- `frontend/store`: Zustand auth/cart.
- `frontend/types/api.ts`: tipe response frontend.
- `frontend/docs/prd-frontend.md`: PRD frontend.
- `mock/docs/prd-mock.md`: rancangan mock server, belum ada implementasi code.

Tidak ditemukan `package.json` di root, folder `migrations`, atau folder test saat
analisis ini dibuat.

## Perintah Development, Build, Test, Lint

Tidak ada script root karena root tidak memiliki `package.json`.

Backend:

```bash
cd backend
npm install
npm run dev
npm start
npm test
```

Catatan backend:

- `npm run dev` menjalankan `nodemon api/index.js`.
- `npm start` menjalankan `node api/index.js`.
- `npm test` saat ini hanya placeholder: `echo "Error: no test specified" && exit 1`.
- `node seed.js` tersedia untuk seed data Supabase, tetapi jangan jalankan ke
  database bersama/production tanpa izin eksplisit.
- `node scratch_test_db.js` tersedia untuk cek koneksi, tetapi script ini mencetak
  sebagian service key; jangan bagikan outputnya.

Frontend:

```bash
cd frontend
npm install
npm run dev
npm run build
npm start
npm run lint
```

Mock server:

- README/PRD menyebut perintah mock, tetapi folder/package mock server tidak
  ditemukan. Jangan mengandalkan command mock sampai implementasinya dikonfirmasi.

## Catatan Arsitektur

Backend:

- Pola modul yang dipakai adalah `routes -> controller -> service`.
- `src/app.js` memasang route `/api/auth`, `/api/products`, `/api/checkout`,
  `/api/orders`, `/api/admin`, dan `/api/health`.
- Auth memakai JWT Bearer token. Middleware role tersedia untuk `seller` dan
  `superadmin`.
- Controller memakai `successResponse`; error dilempar ke `errorHandler`.
- Service langsung memakai Supabase service-role client.
- `checkout.service.js` saat ini melakukan checkout dummy: membuat order `paid`,
  membuat `order_items`, dan mengurangi stok. Wrapper integrasi SmartBank dan
  LogistiKita ada, tetapi tidak dipanggil oleh checkout service saat ini.

Frontend:

- App Router memakai route group `(main)`, `(admin)`, `(seller)`, dan `auth`.
- `middleware.ts` membaca cookie `token` dan decode payload JWT hanya untuk UX
  routing. Otorisasi sebenarnya harus tetap di backend.
- `app/providers.tsx` memasang TanStack Query dengan `staleTime` 30 detik,
  retry 1, dan tanpa refetch on focus.
- `lib/api.ts` membuat Axios instance dari `NEXT_PUBLIC_API_URL`, memasang Bearer
  token dari Zustand auth store, dan logout otomatis pada HTTP 401.
- Styling banyak memakai design system custom `.pk-*` di `app/globals.css` dan
  komponen `components/pk/*`.

## Konvensi Penulisan Kode

- Ikuti pola lokal sebelum menambah abstraksi baru.
- Backend memakai CommonJS (`require`, `module.exports`), bukan ESM.
- Untuk endpoint backend baru, tambah route/controller/service yang konsisten,
  validasi input dengan Zod jika ada body, dan gunakan response/error shape yang
  sama.
- Tetap enforce auth dan ownership di backend service, bukan hanya di frontend
  middleware.
- Frontend memakai TypeScript strict dan alias `@/*`.
- Tambahkan `"use client"` hanya pada komponen yang memakai hook/browser API.
- Jaga wrapper `frontend/lib/api/*`, `frontend/types/api.ts`, dan response backend
  tetap sinkron.
- Gunakan komponen/design token yang sudah ada (`components/pk`, `.pk-*`,
  `components/ui`, `lib/utils.ts`) sebelum membuat style baru.
- Jangan mengedit `node_modules`, `.next`, file generated, atau dependency lockfile
  kecuali task memang membutuhkan perubahan dependency.

## Database dan Environment

Backend env yang divalidasi oleh `backend/src/config/env.js`:

- Wajib: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`.
- Opsional: `GATEWAY_BASE_URL`, `GATEWAY_API_KEY`.
- `PORT` default ke `3001`.

`backend/.env.example` juga memuat `SUPABASE_ANON_KEY` dan `NODE_ENV`. README
menyebut `SMARTBANK_URL` dan `LOGISTIKITA_URL`, tetapi current backend code
memakai `GATEWAY_BASE_URL` dan `GATEWAY_API_KEY` untuk integrasi.

Frontend env:

- `NEXT_PUBLIC_API_URL` dipakai oleh Axios instance.
- File `frontend/.env.example` tidak ditemukan.

Catatan penting:

- `backend/.env` ada dan terdaftar di git index saat analisis. Perlakukan sebagai
  sensitif: jangan tampilkan nilainya, jangan menyalin rahasia ke output, dan
  jangan menambah secret baru ke git.
- `frontend/.env.local` ada secara lokal tetapi tidak terdaftar di git index.
- `backend/database.sql` hanya membuat `orders` dan `order_items`. Schema SQL untuk
  `users` dan `products` tidak ditemukan sebagai migration/file SQL terpisah,
  walaupun `seed.js` dan service backend mengasumsikan tabel tersebut ada.
- Tidak ditemukan folder migration. PRD backend memiliki referensi schema yang
  lebih lengkap, tetapi bukan migration executable.

## Testing dan Verifikasi

Tidak ada test suite nyata yang ditemukan.

Verifikasi backend yang disarankan:

- Jalankan `cd backend && npm run dev`.
- Cek `GET /api/health`.
- Smoke test auth, products, checkout, orders, dan admin sesuai role.
- Jika menyentuh database, verifikasi di Supabase non-production atau environment
  yang memang disetujui.

Verifikasi frontend yang disarankan:

- Jalankan `cd frontend && npm run lint`.
- Jalankan `cd frontend && npm run build`.
- Smoke test manual: register/login, browse produk, detail produk, checkout,
  daftar/detail orders, seller products, admin users/analytics.

Jika mengubah kontrak API, uji backend dan frontend bersama karena beberapa tipe
frontend dan payload wrapper belum sepenuhnya cocok dengan backend saat ini.

## Aturan Keamanan untuk AI Agent

- Jangan membaca atau mencetak `.env` kecuali benar-benar diperlukan; jika terbaca,
  jangan ulangi nilainya di chat, log, commit, atau dokumentasi.
- Jangan memasukkan service-role key, JWT secret, gateway API key, atau token user
  ke frontend/client code.
- Jangan melemahkan middleware auth, role guard, ownership check, atau validasi
  input untuk membuat fitur "cepat jalan".
- Jangan menjalankan seed, query destruktif, atau perubahan schema ke database
  bersama/production tanpa izin eksplisit.
- Perlakukan checkout, payment, fee, stok, dan status order sebagai area berisiko
  tinggi; jaga idempotensi dan rollback jika implementasi payment asli ditambah.
- Frontend middleware hanya UX guard; semua keamanan tetap wajib di backend.
- Jangan mengubah file dependency/generated (`node_modules`, `.next`) secara manual.

## Workflow yang Direkomendasikan untuk Task Berikutnya

1. Baca `AGENTS.md` ini, lalu baca nested instruction yang relevan seperti
   `frontend/AGENTS.md`.
2. Cek `git status --short` sebelum mengubah file dan jangan revert perubahan user.
3. Baca file PRD dan source yang relevan dengan task, bukan seluruh repo tanpa
   tujuan.
4. Pastikan kontrak frontend-backend dan env base URL sebelum implementasi.
5. Buat perubahan kecil dan terlokalisir mengikuti pola folder setempat.
6. Jalankan lint/build/test yang tersedia untuk area yang disentuh.
7. Dokumentasikan gap atau verifikasi yang tidak bisa dilakukan.

## Hal yang Belum Jelas / Perlu Dikonfirmasi

- Tidak ada `package.json` root, sehingga tidak ada command monorepo root.
- Mock server yang dideskripsikan README/PRD tidak ditemukan implementasinya.
- Tidak ada test files atau test framework yang dikonfigurasi eksplisit.
- Tidak ada migration directory; hanya `backend/database.sql` untuk sebagian tabel.
- README mencantumkan `/api/fee/calculate`, dan frontend punya
  `checkoutApi.calculateFee`, tetapi backend tidak memasang route fee.
- Nilai `NEXT_PUBLIC_API_URL` perlu dikonfirmasi apakah harus menyertakan `/api`.
  Backend route berada di `/api/*`, sementara wrapper frontend memanggil path
  seperti `/products`; beberapa page fallback ke `http://localhost:3001/api`.
- Tipe/payload frontend tidak semuanya cocok dengan backend saat ini, terutama
  checkout dan order response.
- Admin `updateUserStatus` masih dummy, analytics `top_products` kosong, dan route
  UI `/admin/orders` serta `/seller/orders` muncul di sidebar tetapi file page-nya
  tidak ditemukan.
- Integrasi SmartBank/LogistiKita ada sebagai wrapper, tetapi alur checkout saat ini
  belum memakainya.
