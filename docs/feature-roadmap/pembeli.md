# Roadmap Fitur Pembeli PasarKita

## Tujuan

Dokumen ini memetakan fitur pembeli yang sudah ada, belum lengkap, dan disarankan
untuk dikembangkan. Prioritas disusun agar PasarKita terlebih dahulu memenuhi
alur tugas besar, lalu berkembang menjadi marketplace yang nyaman digunakan.

## Acuan Scope

- `TugasBesar_Plan.xlsx`: browse produk, checkout, payment request, status order,
  fee marketplace 2%, dan trigger pengiriman.
- `checklist_tubes_rpl2.html`: keranjang, integrasi SmartBank melalui Gateway,
  status order, dan integrasi LogistiKita.
- Source aktual frontend dan backend PasarKita per 9 Juni 2026.

## Status Fitur Saat Ini

| Area | Status | Catatan |
|---|---|---|
| Registrasi dan login | Ada | JWT dan role sudah tersedia |
| Browse, cari, filter, urutkan produk | Ada sebagian | Pagination masih bersifat dummy di UI |
| Detail produk | Ada | Foto utama produk tampil dengan fallback placeholder |
| Keranjang multi-item | Ada sebagian | Persisten di browser; checkout masih dilakukan per produk |
| Kalkulasi subtotal dan fee 2% | Ada | Sudah memakai endpoint fee |
| Checkout dan pembayaran SmartBank | Ada | Belum idempotent dan belum aman dari race stok |
| Riwayat dan detail order | Ada | Status dasar dan tracking tersedia |
| Konfirmasi pesanan diterima | Ada | Buyer dapat mengubah `shipped` menjadi `delivered` |
| Rating dan ulasan | Ada | Belum mendukung foto atau respons penjual |
| Profil | Tampilan saja | Perubahan nama, telepon, alamat, foto belum benar-benar tersimpan |
| Ganti password | Belum | UI menampilkan pesan belum tersedia |
| Notifikasi | Tampilan saja | Belum ada data dan API notifikasi |
| Wishlist, voucher, komplain, refund | Belum | Belum ada model data maupun halaman |

## Quick Wins - Fitur Kecil tetapi Logis

Fitur berikut relatif kecil, tetapi berpengaruh besar terhadap kelancaran alur
harian pembeli.

### Akun dan Navigasi

- [ ] Fitur lupa password dan reset password.
- [x] Tombol tampilkan/sembunyikan password yang konsisten pada login dan register;
  ganti password menunggu API.
- [x] Redirect kembali ke halaman tujuan setelah login, bukan selalu ke halaman
  default.
- [x] Breadcrumb atau tombol kembali yang jelas pada detail produk dan detail order.
- [x] Halaman 404 dengan tombol kembali ke katalog.
- [ ] Konfirmasi sebelum logout jika checkout atau form profil sedang diisi.

### Katalog dan Keranjang

- [x] Badge jumlah item pada ikon keranjang.
- [x] Halaman keranjang khusus untuk mengubah qty, menghapus item, dan mengosongkan
  keranjang.
- [x] Dialog konfirmasi sebelum mengosongkan keranjang.
- [x] Cegah qty melebihi stok langsung dari input.
- [ ] Beri tanda jika harga atau stok berubah sejak item dimasukkan ke keranjang.
- [x] Tombol "Bagikan produk" menggunakan Web Share API atau salin tautan.
- [x] Tombol retry pada katalog/detail produk ketika request gagal.
- [ ] Sorting "rating tertinggi" dan "paling banyak terjual" setelah datanya tersedia.
- [ ] Simpan posisi scroll dan filter ketika kembali dari detail produk.

### Checkout dan Pesanan

- [x] Ringkasan jumlah item pada tombol checkout.
- [x] Konfirmasi akhir sebelum mengirim pembayaran.
- [x] Peringatan ketika user meninggalkan halaman saat pembayaran sedang diproses.
- [x] Tombol salin untuk order ID, transaction ID, dan tracking ID.
- [x] Tombol "Beli Lagi" dari order selesai.
- [x] Tombol retry pada halaman checkout gagal.
- [x] Tampilkan alasan tombol aksi disabled, misalnya stok habis atau saldo kurang.
- [ ] Tampilkan tanggal dan jam status order, bukan hanya urutan status.
- [x] Konfirmasi sebelum buyer menandai pesanan telah diterima.

### Kualitas Antarmuka

- [ ] Skeleton loading yang konsisten untuk katalog, order, dan profil.
- [x] Empty state dengan tindakan relevan, misalnya "Mulai Belanja".
- [x] Pesan error katalog dan pesanan yang ramah pengguna serta tombol coba lagi.
- [ ] Layout mobile untuk tabel/ringkasan yang saat ini lebar.
- [ ] Fokus keyboard, label form, dan teks alternatif gambar yang memadai.
- [ ] Format mata uang, tanggal, dan nomor telepon konsisten dalam locale Indonesia.

## P0 - Wajib dan Risiko Tinggi

### 1. Checkout Aman dan Idempotent

- [ ] Tambahkan `idempotency_key` pada checkout agar klik ganda tidak membuat dua
  order atau dua payment request.
- [ ] Lakukan reservasi/pengurangan stok secara atomik di database.
- [ ] Tolak kuantitas nol, negatif, pecahan, produk duplikat, dan jumlah tidak wajar.
- [ ] Simpan riwayat perubahan status order.
- [ ] Sediakan retry pembayaran tanpa membuat order baru.
- [ ] Bedakan status `payment_pending`, `paid`, `payment_failed`, dan
  `expired`.

**Kriteria selesai:** request checkout yang sama hanya menghasilkan satu order,
stok tidak bisa menjadi negatif, dan kegagalan payment dapat dipulihkan.

### 2. Rincian Biaya yang Transparan

- [ ] Tampilkan harga barang, fee marketplace 2%, ongkir LogistiKita, fee Gateway,
  fee SmartBank, pajak, dan total akhir sesuai kontrak integrasi.
- [ ] Beri penjelasan singkat untuk setiap biaya.
- [ ] Simpan snapshot rincian biaya pada order agar histori tidak berubah.

**Catatan scope:** PasarKita hanya menampilkan dan meneruskan komponen biaya.
Perubahan saldo tetap dilakukan SmartBank.

### 3. Profil dan Buku Alamat Nyata

- [ ] Buat API update profil.
- [ ] Simpan nomor telepon dan foto profil.
- [ ] Sediakan beberapa alamat dengan label Rumah, Kantor, atau Lainnya.
- [ ] Pilih alamat utama saat checkout.
- [ ] Buat API ganti password dengan validasi password lama.

### 4. Pagination dan Filter Produk Sebenarnya

- [ ] Hubungkan tombol pagination ke query `page`.
- [ ] Tambahkan filter rentang harga dan ketersediaan stok.
- [ ] Pertahankan filter di URL agar halaman dapat dibagikan.
- [ ] Tampilkan jumlah hasil dan tombol reset filter.

### 5. Tracking Pengiriman yang Lebih Jelas

- [ ] Tampilkan timeline status dari LogistiKita, bukan hanya satu status terakhir.
- [ ] Tampilkan nomor tracking, waktu update, dan estimasi tiba jika tersedia.
- [ ] Beri tombol refresh status.
- [ ] Beri pesan khusus jika pengiriman gagal dibuat setelah payment sukses.

## P1 - Pengalaman Marketplace Matang

### 6. Wishlist dan Produk Terakhir Dilihat

- [ ] Simpan wishlist per akun.
- [ ] Tambahkan tombol favorit pada kartu dan detail produk.
- [ ] Tampilkan produk terakhir dilihat.
- [ ] Beri notifikasi saat stok wishlist kembali tersedia.

### 7. Halaman Toko Penjual

- [ ] Tampilkan profil toko, daftar produk, rating, dan jumlah produk terjual.
- [ ] Sediakan pencarian produk di dalam toko.
- [ ] Tampilkan indikator performa sederhana seperti ketepatan pengiriman.

### 8. Pembatalan, Komplain, dan Refund

- [ ] Buyer dapat membatalkan sebelum pembayaran atau sebelum diproses penjual.
- [ ] Buyer dapat mengajukan komplain dengan alasan dan bukti.
- [ ] Admin menjadi mediator sengketa.
- [ ] Refund wajib dikirim sebagai request ke SmartBank, bukan mengubah saldo lokal.
- [ ] Semua keputusan memiliki audit trail.

### 9. Notifikasi Transaksional

- [ ] Notifikasi payment berhasil/gagal.
- [ ] Notifikasi order diproses, dikirim, tiba, atau dibatalkan.
- [ ] Notifikasi respons komplain dan pengingat memberi ulasan.
- [ ] Status baca tersimpan di backend.
- [ ] Setiap notifikasi mengarah ke halaman yang relevan.

### 10. Ulasan yang Lebih Berguna

- [ ] Rating per produk dan per penjual.
- [ ] Foto ulasan dengan moderasi.
- [ ] Label pembelian terverifikasi.
- [ ] Filter ulasan berdasarkan bintang.
- [ ] Penjual dapat memberi satu respons resmi.

### 11. Invoice dan Bukti Transaksi

- [ ] Sediakan invoice web yang dapat dicetak.
- [ ] Tampilkan ID order, ID transaksi SmartBank, rincian fee, alamat, dan tracking.
- [ ] Gunakan snapshot nama serta harga produk saat pembelian.

## P2 - Inovasi Pembeda

### 12. Belanja Berbasis Dampak UMKM

Tampilkan cerita singkat dan indikator yang dapat diverifikasi, misalnya produk
lokal, bahan lokal, jumlah tenaga kerja, atau daerah produksi. Hindari klaim yang
tidak memiliki bukti.

### 13. Rekomendasi Hemat dan Relevan

- Rekomendasi berbasis kategori dan histori lihat tanpa harus memakai AI kompleks.
- "Lengkapi keranjang" berdasarkan pasangan produk yang sering dibeli bersama.
- Peringatan jika item serupa dari toko yang sama dapat menghemat ongkir.

### 14. Anggaran Belanja Sehat

Buyer dapat menentukan batas belanja mingguan. Sebelum checkout, sistem memberi
ringkasan netral tentang sisa anggaran tanpa memblokir transaksi secara paksa.

### 15. Pusat Transparansi Pesanan

Satu panel menjelaskan aliran order dari PasarKita ke Gateway, SmartBank, dan
LogistiKita menggunakan status yang mudah dipahami. Fitur ini cocok untuk demo
integrasi tugas besar sekaligus memberi kepercayaan kepada pengguna.

## Urutan Implementasi Disarankan

1. Checkout idempotent, validasi stok, dan riwayat status.
2. Rincian seluruh biaya serta integrasi ongkir.
3. Profil, buku alamat, dan ganti password.
4. Pagination nyata dan penyimpanan gambar produk.
5. Notifikasi transaksional.
6. Wishlist, halaman toko, dan invoice.
7. Pembatalan, komplain, serta refund.
8. Quick wins antarmuka dikerjakan bertahap bersama setiap fitur terkait.
9. Fitur inovasi setelah data operasional cukup.

## Bukan Prioritas Saat Ini

- PayLater, live shopping, gamifikasi koin, dan dompet internal.
- PasarKita tidak boleh membuat saldo atau memproses refund sendiri.
- Rekomendasi berbasis machine learning belum perlu sebelum event data tersedia.
