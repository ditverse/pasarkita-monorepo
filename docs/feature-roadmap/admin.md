# Roadmap Fitur Admin PasarKita

## Tujuan

Dashboard admin harus membantu pengambilan keputusan dan penanganan masalah, bukan
sekadar menampilkan angka besar. Inspirasi pola dashboard marketplace digunakan
secara selektif dan disesuaikan dengan scope PasarKita sebagai marketplace UMKM.

## Status Implementasi Nomor 1-9

> **SUDAH DIKERJAKAN pada 10 Juni 2026.** Checklist rinci nomor 1-9 tersedia di
> bawah. Semua bagian yang selesai ditandai `[x]`. Item yang tetap `[ ]`
> memerlukan perubahan skema, workflow baru, idempotency checkout, atau perubahan
> pada API Gateway.

| Nomor | Fitur | Status |
|---|---|---|
| 1 | Definisi metrik admin | Selesai |
| 2 | Filter dan perbandingan periode | Selesai |
| 3 | Audit log admin | Selesai, perlu menjalankan migration |
| 4 | Monitoring integrasi | Selesai, kecuali retry payment |
| 5 | Validasi dan keamanan operasional | Selesai untuk scope PasarKita |
| 6 | Executive overview | Selesai |
| 7 | Delapan kelompok grafik analytics | Selesai |
| 8 | Action Center | Selesai untuk sumber data yang tersedia |
| 9 | Manajemen user | Selesai, kecuali ban sementara |

**Aktivasi database:** jalankan `backend/observability.sql` di Supabase agar audit
log dan integration health mulai menyimpan data.

**Data demo:** `npm run seed:demo` dari folder `backend/` telah dijalankan pada
10 Juni 2026. Seeder non-destruktif tersebut menambahkan 4 seller dan 32 produk
demo lintas delapan kategori, ditambah 8 akun pembeli demo untuk menguji manajemen
user. Script aman dijalankan ulang karena user dicari berdasarkan email dan
produk dilewati jika namanya sudah tersedia.

## Status Fitur Saat Ini

| Area | Status | Temuan |
|---|---|---|
| Ringkasan GMV, order, revenue, dan user | Sudah | Definisi metrik hanya memakai transaksi valid |
| Order terbaru | Ada | Menampilkan lima order |
| Distribusi status order | Sudah | Donut chart dan persentase |
| Top products dan kategori | Sudah | Dihitung dari item pada paid order |
| Tren order/revenue | Sudah | Agregasi per jam atau hari |
| Filter periode analytics | Sudah | Hari ini, 7/30 hari, dan custom |
| Manajemen user | Sudah | Search, filter lengkap, sorting, pagination, dan halaman detail tersedia |
| Ban/aktifkan user | Sudah | Alasan dan audit log tersedia |
| Manajemen semua order | Ada | Admin dapat mengubah status |
| Moderasi produk | Belum ada halaman | Kemampuan API terbatas, tidak ada workflow moderasi |
| Audit log dan monitoring integrasi | Sudah | Memerlukan `observability.sql` di Supabase |
| Komplain/refund | Belum | Tidak ada workflow sengketa |

## Quick Wins - Fitur Kecil tetapi Logis

### Tabel dan Pencarian

- [x] Search user benar-benar berfungsi, bukan input `readOnly`.
- [ ] Search order berdasarkan order ID, buyer, transaction ID, atau tracking ID.
- [x] Sorting nama dan tanggal daftar pada user.
- [ ] Sorting total, status, dan aktivitas terakhir pada tabel lain.
- [x] Pagination server-side pada user dan audit log.
- [ ] Pagination server-side pada order dan produk.
- [x] Tampilkan jumlah hasil dan rentang data pada manajemen user.
- [x] Tombol reset semua filter pada manajemen user.
- [ ] Simpan filter di URL agar halaman hasil dapat dibagikan.
- [ ] Pertahankan filter dan halaman ketika admin kembali dari detail.
- [ ] Empty state membedakan belum ada data dengan filter tanpa hasil.

### Keamanan Aksi Admin

- [x] Dialog konfirmasi untuk ban user, aktivasi user, dan perubahan status order.
- [ ] Dialog konfirmasi untuk
  penonaktifan produk.
- [x] Alasan wajib untuk aksi ban/aktivasi user dan perubahan status order.
- [ ] Pilihan alasan cepat yang dapat diedit.
- [x] Tampilkan ringkasan target sebelum konfirmasi agar admin tidak salah objek.
- [x] Disable tombol selama request berjalan untuk mencegah aksi ganda.
- [x] Toast sukses/error menyebut target yang diubah.
- [ ] Sediakan undo hanya untuk aksi lokal yang memang aman dibatalkan; refund dan
  payment tidak boleh menggunakan undo semu.
- [x] Cegah admin menonaktifkan akun sendiri.
- [ ] Minta autentikasi ulang untuk tindakan sangat sensitif seperti refund.

### Detail dan Produktivitas

- [x] Halaman detail user yang juga menampilkan ringkasan seller sesuai role.
- [ ] Halaman detail produk dan order.
- [x] Tombol salin user ID.
- [ ] Tombol salin order ID, transaction ID, tracking ID, dan correlation ID.
- [ ] Link silang dari order ke buyer, seller, produk, payment, dan shipping.
- [ ] Tombol refresh manual dengan indikator waktu pembaruan terakhir.
- [x] Tombol retry pada widget dashboard yang gagal tanpa reload seluruh halaman.
- [ ] Pilihan jumlah baris per halaman.
- [ ] Kolom tabel yang penting tetap terlihat saat scroll horizontal.
- [ ] Export hanya data hasil filter aktif, disertai preview jumlah baris.

### Kejelasan Dashboard

- [x] Tooltip definisi pada setiap metrik utama.
- [ ] Tooltip detail pada setiap elemen grafik.
- [ ] Legend grafik dapat diklik untuk menyembunyikan seri.
- [x] Drill-down ketika kartu metrik diklik.
- [ ] Drill-down ketika bagian grafik diklik.
- [x] Loading, empty, dan error state berbeda secara visual.
- [ ] Stale state khusus.
- [x] Tandai data parsial jika observability integrasi tidak tersedia.
- [x] Tampilkan zona waktu dashboard.
- [x] Format Rupiah dan tanggal konsisten.
- [x] Dashboard dan tabel menggunakan layout responsif dan horizontal overflow.
- [ ] Indikator jumlah item yang membutuhkan tindakan pada sidebar.

## P0 - Akurasi, Kontrol, dan Kepatuhan

> **Status implementasi 10 Juni 2026:** source untuk nomor 1-7 sudah dibuat dan
> lolos lint/build. Jalankan `backend/observability.sql` di Supabase untuk
> mengaktifkan penyimpanan audit log dan integration health. Migration tidak
> dijalankan otomatis agar tidak mengubah database bersama tanpa persetujuan.

### 1. Benahi Definisi Metrik

- [x] `GMV`: jumlah total order yang sudah dibayar, bukan seluruh status.
- [x] `Marketplace revenue`: total fee marketplace dari transaksi valid.
- [x] `Paid orders`: jumlah order dengan pembayaran sukses.
- [x] `Payment failure rate`: payment gagal dibagi seluruh percobaan payment.
- [x] `Active buyers/sellers`: user yang beraktivitas dalam periode.
- [x] Semua metrik harus memiliki periode dan definisi tooltip.
- [x] Gunakan zona waktu yang konsisten, misalnya Asia/Jakarta.

### 2. Filter Periode yang Benar

- [x] Preset hari ini, 7 hari, 30 hari, dan rentang custom.
- [x] Terapkan `start` dan `end` di query backend.
- [x] Perbandingan dengan periode sebelumnya.
- [x] Tampilkan waktu terakhir data diperbarui.
- [x] Jangan menampilkan persentase pertumbuhan jika pembanding nol tanpa label.

### 3. Audit Log Admin

- [x] Catat admin, aksi, target, waktu, alasan, dan nilai sebelum/sesudah.
- [x] Wajib untuk ban user dan perubahan status order. Hook pencatatan yang sama
  siap dipakai saat moderasi produk dan refund diimplementasikan.
- [x] Audit log bersifat append-only dari aplikasi; tidak tersedia endpoint update/delete.
- [x] Sediakan pencarian berdasarkan user/order ID, jenis target, serta jenis aksi.

### 4. Monitoring Integrasi

- [x] Ringkasan keberhasilan dan kegagalan SmartBank, Gateway, serta LogistiKita.
- [x] Latency p50/p95 sederhana.
- [ ] Daftar transaksi gagal dengan tombol lihat detail dan retry yang aman.
  Detail masalah tersedia melalui Action Center, tetapi retry payment sengaja
  belum dibuat sebelum checkout memiliki idempotency.
- [x] Tandai order `paid` yang belum memiliki tracking.
- [x] Jangan tampilkan API key, JWT, atau payload rahasia pada dashboard.

### 5. Validasi dan Keamanan Operasional

- [x] Tambahkan validasi Zod untuk seluruh endpoint mutasi admin yang tersedia.
- [x] Terapkan pagination, search, role, dan status pada query user.
- [x] Cegah admin mengubah status order tanpa alasan yang tercatat.
- [ ] Tambahkan rate limit dan structured request logging melalui Gateway.
  Structured integration log tersedia di PasarKita; rate limit harus diterapkan
  oleh kelompok pemilik Gateway.
- [ ] Gunakan idempotency untuk retry payment/refund/integrasi.
  Ditunda agar dikerjakan bersama hardening checkout, bukan membuat retry semu.

## P1 - Dashboard Admin yang Berguna

### 6. Executive Overview

Kartu utama:

- [x] GMV periode terpilih;
- [x] revenue fee marketplace;
- [x] paid orders;
- [x] buyer aktif;
- [x] seller aktif;
- [x] average order value;
- [x] payment failure rate;
- [x] order terlambat diproses melalui Action Center.

Setiap kartu menampilkan nilai, perubahan periode jika relevan, tooltip definisi,
dan link menuju data detail.

### 7. Grafik yang Direkomendasikan

#### A. Tren GMV, Revenue, dan Order

- [x] Diimplementasikan sebagai combo chart SVG tanpa dependency tambahan.
- **Bentuk:** combo chart, line untuk GMV/revenue dan bar untuk jumlah order.
- **Granularitas:** per jam untuk hari ini, per hari untuk 7/30 hari.
- **Kegunaan:** menemukan lonjakan, penurunan, dan dampak promo.

#### B. Funnel Transaksi

- [x] Diimplementasikan.
- **Tahap:** checkout dibuat -> payment request -> paid -> shipping dibuat ->
  shipped -> delivered.
- **Bentuk:** funnel atau horizontal step chart.
- **Kegunaan:** menunjukkan titik kehilangan transaksi.
- **Inovasi:** klik satu tahap membuka daftar order penyebab drop-off.

#### C. Distribusi Status Order

- [x] Diimplementasikan sebagai donut chart.
- **Bentuk:** donut dengan jumlah dan persentase.
- **Kegunaan:** monitoring operasional.
- **Catatan:** jangan gunakan pie chart dengan terlalu banyak kategori.

#### D. Payment Health

- [x] Diimplementasikan sebagai stacked bar sukses/gagal per waktu.
- **Bentuk:** line failure rate dan stacked bar sukses/gagal.
- **Kegunaan:** membedakan masalah bisnis dari gangguan SmartBank/Gateway.

#### E. Shipping Health

- [x] Diimplementasikan untuk pengiriman dibuat, dikirim, dan selesai.
- **Bentuk:** stacked bar status pengiriman dan KPI waktu rata-rata.
- **Kegunaan:** menemukan order paid tanpa tracking atau pengiriman terlambat.

#### F. Kategori dan Produk

- [x] Diimplementasikan sebagai horizontal ranking bar.
- **Bentuk:** horizontal bar top kategori dan top produk.
- **Metrik:** unit terjual, GMV, dan conversion sederhana jika event view tersedia.
- **Kegunaan:** memahami permintaan tanpa membuka data ledger eksternal.

#### G. Pertumbuhan Pengguna

- [x] Diimplementasikan sebagai stacked bar buyer/seller baru.
- **Bentuk:** stacked area buyer dan seller baru.
- **Kegunaan:** melihat keseimbangan supply dan demand.

#### H. Marketplace Pulse Map

- [x] Diimplementasikan sebagai heatmap kategori dan bucket waktu.
- **Bentuk:** heatmap kategori x hari atau jam.
- **Kegunaan:** memperlihatkan waktu dan kategori dengan aktivitas tertinggi.
- **Inovasi:** cocok untuk demo tanpa harus memakai peta geografis kompleks.

### 8. Action Center

Panel prioritas otomatis:

- [x] Payment gagal yang perlu ditinjau.
- [x] Order paid tanpa pengiriman.
- [x] Seller terlambat memproses order lebih dari 24 jam.
- [x] Produk aktif dengan stok kritis. Metrik "stok habis yang masih banyak
  dilihat" menunggu event product view.
- [ ] User/produk yang dilaporkan. Memerlukan tabel dan workflow laporan.
- [x] Integrasi eksternal yang sedang bermasalah.
- [x] Setiap item memiliki pemilik tindakan, tingkat urgensi, penjelasan, dan
  link penyelesaian.
- [x] Halaman Action Center khusus tersedia di sidebar admin.

### 9. Manajemen User yang Lengkap

- [x] Search nama/email.
- [x] Filter role, status, dan tanggal daftar.
- [x] Sorting berdasarkan tanggal daftar atau nama.
- [x] Detail user dengan histori order, statistik sesuai role, serta tindakan admin.
- [x] Ban permanen/nonaktif dengan alasan dan audit log.
- [ ] Ban sementara dengan masa berlaku. Memerlukan kolom status ban dan tanggal
  kedaluwarsa pada database.
- [x] Hindari menampilkan password hash atau data sensitif.

### 10. Moderasi Seller dan Produk

- [ ] Daftar seller serta status verifikasi.
- [ ] Review produk yang dilaporkan.
- [ ] Nonaktifkan listing dengan alasan dan notifikasi ke seller.
- [ ] Riwayat keputusan moderasi.
- [ ] Aturan objektif untuk mengurangi keputusan admin yang inkonsisten.

### 11. Komplain dan Refund

- [ ] Antrean kasus berdasarkan urgensi dan umur kasus.
- [ ] Bukti dari buyer dan tanggapan seller.
- [ ] Keputusan admin beserta alasan.
- [ ] Refund diteruskan ke SmartBank melalui Gateway.
- [ ] Status refund tersinkron ke order dan audit log.

### 12. Laporan dan Ekspor

- [ ] Ekspor CSV untuk order, user, seller, produk, dan ringkasan analytics.
- [ ] Terapkan filter yang sama dengan dashboard.
- [ ] Masking data pribadi yang tidak diperlukan.
- [ ] Catat siapa yang mengekspor data dan kapan.

## P2 - Inovasi Pembeda

### 13. Marketplace Health Score

Satu skor ringkas dengan rincian yang dapat ditindaklanjuti:

- kesehatan pembayaran;
- kesehatan pengiriman;
- ketersediaan stok;
- kualitas seller;
- kepuasan buyer.

Skor tidak boleh menjadi angka misterius. Bobot, data, dan penyebab perubahan
harus terlihat.

### 14. Anomaly Inbox

Deteksi berbasis aturan sederhana:

- kenaikan payment failure secara mendadak;
- order bernilai tidak biasa;
- produk mendadak habis;
- seller dengan lonjakan pembatalan;
- order paid yang lama tidak dikirim.

Pendekatan rule-based lebih realistis untuk tugas besar daripada mengklaim AI
tanpa dataset yang memadai.

### 15. Simulator Dampak Fee

Admin dapat mensimulasikan dampak perubahan fee pada revenue dan total bayar
berdasarkan data historis, tetapi tidak dapat mengubah fee produksi langsung dari
dashboard. Fee 2% tetap mengikuti aturan tugas besar sampai ada keputusan resmi.

### 16. Integration Storyboard

Visualisasi satu order secara end-to-end:

`Buyer -> PasarKita -> Gateway -> SmartBank -> PasarKita -> LogistiKita`

Setiap node menampilkan timestamp, status, dan correlation ID. Ini berguna untuk
debugging, demo dosen, dan audit integrasi.

## Kontrak Data Analytics Minimum

Endpoint analytics sebaiknya menyediakan:

```json
{
  "period": {
    "start": "2026-06-01T00:00:00+07:00",
    "end": "2026-06-09T23:59:59+07:00",
    "timezone": "Asia/Jakarta"
  },
  "summary": {},
  "timeseries": [],
  "transaction_funnel": [],
  "orders_by_status": [],
  "top_products": [],
  "top_categories": [],
  "integration_health": {},
  "action_center": []
}
```

Gunakan agregasi backend. Jangan mengirim seluruh tabel transaksi ke browser lalu
menghitung analytics di client.

## Urutan Implementasi Disarankan

1. Perbaiki definisi revenue/GMV dan filter periode.
2. Implementasikan `timeseries`, `top_products`, dan funnel transaksi.
3. Tambahkan audit log serta monitoring integrasi.
4. Bangun executive overview dan action center.
5. Lengkapi search/filter user dan moderasi produk.
6. Tambahkan komplain/refund dan ekspor laporan.
7. Terapkan quick wins tabel, konfirmasi aksi, dan drill-down.
8. Buat health score, anomaly inbox, dan integration storyboard.

## Batas Scope

- Dashboard admin PasarKita menganalisis data operasional marketplace.
- Analisis ledger, money supply, serta cashflow lintas aplikasi tetap milik UMKM
  Insight dan SmartBank.
- Admin tidak boleh mengubah saldo, ledger, atau hasil pembayaran secara langsung.
- Grafik harus menjawab pertanyaan operasional; hindari grafik dekoratif tanpa aksi.

## Referensi Produk

Pola yang digunakan adalah pola umum seller/admin center: onboarding dan
verifikasi toko, pusat operasi, panduan pertumbuhan, monitoring performa, dan
dukungan. Implementasinya disederhanakan dan diberi pembeda sesuai kebutuhan UMKM
serta arsitektur tugas besar, bukan menyalin antarmuka marketplace tertentu.

- Tokopedia & TikTok Shop Seller Center, registrasi dan verifikasi toko:
  https://seller-id.tiktok.com/university/article?knowledge_id=10000741
- Tokopedia & TikTok Shop Academy, pusat panduan penjual:
  https://seller-id.tiktok.com/university/homeC
