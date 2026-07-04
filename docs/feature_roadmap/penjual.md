# Roadmap Fitur Penjual PasarKita

## Tujuan

Roadmap ini memperdalam fungsi seller dari sekadar CRUD produk menjadi alat
operasional UMKM yang membantu mengelola katalog, stok, pesanan, dan performa.

## Status Fitur Saat Ini

| Area | Status | Catatan |
|---|---|---|
| Daftar produk milik seller | Ada | Pencarian, filter stok/status, sorting, pagination, dan toggle aktif tersedia |
| Tambah dan edit produk | Ada | Validasi langsung, draft browser, batas stok minimum, dan foto Supabase tersedia |
| Hapus/nonaktifkan produk | Ada | Berupa soft delete `is_active=false` |
| Order masuk | Ada | Seller menjalankan alur `paid -> processing -> shipped` dengan konfirmasi pickup |
| Detail order | Ada | Backend hanya mengembalikan item, nilai, dan identitas buyer yang relevan untuk seller aktif |
| Tracking LogistiKita | Ada | Error sinkronisasi terlihat, perubahan ke `shipped` diblokir, dan retry tersedia |
| Dashboard penjual | Ada | KPI order, omzet toko, fee, rating, stok kritis, dan grafik tersedia |
| Analytics penjualan | Ada sebagian | Filter 7/30 hari dan insight dasar aktif; funnel serta heatmap belum tersedia |
| Profil toko | Ada | Identitas toko terpisah dari akun login dan tampil di halaman publik |
| Promosi dan voucher | Belum | Tidak ada modul promosi |
| Respons ulasan | Belum | Seller belum dapat merespons review |
| Notifikasi seller | Tampilan saja | Belum ada API/event |

**Aktivasi upload gambar:** migration
`backend/database/migrations/001_product_images.sql` sudah diterapkan melalui
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
- [x] Peringatan saat keluar dari form dengan perubahan yang belum disimpan.
- [x] Simpan draft form produk di browser untuk mencegah input hilang.
- [ ] Preview halaman produk sebelum dipublikasikan.
- [x] Hitung karakter nama dan deskripsi beserta batasnya.
- [x] Validasi nama, deskripsi, harga, stok, dan batas stok langsung saat input
  serta ulangi validasi yang sama di backend.
- [ ] Tambahkan SKU/kode produk internal yang dapat dicari dan disalin.
- [x] Sorting produk berdasarkan nama, harga, stok, terbaru, dan status.
- [x] Pagination produk yang sebenarnya.
- [x] Tombol reset search/filter dan empty state yang membedakan "belum ada produk"
  dengan "hasil pencarian kosong".

### Pesanan

- [x] Badge jumlah order baru pada sidebar.
- [x] Konfirmasi pickup sebelum memproses dan konfirmasi sebelum menyerahkan order ke kurir.
- [x] Tombol salin order ID, transaction ID, alamat, dan tracking ID.
- [x] Search order berdasarkan ID, nama produk, transaction ID, atau tracking ID.
- [x] Filter periode, status, dan kebutuhan tindakan.
- [x] Sorting order terbaru, terlama, dan mendekati batas proses.
- [ ] Catatan internal seller per order yang tidak terlihat buyer.
- [x] Tombol retry ketika daftar order gagal dimuat.
- [x] Tampilkan alasan tombol "Tandai Dikirim" tidak tersedia.

### Operasional Toko

- [x] Notifikasi order baru, stok menipis, dan ulasan baru.
- [x] Tombol buka halaman publik toko dari sidebar.
- [x] Jam tutup sementara atau mode libur dengan tanggal aktif kembali.
- [x] Konfirmasi sebelum mengaktifkan mode libur karena berdampak pada katalog.
- [x] Empty state dashboard yang menjelaskan langkah pertama seller baru.
- [ ] Tampilan mobile berupa card ketika tabel tidak cukup lebar.
- [x] Ekspor CSV sederhana untuk produk dan order seller.

## P0 - Operasional Inti

### 1. Dashboard Ringkas Penjual

- [x] Order baru yang perlu diproses.
- [x] Order terlambat dikirim berdasarkan order `paid` lebih dari dua hari.
- [x] Produk stok habis dan stok menipis.
- [x] Omzet kotor, fee marketplace proporsional, dan estimasi pendapatan bersih.
- [x] Produk terlaris pada periode terpilih.
- [x] Rating rata-rata dan jumlah ulasan baru.

**Grafik minimum:**

1. [x] Line chart omzet, estimasi bersih, dan jumlah order per hari.
2. [x] Bar chart produk terlaris berdasarkan unit.
3. [x] Donut status order.
4. [x] Stok kritis dalam bentuk tabel tindakan, bukan grafik dekoratif.

**Status implementasi:** endpoint `/api/seller/analytics` menghitung hanya item
produk milik seller. Omzet tidak memakai total order lintas toko, sedangkan fee
marketplace dialokasikan proporsional terhadap nilai item seller. Dashboard
menyediakan periode 7 dan 30 hari serta tidak menganggap estimasi bersih sebagai
saldo SmartBank.

### 2. Upload dan Manajemen Gambar Produk

- [x] Simpan satu foto utama ke Supabase Storage, bukan hanya `FileReader` preview.
- [ ] Dukungan beberapa gambar dengan satu gambar utama.
- [x] Validasi format JPG/PNG/WebP dan ukuran maksimal 5MB di frontend serta backend.
- [ ] Hapus gambar yang tidak lagi digunakan.
- [x] Tampilkan gambar yang sama pada katalog, detail produk, checkout, dan daftar seller.

### 3. Pengelolaan Pesanan yang Aman

- [x] Filter order dilakukan di database berdasarkan produk milik seller.
- [x] Pagination dan total order mencerminkan order seller, bukan seluruh sistem.
- [x] Seller hanya melihat item, nilai transaksi, dan identitas buyer yang diperlukan
  untuk order miliknya; email buyer serta nilai toko lain tidak dikirim ke seller.
- [x] Validasi transisi status `paid -> processing -> shipped`.
- [x] Seller memasukkan atau mengonfirmasi data pickup sebelum dikirim.
- [x] Catat waktu proses dan waktu kirim untuk evaluasi SLA.

**Status implementasi:** daftar dan detail order seller sekarang memakai scope
produk seller di backend, filter dan pagination server-side, serta proyeksi nilai
item toko sendiri. Migration `007_seller_fulfillment.sql` menambahkan status
`processing`, snapshot alamat pickup, waktu proses/kirim, dan status sinkronisasi
logistik. Perubahan fulfillment order multi-toko tetap ditolak agar satu seller
tidak mengubah status toko lain, tetapi packing list tetap menyaring item per toko.

### 4. Manajemen Stok

- [x] Batas stok minimum per produk.
- [x] Peringatan dan filter stok menipis serta habis berdasarkan batas per produk.
- [ ] Riwayat mutasi stok: penjualan, penambahan, koreksi, pembatalan.
- [ ] Cegah perubahan stok yang merusak reservasi order aktif.
- [ ] Aksi bulk untuk aktif/nonaktif dan pembaruan stok.

**Status implementasi:** migration `005_seller_inventory_basics.sql` menambahkan
`minimum_stock` dan indikator stok rendah terhitung di database. Daftar produk
memakai filter, sorting, dan pagination server-side. Form tambah/edit memakai
draft lokal per seller dan tetap divalidasi ulang oleh backend.

### 5. Profil Toko

- [x] Nama toko, logo, deskripsi, alamat pickup, dan kontak.
- [x] Status verifikasi sederhana untuk kebutuhan demo yang aktif setelah profil
  utama lengkap dan ditandai jelas bukan verifikasi produksi.
- [x] Jam operasional dan estimasi waktu proses.
- [x] Halaman publik toko yang dapat dikunjungi buyer.

**Status implementasi:** migration `006_seller_profiles.sql` membuat identitas
toko satu-ke-satu dengan akun seller dan bucket logo `store-assets`. Alamat
pickup hanya tersedia pada seller center, sedangkan buyer melihat nama toko,
logo, deskripsi, kontak, jam operasional, serta estimasi proses. Lima seller lama
telah mendapat profil fallback dari nama akun tanpa mengubah data login.

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

Gunakan filter 7 hari, 30 hari, dan rentang tanggal. Filter 7/30 hari serta scope
data toko sudah aktif; rentang tanggal custom masih menjadi pekerjaan lanjutan.

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

- [x] Cetak packing list per order.
- [x] Tampilkan item seller saja pada order multi-seller.
- [x] Jadwalkan pickup atau konfirmasi serah terima ke LogistiKita.
- [x] Tampilkan error sinkronisasi logistik dan tombol retry.

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
