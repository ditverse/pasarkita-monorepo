# Rancangan Implementasi Fitur Chat (Pembeli & Penjual)

Dokumen ini menguraikan rancangan desain dan rencana implementasi untuk fitur percakapan (chat) antara Pembeli (Buyer) dan Penjual (Seller) di platform PasarKita. Fitur ini dirancang untuk mendukung dua konteks utama: diskusi terkait produk dan diskusi terkait pesanan.

## 1. Catatan Isu & Perbaikan (Schema Cache Error)

**Status Saat Ini:** Pengguna mengalami error `Could not find the table 'public.order_chat_messages' in the schema cache` saat membuka form chat.
**Penyebab:** Frontend dan backend (API routes, controller, service) untuk fitur chat sudah selesai diimplementasikan, dan file migrasi database juga sudah dibuat (`013_order_chat.sql` dan `014_product_chat.sql`). Namun, **tabel-tabel tersebut belum dieksekusi / di-apply ke dalam database aktif Supabase** dan tidak terdaftar di `000_full_schema.sql`.
**Solusi:** Tabel-tabel tersebut perlu dieksekusi di SQL Editor Supabase agar *schema cache* terbarui dan aplikasi bisa berjalan normal. Struktur tabel telah didokumentasikan pada bagian 3.

## 2. Konteks Fitur

Berdasarkan struktur backend yang telah tersedia, fitur chat dibagi menjadi dua kategori:
1. **Chat Berbasis Produk:** Pembeli dapat menanyakan detail produk langsung dari halaman produk kepada penjual.
2. **Chat Berbasis Pesanan:** Pembeli dan penjual dapat berkomunikasi terkait status atau kendala dari sebuah pesanan yang sudah dibuat.

## 3. Struktur Data dan API (Backend)

Backend saat ini telah menyediakan rute API dasar (`/api/chats`) untuk mendukung fitur ini, yang terdiri dari:

### Chat Berbasis Produk
- `GET /api/chats/products/threads`: Mengambil daftar percakapan (inbox) pengguna.
- `POST /api/chats/products/:productId/start`: Memulai percakapan baru berdasarkan produk tertentu.
- `GET /api/chats/products/threads/:threadId/messages`: Mengambil histori pesan dari sebuah percakapan.
- `POST /api/chats/products/threads/:threadId/messages`: Mengirim pesan baru ke percakapan tertentu.

### Chat Berbasis Pesanan
- `GET /api/chats/orders/:orderId/messages`: Mengambil histori pesan untuk pesanan tertentu.
- `POST /api/chats/orders/:orderId/messages`: Mengirim pesan terkait pesanan.

## 4. Struktur Database

Berdasarkan file migrasi `013_order_chat.sql` dan `014_product_chat.sql`, fitur ini membutuhkan tiga tabel utama:

### 4.1. Tabel Chat Pesanan (Order Chat)
Percakapan pesanan tidak memerlukan tabel ruang obrolan (thread) terpisah, karena ID pesanan (`order_id`) bertindak sebagai ruang obrolannya.
- **`order_chat_messages`**
  - `id` (UUID, Primary Key)
  - `order_id` (UUID, Foreign Key ke `orders(id)`)
  - `sender_id` (UUID, Foreign Key ke `users(id)`)
  - `content` (TEXT)
  - `created_at` (TIMESTAMPTZ)

### 4.2. Tabel Chat Produk (Product Chat)
Percakapan berbasis produk (sebelum pembelian) membutuhkan tabel pengelompokan (thread) yang mengikat Pembeli, Penjual, dan Produk.
- **`product_chat_threads`**
  - `id` (UUID, Primary Key)
  - `product_id` (UUID, Foreign Key ke `products(id)`)
  - `buyer_id` (UUID, Foreign Key ke `users(id)`)
  - `seller_id` (UUID, Foreign Key ke `users(id)`)
  - `created_at`, `updated_at` (TIMESTAMPTZ)
  - *Unique constraint* pada `(product_id, buyer_id, seller_id)`.

- **`product_chat_messages`**
  - `id` (UUID, Primary Key)
  - `thread_id` (UUID, Foreign Key ke `product_chat_threads(id)`)
  - `sender_id` (UUID, Foreign Key ke `users(id)`)
  - `content` (TEXT)
  - `created_at` (TIMESTAMPTZ)

Semua tabel di atas sudah dikonfigurasi dengan *Row Level Security* (RLS) di mana hanya pembeli terkait dan penjual terkait yang dapat membaca maupun mengirim pesan.

## 5. Alur Pengguna (User Flow)

### A. Pembeli (Buyer)
1. **Memulai Chat (Produk):** Pada halaman detail produk, terdapat tombol "Chat Penjual". Jika diklik, sistem akan memanggil endpoint `startProductChat`, lalu mengarahkan pembeli ke halaman ruang obrolan.
2. **Memulai Chat (Pesanan):** Pada halaman detail pesanan, terdapat panel obrolan yang memungkinkan pembeli mengirim pesan atau pertanyaan terkait pesanan tersebut.
3. **Melihat Inbox:** Pembeli memiliki halaman Inbox (misal: `/inbox` atau `/messages`) untuk melihat daftar percakapan aktif dengan berbagai penjual.

### B. Penjual (Seller)
1. **Manajemen Inbox:** Penjual memiliki menu "Pesan" di dasbor penjual (misal: `/seller/messages`). Halaman ini menampilkan daftar percakapan dari berbagai pembeli, dikelompokkan berdasarkan produk atau pesanan.
2. **Membalas Pesan:** Penjual dapat memilih salah satu percakapan untuk melihat histori dan mengirim balasan. Antarmuka akan menampilkan detail produk atau pesanan terkait di sebelah ruang obrolan agar penjual memiliki konteks yang jelas.

## 6. Mekanisme Real-time

Untuk memastikan pesan masuk tanpa perlu memuat ulang halaman, disarankan menggunakan salah satu pendekatan berikut:

1. **Pendekatan Supabase Realtime (Direkomendasikan):** 
   Karena proyek menggunakan Supabase, frontend dapat berlangganan (subscribe) pada perubahan tabel yang terkait dengan pesan menggunakan klien Supabase. Ketika ada baris baru (pesan baru) yang sesuai, antarmuka akan langsung memperbarui daftar pesan.
2. **Pendekatan Polling (Alternatif):** 
   Jika Supabase Realtime belum dapat dikonfigurasi, frontend dapat menggunakan TanStack Query (`useQuery`) dengan fitur `refetchInterval` (misalnya setiap 5 detik) saat pengguna berada di dalam ruang obrolan yang aktif.

## 7. Struktur Komponen Frontend

Untuk menjaga struktur kode agar tetap modular, implementasi di antarmuka (`Next.js`) akan dibagi menjadi beberapa komponen utama:

- `ChatInbox`: Komponen daftar percakapan (sidebar) yang menampilkan ringkasan pesan terakhir, nama lawan bicara, dan penanda waktu.
- `ChatRoom`: Komponen utama ruang obrolan yang berisi kumpulan pesan (`MessageBubble`) dan formulir input pesan.
- `MessageInput`: Komponen area teks dengan tombol kirim untuk mengetik pesan.
- `ChatContextPanel`: Panel referensi di bagian atas atau samping ruang obrolan yang menampilkan informasi produk (gambar, nama, harga) atau informasi ringkas pesanan.

## 8. Tahapan Implementasi Frontend

1. **Persiapan Tipe Data:** Mendefinisikan antarmuka TypeScript di `types/api.ts` untuk data `Thread`, `Message`, dan struktur respons API chat.
2. **Pembuatan Hooks:** Membuat hook kustom menggunakan TanStack Query (seperti `useChatThreads`, `useChatMessages`, `useSendMessage`) untuk menangani siklus pengambilan dan pengiriman data.
3. **Pengembangan UI Pembeli:**
   - Menyisipkan tombol "Chat Penjual" pada antarmuka halaman detail produk.
   - Mengembangkan halaman khusus inbox bagi pembeli.
4. **Pengembangan UI Penjual:**
   - Membangun halaman antarmuka dasbor `/seller/messages` dengan tata letak layar terbagi (kiri untuk daftar pesan, kanan untuk ruang obrolan).
5. **Integrasi Real-time:** Menerapkan fungsi langganan Supabase atau metode polling pada komponen ruang obrolan.
6. **Pengujian Fungsionalitas:** Menguji skenario komunikasi dua arah, memverifikasi pesan dari pembeli diterima dengan benar di sisi penjual, dan mengonfirmasi stabilitas pembaruan data.
