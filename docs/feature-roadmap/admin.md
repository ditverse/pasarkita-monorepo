# Roadmap Fitur Admin PasarKita

## Tujuan

Dashboard admin harus membantu pengambilan keputusan dan penanganan masalah, bukan
sekadar menampilkan angka besar. Inspirasi pola dashboard marketplace digunakan
secara selektif dan disesuaikan dengan scope PasarKita sebagai marketplace UMKM.

## Status Implementasi Nomor 1-16

> **SUDAH DIKERJAKAN pada 10 Juni 2026.** Checklist rinci nomor 1-16 tersedia di
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
| 10 | Moderasi seller dan produk | Selesai untuk schema saat ini |
| 11 | Komplain dan refund | Belum, memerlukan schema dan integrasi refund |
| 12 | Laporan dan ekspor | Selesai |
| 13 | Marketplace Health Score | Selesai |
| 14 | Anomaly Inbox | Selesai untuk data yang tersedia |
| 15 | Simulator Dampak Fee | Selesai |
| 16 | Integration Storyboard | Selesai parsial, menunggu correlation ID Gateway |

**Aktivasi database:** migration
`backend/database/migrations/002_observability.sql` sudah diterapkan agar audit
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
| Moderasi produk | Sudah | Antrean, aturan keputusan, status listing, dan audit tersedia |
| Audit log dan monitoring integrasi | Sudah | Tabel observability dan index sudah aktif di Supabase |
| Komplain/refund | Belum | Tidak ada workflow sengketa |

## Quick Wins - Fitur Kecil tetapi Logis

### Navigasi dan Akun

- [x] Sidebar menampilkan identitas admin yang sedang aktif.
- [x] Tombol logout tersedia di seluruh halaman admin dan meminta konfirmasi.
- [x] Logout membersihkan sesi lalu mengarahkan kembali ke halaman login.
- [x] Tombol kembali ke marketplace tersedia tanpa harus mengubah URL manual.
- [x] Sidebar tetap terlihat saat halaman panjang di-scroll.

### Tabel dan Pencarian

- [x] Search user benar-benar berfungsi, bukan input `readOnly`.
- [x] Search order berdasarkan order ID, buyer, transaction ID, atau tracking ID.
- [x] Sorting nama dan tanggal daftar pada user.
- [x] Sorting total, status, tanggal dibuat, dan aktivitas terakhir pada order.
- [x] Pagination server-side pada user dan audit log.
- [x] Pagination server-side pada order dan produk moderasi.
- [x] Tampilkan jumlah hasil dan rentang data pada manajemen user.
- [x] Tombol reset semua filter pada manajemen user.
- [x] Simpan filter order di URL agar halaman hasil dapat dibagikan.
- [x] Pertahankan filter dan halaman order ketika admin kembali dari detail.
- [x] Empty state order membedakan belum ada data dengan filter tanpa hasil.

### Keamanan Aksi Admin

- [x] Dialog konfirmasi untuk ban user, aktivasi user, dan perubahan status order.
- [x] Dialog konfirmasi untuk penonaktifan dan aktivasi produk.
- [x] Alasan wajib untuk aksi ban/aktivasi user dan perubahan status order.
- [x] Pilihan aturan moderasi cepat dengan alasan yang dapat diedit.
- [x] Tampilkan ringkasan target sebelum konfirmasi agar admin tidak salah objek.
- [x] Disable tombol selama request berjalan untuk mencegah aksi ganda.
- [x] Toast sukses/error menyebut target yang diubah.
- [ ] Sediakan undo hanya untuk aksi lokal yang memang aman dibatalkan; refund dan
  payment tidak boleh menggunakan undo semu.
- [x] Cegah admin menonaktifkan akun sendiri.
- [ ] Minta autentikasi ulang untuk tindakan sangat sensitif seperti refund.

### Detail dan Produktivitas

- [x] Halaman detail user yang juga menampilkan ringkasan seller sesuai role.
- [x] Halaman detail order admin.
- [x] Halaman detail produk admin khusus, di luar antrean moderasi.
- [x] Tombol salin user ID.
- [x] Tombol salin product ID.
- [x] Tombol salin order ID, transaction ID, dan tracking ID.
- [ ] Correlation ID menunggu kontrak ID bersama dari Gateway.
- [x] Link silang dari order ke buyer, seller, dan produk/moderasi.
- [x] Timeline payment/shipping dari integration log jika observability aktif.
- [x] Tombol refresh manual dengan indikator waktu pembaruan terakhir.
- [x] Tombol retry pada widget dashboard yang gagal tanpa reload seluruh halaman.
- [x] Pilihan jumlah baris per halaman order.
- [x] Kolom order ID tetap terlihat saat tabel order di-scroll horizontal.
- [x] Export hanya data hasil filter aktif, disertai preview jumlah baris.

### Kejelasan Dashboard

- [x] Tooltip definisi pada setiap metrik utama.
- [x] Tooltip detail pada elemen grafik SVG, stacked bar, dan heatmap.
- [x] Legend grafik tren dan stacked bar dapat diklik untuk menyembunyikan seri.
- [x] Drill-down ketika kartu metrik diklik.
- [x] Drill-down ketika funnel, distribusi status, top produk, dan kategori diklik.
- [x] Loading, empty, dan error state berbeda secara visual.
- [x] Stale state khusus dengan indikator freshness 30 detik dan refresh manual.
- [x] Tandai data parsial jika observability integrasi tidak tersedia.
- [x] Tampilkan zona waktu dashboard.
- [x] Format Rupiah dan tanggal konsisten.
- [x] Dashboard dan tabel menggunakan layout responsif dan horizontal overflow.
- [x] Indikator jumlah item yang membutuhkan tindakan pada sidebar.

## P0 - Akurasi, Kontrol, dan Kepatuhan

> **Status implementasi 10 Juni 2026:** source untuk nomor 1-16 sudah dibuat dan
> lolos lint/build. Migration
> `backend/database/migrations/002_observability.sql` sudah aktif untuk
> mengaktifkan penyimpanan audit log dan integration health di Supabase.

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

- [x] Daftar seller dengan status akun dan ringkasan produk aktif, nonaktif, serta
  stok kritis.
- [ ] Status verifikasi seller formal. Memerlukan tabel profil/verifikasi seller
  dan dokumen KYC; UI saat ini menandainya "Belum dikonfigurasi".
- [ ] Review produk yang dilaporkan.
- [x] Nonaktifkan atau aktifkan listing dengan alasan wajib.
- [ ] Notifikasi keputusan ke seller. Seller sudah tidak dapat mengaktifkan ulang
  listing yang dikunci admin, tetapi inbox/notifikasi memerlukan tabel baru.
- [x] Riwayat keputusan moderasi melalui audit log.
- [x] Aturan objektif untuk mengurangi keputusan admin yang inkonsisten.
- [x] Filter produk berdasarkan status dan kondisi stok, search server-side,
  pagination, jumlah hasil, serta reset filter.
- [x] Halaman seller tetap menampilkan produk nonaktif miliknya, tanpa
  menampilkan listing tersebut pada katalog publik.

### 11. Komplain dan Refund

- [ ] Antrean kasus berdasarkan urgensi dan umur kasus.
- [ ] Bukti dari buyer dan tanggapan seller.
- [ ] Keputusan admin beserta alasan.
- [ ] Refund diteruskan ke SmartBank melalui Gateway.
- [ ] Status refund tersinkron ke order dan audit log.

### 12. Laporan dan Ekspor

- [x] Ekspor CSV untuk order, user, seller, produk, dan ringkasan analytics.
- [x] Terapkan filter status, pencarian, stok, role, serta periode sesuai dataset.
- [x] Preview jumlah baris, kolom, dan tiga contoh data sebelum ekspor.
- [x] Masking email dan tidak mengekspor password maupun alamat pengiriman.
- [x] Catat siapa yang mengekspor data, jenis laporan, filter, jumlah baris, dan
  waktu melalui audit log jika observability sudah aktif.
- [x] Batasi maksimal 5.000 baris per file dan tandai hasil yang mencapai batas.

## P2 - Inovasi Pembeda

### 13. Marketplace Health Score

Satu skor ringkas dengan rincian yang dapat ditindaklanjuti:

- [x] Kesehatan pembayaran dengan bobot 30%.
- [x] Kesehatan pengiriman dengan bobot 25%.
- [x] Ketersediaan stok dengan bobot 20%.
- [x] Kualitas seller dengan bobot 15%.
- [x] Kepuasan buyer dengan bobot 10%; memakai rating aktual atau proxy order
  selesai jika belum ada rating pada periode.
- [x] Setiap komponen menampilkan skor, bobot, metrik sumber, penjelasan, dan
  link penyelesaian.
- [x] Halaman Health Center menyediakan periode hari ini, 7 hari, dan 30 hari.

Formula yang digunakan:

`payment 30% + shipping 25% + stock 20% + seller 15% + buyer 10%`.

Skor, bobot, data, keterbatasan, serta penyebab penurunan ditampilkan agar angka
tidak menjadi metrik misterius.

### 14. Anomaly Inbox

Deteksi berbasis aturan sederhana:

- [x] Kenaikan payment failure secara mendadak: minimal tiga kegagalan dan naik
  setidaknya 10 poin persentase dari periode sebelumnya.
- [x] Order bernilai tidak biasa: minimal tiga kali AOV atau Rp1.000.000.
- [x] Produk aktif dengan stok habis.
- [ ] Seller dengan lonjakan pembatalan. Status `cancelled` belum tersedia pada
  schema order.
- [x] Order paid yang belum memiliki tracking setelah lebih dari 24 jam.
- [x] Order pending lebih dari 24 jam.
- [x] Error integrasi atau monitoring integrasi yang belum aktif.
- [x] Setiap anomali menampilkan severity, jumlah, aturan, penjelasan, dan link
  investigasi.
- [x] Cakupan aturan yang belum tersedia ditampilkan secara eksplisit.

Pendekatan rule-based lebih realistis untuk tugas besar daripada mengklaim AI
tanpa dataset yang memadai.

### 15. Simulator Dampak Fee

- [x] Admin dapat memilih periode hari ini, 7 hari, 30 hari, atau custom.
- [x] Fee simulasi dapat dipilih dari 0–10% dengan kenaikan 0,5%.
- [x] Tampilkan revenue simulasi, selisih dari aktual, fee rata-rata per order,
  total buyer, dan rata-rata total buyer.
- [x] Tampilkan tabel skenario 0%, 1%, 2%, 3%, 5%, dan nilai custom.
- [x] Perhitungan memakai paid order historis dan pembulatan per order seperti
  produksi.
- [x] Simulator bersifat read-only dan tidak dapat mengubah fee produksi.

Fee produksi 2% tetap mengikuti aturan tugas besar sampai ada keputusan resmi.

### 16. Integration Storyboard

Visualisasi satu order secara end-to-end:

`Buyer -> PasarKita -> Gateway -> SmartBank -> PasarKita -> LogistiKita`

- [x] Storyboard tersedia pada detail order admin.
- [x] Setiap node menampilkan status, deskripsi, dan timestamp jika tersedia.
- [x] Gunakan status order sebagai fallback ketika integration log belum aktif.
- [x] Bedakan node sukses, gagal, dan belum terverifikasi.
- [ ] Correlation ID menunggu kontrak dan payload bersama dari Gateway.

Storyboard berguna untuk debugging, demo dosen, dan audit integrasi tanpa
mengarang event yang belum tersedia.

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
  "action_center": [],
  "marketplace_health": {},
  "anomalies": []
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
