# AGENTS.md

Instruksi ini berlaku untuk seluruh repo. Untuk pekerjaan di `frontend/`, baca juga
`frontend/AGENTS.md`; file itu memperingatkan bahwa Next.js 16.2 dapat berbeda dari
pengetahuan lama agent dan meminta agent membaca docs Next yang relevan sebelum
menulis kode frontend.

Dokumen ini ditulis berdasarkan scan workspace pada 2026-06-24. Jika struktur
repo berubah, verifikasi ulang dengan source code, bukan hanya README/PRD.

## Gambaran Umum Project

PasarKita adalah marketplace digital produk UMKM untuk tugas besar Rekayasa
Perangkat Lunak 2. Di ekosistem antar aplikasi, PasarKita berperan sebagai
Demand Generator B2C yang berkomunikasi dengan:

- SmartBank untuk pembayaran.
- LogistiKita untuk pengiriman.
- API Gateway sebagai jalur integrasi antar service ketika integration target
  produksi/staging sudah tersedia.

Repo ini berisi tiga aplikasi lokal utama:

- `frontend/`: marketplace Next.js App Router.
- `backend/`: REST API Express yang dibungkus `serverless-http` untuk Vercel.
- `mock/`: mock server Express lokal untuk SmartBank dan LogistiKita.

Root tidak memiliki `package.json`, jadi tidak ada script monorepo root. Root
memiliki `package-lock.json`, tetapi script operasional tetap berada di
`frontend/`, `backend/`, dan `mock/`.

## Tech Stack

Frontend (`frontend/package.json`):

- Next.js `16.2.4`, React `19.2.4`, TypeScript strict.
- Tailwind CSS v4, `shadcn`/Base UI, `lucide-react`, `sonner`.
- Zustand untuk auth/cart, TanStack Query untuk server state, Axios untuk HTTP.
- React Hook Form dan Zod untuk form/validasi.

Backend (`backend/package.json`):

- Node.js CommonJS, Express `5.2.1`, `serverless-http`.
- Supabase JS v2, bcrypt, jsonwebtoken, zod, axios, cors, dotenv.
- Multer untuk upload gambar, pg untuk migration runner, nodemon untuk dev.

Mock (`mock/package.json`):

- Express `5.2.1`, cors, concurrently.
- CommonJS, file JSON lokal sebagai state mock.

Database/deploy:

- Supabase PostgreSQL.
- Vercel project terpisah untuk `frontend` dan `backend`.
- README menyebut prasyarat Node.js v18+.

## Struktur Folder Penting

- `README.md`: gambaran arsitektur, endpoint, env, deploy, dan role.
- `backend/api/index.js`: entry serverless Vercel dan fallback local server.
- `backend/src/app.js`: Express app, middleware global, mount route `/api/*`.
- `backend/src/modules/*`: modul fitur backend.
- `backend/src/config`: validasi env dan client Supabase.
- `backend/src/middlewares`: auth JWT/role, validation, error handler.
- `backend/src/integrations`: target SmartBank/LogistiKita via direct mock dev
  atau API Gateway.
- `backend/src/utils`: response helper, fee, observability, KMP search.
- `backend/database/`: baseline schema lengkap, migration berurutan, runner
  `psql`, dan verifikasi schema Supabase.
- `backend/docs/prd-backend.md`: PRD backend yang lebih luas dari kode saat ini.
- `frontend/app`: route groups App Router `(main)`, `(admin)`, `(seller)`, `auth`.
- `frontend/proxy.ts`: UX route guard berbasis cookie token dan decode JWT tanpa
  verifikasi; otorisasi asli tetap di backend.
- `frontend/components/pk`: komponen UI PasarKita custom.
- `frontend/components/ui`: komponen shadcn/Base UI.
- `frontend/lib/api.ts` dan `frontend/lib/api/*`: Axios instance dan wrapper API.
- `frontend/lib/api-base-url.ts`: normalisasi `NEXT_PUBLIC_API_URL` agar berakhir
  dengan `/api`.
- `frontend/store`: Zustand auth/cart/buyer preferences.
- `frontend/types/api.ts`: tipe response frontend.
- `frontend/docs/prd-frontend.md`: PRD frontend.
- `mock/server.js`: menjalankan mock SmartBank di `:4001` dan LogistiKita di
  `:4002`.
- `mock/smartbank/*`: dashboard, route, dan state mock pembayaran.
- `mock/logistikita/*`: dashboard, route, dan state mock pengiriman.
- `mock/docs/prd-mock.md`: rancangan mock server.
- `docs/`: dokumentasi review, roadmap fitur, dan catatan algoritma.

## Perintah Development, Build, Test, Lint

Tidak ada script root karena root tidak memiliki `package.json`.

Backend:

```bash
cd backend
npm install
npm run dev
npm start
npm run db:migrate
npm run db:verify
npm run seed:demo
npm test
```

Catatan backend:

- `npm run dev` menjalankan `nodemon api/index.js`.
- `npm start` menjalankan `node api/index.js`.
- `npm run db:migrate` memerlukan `DATABASE_URL`; jangan jalankan ke database
  bersama/production tanpa izin eksplisit.
- `npm run db:verify` memeriksa schema Supabase aktif.
- `npm run seed:demo` mengisi data demo; jangan jalankan ke database
  bersama/production tanpa izin eksplisit.
- `npm test` saat ini hanya placeholder:
  `echo "Error: no test specified" && exit 1`.
- `node seed.js` dan `node scratch_test_db.js` ada. Jangan menjalankan script yang
  menyentuh database/secrets tanpa kebutuhan jelas; jangan bagikan output secret.

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

```bash
cd mock
npm install
npm run dev
# atau npm start
```

Catatan mock:

- SmartBank berjalan di `http://localhost:4001/smartbank`.
- LogistiKita berjalan di `http://localhost:4002/logistikita`.
- Dashboard mock tersedia di root masing-masing service:
  `http://localhost:4001/smartbank` dan `http://localhost:4002/logistikita`.
- README masih bisa menyebut `cd backend/mock`; source code saat ini memakai
  folder root `mock/`.

## Workflow Aplikasi Saat Ini

Alur pembeli:

1. Pembeli register/login melalui `/api/auth`.
2. Frontend menyimpan token di Zustand auth store dan cookie untuk UX routing.
3. Produk dibaca dari `/api/products`; detail produk, toko publik, rating, dan
   chat produk tersedia di halaman buyer.
4. Cart dikelola di frontend store.
5. Checkout page menghitung fee lewat `POST /api/fee/calculate`, lalu membuat
   checkout lewat `POST /api/checkout`.
6. Backend membuat order pending, menyimpan item, mengurangi/reserve stok,
   memanggil SmartBank, lalu trigger LogistiKita jika payment sukses.
7. Pembeli melihat daftar/detail order, tracking, chat order, komplain, rating,
   dan konfirmasi delivered.

Alur checkout backend:

- `checkout.service.js` mencoba RPC Supabase `create_checkout_order` dari migration
  `003_checkout_hardening.sql`.
- Jika RPC belum tersedia, service fallback ke legacy checkout.
- Payment dikirim via `sendPaymentRequest` ke SmartBank/direct mock atau API
  Gateway berdasarkan `getIntegrationTarget`.
- Jika payment gagal, order menjadi `payment_failed` dan stok dilepas/di-rollback.
- Jika payment sukses, order menjadi `paid`, `transaction_id` disimpan, seller
  dinotifikasi, lalu LogistiKita dipanggil.
- Jika LogistiKita gagal/timeout, order tetap `paid`; sync status disimpan sebagai
  `failed` supaya seller/admin bisa retry.
- Checkout menerima `idempotency_key`; jaga sifat idempotent jika mengubah alur ini.

Alur seller:

- Seller mengelola produk sendiri melalui `/api/products/mine` dan upload gambar.
- Seller dashboard memakai `/api/seller/analytics`, review, profil toko, logo,
  vacation mode, dan fulfillment order.
- Seller order dapat diproses dari `paid` ke `processing`, lalu dikirim/di-retry
  shipping. Order multi-toko dibatasi oleh scope seller di service.
- Seller juga memiliki chat, komplain, reviews, dan packing list.

Alur admin:

- Superadmin mengakses users, moderation sellers/products, orders, analytics,
  audit logs, reports, fee simulator, complaints, action center, dan health center.
- Admin service sudah memakai audit log untuk beberapa aksi dan KMP search untuk
  pencarian yang menghindari pola ILIKE tertentu.

Alur mock:

- SmartBank mock menyediakan payment, balance, topup, reset, state dashboard,
  cooldown transaksi 10 detik, dan limit harian 10 transaksi per user.
- LogistiKita mock menyediakan create shipping, update status, read tracking, dan
  reset state.
- SmartBank mock dapat mengambil daftar user dari backend dev endpoint
  `/api/dev/users` jika `NODE_ENV=development` dan `MOCK_DEV_SECRET` cocok.

## Endpoint Backend Utama

`backend/src/app.js` memasang:

- `GET /api/health`
- `/api/auth`
- `/api/profile`
- `/api/products`
- `/api/checkout`
- `/api/orders`
- `/api/admin`
- `/api/fee`
- `/api/smartbank`
- `/api/ratings`
- `/api/notifications`
- `/api/seller`
- `/api/complaints`
- `/api/chats`

Pola modul yang dipakai adalah `routes -> controller -> service`. Untuk endpoint
baru, ikuti pola ini, gunakan Zod schema jika ada body/query kompleks, dan pakai
response/error shape lokal.

## Kontrak Frontend-Backend

- Axios instance ada di `frontend/lib/api.ts`.
- Base URL dinormalisasi oleh `frontend/lib/api-base-url.ts`; `NEXT_PUBLIC_API_URL`
  boleh berupa origin backend tanpa `/api` atau sudah termasuk `/api`.
- Wrapper API per domain ada di `frontend/lib/api/*`.
- Tipe shared frontend ada di `frontend/types/api.ts`.
- Jika mengubah payload backend, sinkronkan wrapper API, tipe frontend, dan UI page
  yang memakai payload tersebut.
- `successResponse` backend hanya menyertakan `data` jika nilainya truthy; hati-hati
  jika endpoint perlu mengembalikan `0`, `false`, atau array kosong sebagai data.

## Database dan Migration

- Untuk project Supabase baru, gunakan `backend/database/schema/000_full_schema.sql`.
- Untuk database yang sudah ada, jalankan migration berurutan di
  `backend/database/migrations/`.
- `003_checkout_hardening.sql` penting untuk checkout atomik, idempotency, dan RPC
  `create_checkout_order`.
- Migration dibuat idempotent menurut `backend/database/README.md`.
- Jangan menjalankan migration, seed, query destruktif, atau perubahan schema ke
  database bersama/production tanpa izin eksplisit.
- Gunakan `DATABASE_URL` hanya di environment lokal/CI yang disetujui; jangan
  commit atau menampilkan nilainya.

## Environment

Backend env yang divalidasi oleh `backend/src/config/env.js`:

- Wajib: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`.
- Opsional: `GATEWAY_BASE_URL`, `GATEWAY_API_KEY`, `SMARTBANK_URL`,
  `LOGISTIKITA_URL`.
- `NODE_ENV`: `development`, `test`, atau `production`; default `development`.
- `PORT` default ke `3001`.

Frontend env:

- `NEXT_PUBLIC_API_URL` dipakai oleh Axios instance.
- Tidak ditemukan `frontend/.env.example` saat scan ini.

Mock/dev integration env yang umum:

```env
SMARTBANK_URL=http://localhost:4001/smartbank
LOGISTIKITA_URL=http://localhost:4002/logistikita
GATEWAY_BASE_URL=http://localhost:4000
GATEWAY_API_KEY=mock-key
MOCK_DEV_SECRET=mock-dev-secret
```

Catatan penting:

- Jangan membaca atau mencetak `.env` kecuali benar-benar diperlukan.
- Jika secret terbaca, jangan ulangi nilainya di chat, log, commit, atau docs.
- Jangan memasukkan service-role key, JWT secret, gateway API key, atau token user
  ke frontend/client code.
- `backend/src/config/env.js` menulis Supabase URL ke log saat env valid; jangan
  memperluas logging ini ke secret.

## Konvensi Penulisan Kode

- Ikuti pola lokal sebelum menambah abstraksi baru.
- Backend memakai CommonJS (`require`, `module.exports`), bukan ESM.
- Backend controller memakai `successResponse`; error dilempar ke `errorHandler`.
- Tetap enforce auth, role guard, ownership check, dan validasi input di backend,
  bukan hanya di frontend proxy.
- Frontend memakai TypeScript strict dan alias `@/*`.
- Tambahkan `"use client"` hanya pada komponen yang memakai hook/browser API.
- Untuk pekerjaan frontend, baca `frontend/AGENTS.md` dan docs Next lokal yang
  relevan di `node_modules/next/dist/docs/` sebelum menulis kode.
- Gunakan komponen/design token yang sudah ada (`components/pk`, `.pk-*`,
  `components/ui`, `lib/utils.ts`) sebelum membuat style baru.
- Jangan mengedit `node_modules`, `.next`, file generated, atau dependency
  lockfile kecuali task memang membutuhkan perubahan dependency.
- Jangan hardcode URL SmartBank/LogistiKita di frontend; semua komunikasi antar
  service harus lewat backend.
- Untuk API Gateway/contact API, tambahkan integrasi di backend dan pertahankan
  direct mock hanya untuk `NODE_ENV=development`.

## Area Berisiko Tinggi

- Checkout, payment, fee, stok, idempotency, order status, dan shipping sync.
- Auth JWT, role guard, seller ownership, buyer ownership, dan superadmin actions.
- Upload gambar produk/review/logo dan storage Supabase.
- Migration database dan seed data.
- Search/filter admin/seller yang saat ini sebagian dilakukan manual di memory.
- Mock server state JSON; perubahan route mock harus tetap kompatibel dengan
  wrapper backend `smartbank.js`, `logistikita.js`, dan `target.js`.

## Testing dan Verifikasi

Tidak ada test suite nyata yang ditemukan; `backend npm test` masih placeholder.

Verifikasi backend yang disarankan:

- `cd backend && npm run dev`
- Cek `GET /api/health`.
- Smoke test auth, products, fee, checkout, orders, seller, admin, chats,
  complaints, ratings, notifications sesuai role.
- Jika menyentuh database, jalankan `npm run db:verify` hanya pada environment yang
  disetujui.

Verifikasi frontend yang disarankan:

- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- Smoke test manual: register/login, browse produk, detail produk, cart, checkout,
  sukses/gagal checkout, orders, tracking, rating, chat, seller dashboard/products,
  seller orders, admin users/orders/analytics.

Verifikasi mock/integrasi lokal:

1. Jalankan `cd mock && npm run dev`.
2. Jalankan backend dengan env direct mock:
   `SMARTBANK_URL=http://localhost:4001/smartbank` dan
   `LOGISTIKITA_URL=http://localhost:4002/logistikita`.
3. Top up/reset saldo melalui SmartBank dashboard bila perlu.
4. Checkout dari frontend dan pastikan `transaction_id` serta `tracking_id` muncul.
5. Uji payment gagal dengan saldo kurang/cooldown dan pastikan stok/order status
   ditangani benar.

Jika mengubah kontrak API, uji backend dan frontend bersama.

## Workflow yang Direkomendasikan untuk Task Berikutnya

1. Baca `AGENTS.md` ini, lalu baca nested instruction relevan seperti
   `frontend/AGENTS.md`.
2. Cek `git status --short` sebelum mengubah file dan jangan revert perubahan user.
3. Baca README/PRD dan source yang relevan dengan task, bukan seluruh repo tanpa
   tujuan.
4. Pastikan kontrak frontend-backend dan integration target sebelum implementasi.
5. Buat perubahan kecil dan terlokalisir mengikuti pola folder setempat.
6. Jalankan lint/build/test atau smoke test yang tersedia untuk area yang disentuh.
7. Dokumentasikan gap atau verifikasi yang tidak bisa dilakukan.

## Hal yang Perlu Dikonfirmasi Saat Relevan

- API Gateway final/contact API: path, auth header, payload, dan response error
  untuk SmartBank/LogistiKita.
- Environment deploy Vercel: apakah `NEXT_PUBLIC_API_URL` menunjuk origin backend
  atau sudah menyertakan `/api`.
- Apakah database target sudah menjalankan semua migration, terutama checkout
  hardening dan observability.
- Apakah demo memakai direct mock lokal atau Gateway lokal.
- Strategi multi-seller fulfillment jangka panjang; service saat ini membatasi aksi
  seller pada order multi-toko tertentu.
- Test framework belum dikonfigurasi; tambahkan hanya jika task memang meminta atau
  perubahan berisiko membutuhkan coverage otomatis.
