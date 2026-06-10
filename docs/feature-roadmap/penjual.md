# Roadmap Fitur Penjual PasarKita

## Tujuan

Roadmap ini memperdalam fungsi seller dari sekadar CRUD produk menjadi alat
operasional UMKM yang membantu mengelola katalog, stok, pesanan, dan performa.

## Status Fitur Saat Ini

| Area | Status | Catatan |
|---|---|---|
| Daftar produk milik seller | Ada | Pencarian dan toggle aktif tersedia |
| Tambah dan edit produk | Ada | Foto utama tersimpan di Supabase Storage setelah migration dijalankan |
| Hapus/nonaktifkan produk | Ada | Berupa soft delete `is_active=false` |
| Order masuk | Ada | Seller dapat menandai order `paid` menjadi `shipped` |
| Detail order | Ada sebagian | Menggunakan halaman order umum |
| Tracking LogistiKita | Ada sebagian | Update logistik tidak memblokir perubahan status |
| Dashboard penjual | Belum | Sidebar hanya Produk dan Order Masuk |
| Analytics penjualan | Belum | Tidak ada omzet, tren, atau produk terlaris |
| Profil toko | Belum | Akun seller belum memiliki identitas toko terpisah |
| Promosi dan voucher | Belum | Tidak ada modul promosi |
| Respons ulasan | Belum | Seller belum dapat merespons review |
| Notifikasi seller | Tampilan saja | Belum ada API/event |

**Aktivasi upload gambar:** jalankan `backend/product-images.sql` melalui
Supabase SQL Editor. Migration ini menambahkan kolom `products.image_url` dan
bucket publik `product-images` dengan batas file 5MB.

## Quick Wins - Fitur Kecil tetapi Logis

### Navigasi dan Akun

- [x] Sidebar menampilkan identitas seller yang sedang aktif.
- [x] Tombol logout tersedia di seluruh halaman seller dan meminta konfirmasi.
- [x] Logout membersihkan sesi lalu mengarahkan kembali ke halaman login.
- [x] Tombol kembali ke marketplace tersedia tanpa harus mengubah URL manual.
- [x] Sidebar tetap terlihat saat halaman panjang di-scroll.
- [x] Padding konten seller menyesuaikan lebar layar dan tidak memaksa overflow layout.

### Produk

- [x] Konfirmasi sebelum menonaktifkan atau mengaktifkan produk.
- [x] Tampilkan alasan produk tidak dapat diaktifkan ketika stok habis.
- [ ] Peringatan saat keluar dari form dengan perubahan yang belum disimpan.
- [ ] Simpan draft form produk di browser untuk mencegah input hilang.
- [ ] Preview halaman produk sebelum dipublikasikan.
- [ ] Hitung karakter nama dan deskripsi beserta batasnya.
- [ ] Validasi harga dan stok langsung saat input, bukan setelah submit.
- [ ] Tambahkan SKU/kode produk internal yang dapat dicari dan disalin.
- [ ] Sorting produk berdasarkan nama, harga, stok, terbaru, dan status.
- [ ] Pagination produk yang sebenarnya.
- [x] Tombol reset search/filter dan empty state yang membedakan "belum ada produk"
  dengan "hasil pencarian kosong".

### Pesanan

- [x] Badge jumlah order baru pada sidebar.
- [x] Konfirmasi sebelum mengubah status order menjadi dikirim.
- [ ] Tombol salin order ID, transaction ID, alamat, dan tracking ID.
- [ ] Search order berdasarkan ID atau nama produk.
- [ ] Filter periode, status, dan kebutuhan tindakan.
- [ ] Sorting order terbaru, terlama, dan mendekati batas proses.
- [ ] Catatan internal seller per order yang tidak terlihat buyer.
- [x] Tombol retry ketika daftar order gagal dimuat.
- [ ] Tampilkan alasan tombol "Tandai Dikirim" tidak tersedia.

### Operasional Toko

- [ ] Notifikasi order baru, stok menipis, dan ulasan baru.
- [ ] Tombol buka halaman publik toko dari sidebar.
- [ ] Jam tutup sementara atau mode libur dengan tanggal aktif kembali.
- [ ] Konfirmasi sebelum mengaktifkan mode libur karena berdampak pada katalog.
- [ ] Empty state dashboard yang menjelaskan langkah pertama seller baru.
- [ ] Tampilan mobile berupa card ketika tabel tidak cukup lebar.
- [ ] Ekspor CSV sederhana untuk produk dan order seller.

## P0 - Operasional Inti

### 1. Dashboard Ringkas Penjual

- [ ] Order baru yang perlu diproses.
- [ ] Order terlambat dikirim.
- [ ] Produk stok habis dan stok menipis.
- [ ] Omzet kotor, fee marketplace, dan estimasi pendapatan bersih.
- [ ] Produk terlaris pada periode terpilih.
- [ ] Rating rata-rata dan ulasan baru.

**Grafik minimum:**

1. Line chart omzet dan jumlah order per hari.
2. Bar chart produk terlaris berdasarkan unit.
3. Donut status order.
4. Stok kritis dalam bentuk tabel tindakan, bukan grafik dekoratif.

### 2. Upload dan Manajemen Gambar Produk

- [x] Simpan satu foto utama ke Supabase Storage, bukan hanya `FileReader` preview.
- [ ] Dukungan beberapa gambar dengan satu gambar utama.
- [x] Validasi format JPG/PNG/WebP dan ukuran maksimal 5MB di frontend serta backend.
- [ ] Hapus gambar yang tidak lagi digunakan.
- [x] Tampilkan gambar yang sama pada katalog, detail produk, checkout, dan daftar seller.

### 3. Pengelolaan Pesanan yang Aman

- [ ] Filter order dilakukan di database berdasarkan produk milik seller.
- [ ] Pagination dan total order harus mencerminkan order seller, bukan seluruh sistem.
- [ ] Seller hanya melihat item miliknya pada order multi-seller.
- [ ] Validasi transisi status, misalnya `paid -> processing -> shipped`.
- [ ] Seller memasukkan atau mengonfirmasi data pickup sebelum dikirim.
- [ ] Catat waktu proses dan waktu kirim untuk evaluasi SLA.

### 4. Manajemen Stok

- [ ] Batas stok minimum per produk.
- [ ] Peringatan stok menipis dan habis.
- [ ] Riwayat mutasi stok: penjualan, penambahan, koreksi, pembatalan.
- [ ] Cegah perubahan stok yang merusak reservasi order aktif.
- [ ] Aksi bulk untuk aktif/nonaktif dan pembaruan stok.

### 5. Profil Toko

- [ ] Nama toko, logo, deskripsi, alamat pickup, dan kontak.
- [ ] Status verifikasi sederhana untuk kebutuhan demo.
- [ ] Jam operasional dan estimasi waktu proses.
- [ ] Halaman publik toko yang dapat dikunjungi buyer.

## P1 - Pertumbuhan dan Kualitas Layanan

### 6. Analytics Penjual

| Insight | Bentuk | Manfaat |
|---|---|---|
| Omzet dan order per hari | Line chart | Melihat tren |
| Produk dilihat ke dibeli | Funnel | Menemukan produk yang kurang meyakinkan |
| Produk terlaris | Horizontal bar | Prioritas restock |
| Penjualan per kategori | Stacked bar/donut | Memahami komposisi katalog |
| Jam dan hari order | Heatmap | Menentukan jam operasional |
| Kecepatan proses | KPI + tren | Mengurangi keterlambatan |
| Rating dan sentimen tag | Bar/list | Menemukan masalah kualitas |

Gunakan filter 7 hari, 30 hari, dan rentang tanggal. Analytics seller hanya
memakai data toko tersebut.

### 7. Kualitas Listing

- [ ] Skor kelengkapan produk berdasarkan nama, deskripsi, gambar, kategori, dan stok.
- [ ] Saran perbaikan yang spesifik, bukan skor tanpa penjelasan.
- [ ] Dukungan atribut per kategori seperti ukuran, berat, bahan, atau masa simpan.
- [ ] Draft produk sebelum dipublikasikan.
- [ ] Duplikasi produk untuk mempercepat input katalog.

### 8. Promosi Sederhana

- [ ] Diskon produk dengan periode aktif.
- [ ] Voucher toko dengan minimum transaksi dan kuota.
- [ ] Harga sebelum/sesudah diskon tetap transparan.
- [ ] Validasi agar harga promo tidak negatif atau menyesatkan.
- [ ] Laporan penggunaan promo dan kontribusi omzet.

### 9. Pengelolaan Ulasan

- [ ] Daftar ulasan terbaru dan belum direspons.
- [ ] Satu respons seller per ulasan.
- [ ] Filter berdasarkan rating dan produk.
- [ ] Ringkasan masalah berulang seperti kemasan, ukuran, atau kualitas.

### 10. Invoice, Packing List, dan Pengiriman

- [ ] Cetak packing list per order.
- [ ] Tampilkan item seller saja pada order multi-seller.
- [ ] Jadwalkan pickup atau konfirmasi serah terima ke LogistiKita.
- [ ] Tampilkan error sinkronisasi logistik dan tombol retry.

## P2 - Inovasi Pembeda

### 11. Health Score Toko yang Dapat Ditindaklanjuti

Skor toko tidak hanya berupa angka. Setiap penurunan skor harus memiliki penyebab
dan tindakan, misalnya "3 order melewati target proses" atau "2 produk kehabisan
stok saat banyak dilihat".

Komponen skor:

- ketepatan pengiriman;
- tingkat pembatalan;
- kelengkapan katalog;
- respons ulasan;
- kestabilan stok.

### 12. Asisten Restock Berbasis Permintaan

Gunakan rata-rata penjualan sederhana untuk memperkirakan hari sampai stok habis.
Tampilkan rekomendasi restock sebagai bantuan, bukan keputusan otomatis.

### 13. Simulasi Harga Bersih

Saat seller mengatur harga, tampilkan simulasi:

`harga jual - fee marketplace - estimasi fee terkait = estimasi diterima seller`

Simulasi harus mengikuti response SmartBank/Gateway dan tidak boleh dianggap
sebagai perubahan saldo.

### 14. Kalender Operasional UMKM

Gabungkan jadwal promo, target restock, pickup, dan pesanan yang harus diproses
dalam satu kalender sederhana. Ini menjadi pembeda yang lebih berguna bagi UMKM
daripada meniru tampilan marketplace besar secara penuh.

## Urutan Implementasi Disarankan

1. Penyimpanan gambar dan profil toko.
2. Query order seller yang benar dan status `processing`.
3. Mutasi serta peringatan stok.
4. Dashboard seller dan grafik tren dasar.
5. Packing list dan retry pengiriman.
6. Kualitas listing, ulasan, dan promosi.
7. Quick wins produk dan order dikerjakan bersama halaman terkait.
8. Health score serta rekomendasi restock.

## Batas Scope

- Seller tidak boleh melihat data toko lain.
- Pendapatan bersih harus bersumber dari data pembayaran yang sah.
- Analytics lintas ekosistem dan ledger SmartBank tetap menjadi scope UMKM Insight.
- Jangan membuat saldo seller lokal di PasarKita.
