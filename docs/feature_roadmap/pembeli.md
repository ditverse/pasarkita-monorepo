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
- Source aktual frontend dan backend PasarKita per 14 Juni 2026.

## Status Fitur Saat Ini

| Area | Status | Catatan |
|---|---|---|
| Registrasi dan login | Ada | JWT dan role sudah tersedia |
| Browse, cari, filter, urutkan produk | Ada | Pagination dan filter dijalankan server-side |
| Detail produk | Ada | Foto utama produk tampil dengan fallback placeholder |
| Keranjang multi-item | Ada sebagian | Persisten di browser; checkout masih dilakukan per produk |
| Kalkulasi subtotal dan fee 2% | Ada | Sudah memakai endpoint fee |
| Checkout dan pembayaran SmartBank | Ada | Checkout idempotent dan reservasi stok atomik sudah aktif melalui RPC Supabase |
| Riwayat dan detail order | Ada | Histori status bertimestamp dan tracking tersedia |
| Konfirmasi pesanan diterima | Ada | Buyer dapat mengubah `shipped` menjadi `delivered` |
| Rating dan ulasan | Ada | Belum mendukung foto atau respons penjual |
| Profil | Ada sebagian | Nama dan email tersimpan; telepon, alamat, dan foto menunggu schema |
| Ganti password | Ada | Memvalidasi password lama dan menyimpan hash password baru |
| Notifikasi | Ada | Payment, pengiriman, penyelesaian, status baca, dan deep-link order tersimpan di backend |
| Wishlist | Ada lokal | Persisten per akun/browser; sinkron lintas perangkat menunggu backend |
| Voucher, komplain, refund | Belum | Belum ada model data maupun halaman |

## Quick Wins - Fitur Kecil tetapi Logis

Fitur berikut relatif kecil, tetapi berpengaruh besar terhadap kelancaran alur
harian pembeli.

### Akun dan Navigasi

- [ ] Fitur lupa password dan reset password.
- [x] Tombol tampilkan/sembunyikan password yang konsisten pada login, register,
  dan ganti password.
- [x] Redirect kembali ke halaman tujuan setelah login, bukan selalu ke halaman
  default.
- [x] Breadcrumb atau tombol kembali yang jelas pada detail produk dan detail order.
- [x] Halaman 404 dengan tombol kembali ke katalog.
- [x] Konfirmasi sebelum logout dari halaman profil.

### Katalog dan Keranjang

- [x] Badge jumlah item pada ikon keranjang.
- [x] Halaman keranjang khusus untuk mengubah qty, menghapus item, dan mengosongkan
  keranjang.
- [x] Dialog konfirmasi sebelum mengosongkan keranjang.
- [x] Cegah qty melebihi stok langsung dari input.
- [x] Beri tanda jika harga atau stok berubah sejak item dimasukkan ke keranjang,
  lalu tahan checkout sampai data lokal diperbarui.
- [x] Tombol "Bagikan produk" menggunakan Web Share API atau salin tautan.
- [x] Tombol retry pada katalog/detail produk ketika request gagal.
- [x] Sorting "rating tertinggi" dan "paling banyak terjual" berdasarkan rating
  aktual dan unit pada order valid.
- [x] Simpan posisi scroll dan filter ketika kembali dari detail produk.

### Checkout dan Pesanan

- [x] Ringkasan jumlah item pada tombol checkout.
- [x] Konfirmasi akhir sebelum mengirim pembayaran.
- [x] Peringatan ketika user meninggalkan halaman saat pembayaran sedang diproses.
- [x] Tombol salin untuk order ID, transaction ID, dan tracking ID.
- [x] Tombol "Beli Lagi" dari order selesai.
- [x] Tombol retry pada halaman checkout gagal.
- [x] Tampilkan alasan tombol aksi disabled, misalnya stok habis atau saldo kurang.
- [x] Tampilkan tanggal dan jam status order berdasarkan histori event database,
  bukan hanya urutan status.
- [x] Konfirmasi sebelum buyer menandai pesanan telah diterima.

### Kualitas Antarmuka

- [x] Skeleton loading yang konsisten untuk katalog, order, profil, dan halaman toko.
- [x] Empty state dengan tindakan relevan, misalnya "Mulai Belanja".
- [x] Pesan error katalog dan pesanan yang ramah pengguna serta tombol coba lagi.
- [x] Layout responsif untuk katalog, detail produk, keranjang, checkout, pesanan,
  profil, navbar, dan footer.
- [x] Fokus keyboard terlihat jelas, form utama berlabel, dan gambar produk memiliki
  teks alternatif.
- [ ] Format mata uang, tanggal, dan nomor telepon konsisten dalam locale Indonesia.

## P0 - Wajib dan Risiko Tinggi

### 1. Checkout Aman dan Idempotent

- [x] Tambahkan `idempotency_key` pada checkout agar klik ganda tidak membuat dua
  order atau dua payment request.
- [x] Lakukan reservasi/pengurangan stok secara atomik di database.
- [x] Tolak kuantitas nol, negatif, pecahan, produk duplikat, dan jumlah tidak wajar.
- [x] Simpan riwayat perubahan status order melalui trigger database agar checkout,
  seller, buyer, dan admin tercatat konsisten.
- [ ] Sediakan retry pembayaran tanpa membuat order baru.
- [ ] Bedakan status `payment_pending`, `paid`, `payment_failed`, dan
  `expired`.

**Kriteria selesai:** request checkout yang sama hanya menghasilkan satu order,
stok tidak bisa menjadi negatif, dan kegagalan payment dapat dipulihkan.

**Status implementasi:** migration sudah diterapkan pada Supabase. Smoke test
transaksional membuktikan satu idempotency key hanya menghasilkan satu order,
stok berkurang sekali, replay mengembalikan order yang sama, dan pelepasan
reservasi memulihkan stok. Seluruh data smoke test di-rollback.

### 2. Rincian Biaya yang Transparan

- [ ] Tampilkan harga barang, fee marketplace 2%, ongkir LogistiKita, fee Gateway,
  fee SmartBank, pajak, dan total akhir sesuai kontrak integrasi.
- [ ] Beri penjelasan singkat untuk setiap biaya.
- [ ] Simpan snapshot rincian biaya pada order agar histori tidak berubah.

**Catatan scope:** PasarKita hanya menampilkan dan meneruskan komponen biaya.
Perubahan saldo tetap dilakukan SmartBank.

### 3. Profil dan Buku Alamat Nyata

- [x] Buat API update profil untuk nama dan email dengan validasi email unik.
- [x] **A. Profil Lengkap & Buku Alamat (Address Book)**
  - [x] Endpoint untuk menambahkan avatar, no HP, dll
  - [x] CRUD buku alamat
  - [x] Pilihan alamat utama (Primary)
  - [x] Di halaman checkout bisa pilih dari buku alamat (saat ini cuma input string)
- [x] **B. Pembatalan Pesanan Mandiri**
  - [x] Selama status masih *Pending* atau belum diproses seller
  - [x] Otomatis cancel dan restore stok
- [x] **C. Status Tracking Transparan**
  - [x] LogistiKita integrasi (fiktif, tapi timeline / history tracking harus clear di UI)
  - [x] Riwayat pesanan yang lebih mendetail (tanggal bayar, tanggal diproses, estimasi tiba)
- [x] Buat API ganti password dengan validasi password lama.

### 4. Pagination dan Filter Produk Sebenarnya

- [x] Hubungkan tombol pagination ke query `page`.
- [x] Tambahkan filter rentang harga dan ketersediaan stok.
- [x] Pertahankan filter di URL agar halaman dapat dibagikan.
- [x] Tampilkan jumlah hasil dan tombol reset filter.

### 5. Tracking Pengiriman yang Lebih Jelas

- [x] Tampilkan progres timeline berdasarkan status terbaru LogistiKita; histori
  timestamp per event menunggu dukungan API LogistiKita.
- [x] Tampilkan nomor tracking, waktu update, dan estimasi tiba jika tersedia.
- [x] Beri tombol refresh status.
- [x] Beri pesan khusus jika pengiriman gagal dibuat setelah payment sukses.

## P1 - Pengalaman Marketplace Matang

### 6. Wishlist dan Produk Terakhir Dilihat

- [x] Simpan wishlist lokal terpisah per akun/browser; sinkronisasi lintas perangkat
  menunggu tabel wishlist backend.
- [x] Tambahkan tombol favorit pada kartu dan detail produk.
- [x] Tampilkan produk terakhir dilihat.
- [ ] Beri notifikasi saat stok wishlist kembali tersedia.

### 7. Halaman Toko Penjual

- [x] Tampilkan profil toko, daftar produk, rating, dan jumlah unit terjual.
- [x] Sediakan pencarian produk di dalam toko.
- [x] Tampilkan indikator cakupan tracking sebagai performa operasional yang dapat
  diverifikasi; ketepatan waktu menunggu timestamp SLA per status.

### 8. Pembatalan, Komplain, dan Refund

- [ ] Buyer dapat membatalkan sebelum pembayaran atau sebelum diproses penjual.
- [ ] Buyer dapat mengajukan komplain dengan alasan dan bukti.
- [ ] Admin menjadi mediator sengketa.
- [ ] Refund wajib dikirim sebagai request ke SmartBank, bukan mengubah saldo lokal.
- [ ] Semua keputusan memiliki audit trail.

### 9. Notifikasi Transaksional

- [x] Notifikasi payment berhasil/gagal.
- [ ] Notifikasi order diproses, dikirim, tiba, atau dibatalkan; status dikirim dan
  selesai sudah aktif, sedangkan pembatalan menunggu workflow pembatalan.
- [ ] Notifikasi respons komplain; menunggu workflow komplain.
- [x] Pengingat memberi ulasan dikirim ketika order selesai.
- [x] Status baca tersimpan di backend.
- [x] Setiap notifikasi mengarah ke detail order yang relevan.

### 10. Ulasan yang Lebih Berguna

- [ ] Rating per produk dan per penjual.
- [ ] Foto ulasan dengan moderasi.
- [x] Label pembelian terverifikasi berdasarkan order milik buyer yang sudah selesai.
- [x] Filter ulasan berdasarkan bintang.
- [ ] Penjual dapat memberi satu respons resmi.

### 11. Invoice dan Bukti Transaksi

- [x] Sediakan invoice web yang dapat dicetak dari detail pesanan.
- [x] Tampilkan ID order, ID transaksi SmartBank, rincian fee, alamat, dan tracking.
- [x] Gunakan snapshot nama serta harga produk saat pembelian.

**Status implementasi:** harga sudah tersimpan sejak awal. Snapshot nama telah
diaktifkan dan sembilan item order lama berhasil di-backfill tanpa nilai kosong.

## P2 - Inovasi Pembeda

### 12. Belanja Berbasis Dampak UMKM

Tampilkan cerita singkat dan indikator yang dapat diverifikasi, misalnya produk
lokal, bahan lokal, jumlah tenaga kerja, atau daerah produksi. Hindari klaim yang
tidak memiliki bukti.

### 13. Rekomendasi Hemat dan Relevan

- [x] Rekomendasi berbasis kategori dan histori lihat tanpa memakai AI kompleks,
  dengan alasan rekomendasi yang dapat dipahami buyer.
- [ ] "Lengkapi keranjang" berdasarkan pasangan produk yang sering dibeli bersama.
- [ ] Peringatan jika item serupa dari toko yang sama dapat menghemat ongkir.

### 14. Anggaran Belanja Sehat

- [x] Buyer dapat menentukan atau menonaktifkan batas belanja mingguan dari profil.
- [x] Tampilkan total belanja dari order valid pada minggu berjalan.
- [x] Sebelum checkout, tampilkan sisa anggaran dan peringatan netral tanpa
  memblokir transaksi.
- [x] Pisahkan pengaturan lokal berdasarkan akun agar tidak tercampur pada browser
  yang sama; sinkronisasi lintas perangkat menunggu penyimpanan backend.

### 15. Pusat Transparansi Pesanan

- [x] Satu panel menjelaskan aliran order dari PasarKita, SmartBank, dan
  LogistiKita menggunakan status yang mudah dipahami.
- [x] Bedakan status terkonfirmasi, gagal, menunggu bukti, dan belum terverifikasi
  berdasarkan transaction ID serta tracking ID yang benar-benar tersimpan.
- [x] Jelaskan bahwa panel hanya menampilkan bukti yang telah diterima PasarKita
  agar tidak memberi klaim integrasi yang menyesatkan.

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
