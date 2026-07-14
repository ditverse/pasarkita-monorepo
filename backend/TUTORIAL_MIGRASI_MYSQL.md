# TUTORIAL MIGRASI DATABASE MYSQL PASARKITA

## ✅ STATUS MIGRASI

**Tanggal**: 7 Juli 2026
**Database**: pasarkita
**Host**: localhost:3306
**User**: root

### Yang Sudah Selesai:

✅ Schema database (19 tabel) berhasil dibuat
✅ Stored procedures (6 prosedur) berhasil dibuat
✅ Triggers (3 trigger) berhasil dibuat
✅ Data demo berhasil di-seed

---

## 📊 DATA YANG TERSEDIA

### 1. Admin (Super Admin)
- **Email**: admin@pasarkita.demo
- **Password**: password123
- **Jumlah**: 1 akun

### 2. Seller (Penjual)
- **Nusantara Rasa** - seller.rasa@pasarkita.demo
- **Kriya Lokal** - seller.kriya@pasarkita.demo
- **Gaya UMKM** - seller.gaya@pasarkita.demo
- **Rumah Cerdas** - seller.cerdas@pasarkita.demo
- **Password**: password123
- **Jumlah**: 4 toko
- **Status**: Semua sudah verified (demo_verified)

### 3. Buyer (Pembeli)
- Alya Putri - alya.putri@pasarkita.demo
- Bagas Pratama - bagas.pratama@pasarkita.demo
- Citra Lestari - citra.lestari@pasarkita.demo
- Dimas Saputra - dimas.saputra@pasarkita.demo
- Farah Ramadhani - farah.ramadhani@pasarkita.demo
- Galih Nugroho - galih.nugroho@pasarkita.demo
- Intan Maharani - intan.maharani@pasarkita.demo
- Yoga Kurniawan - yoga.kurniawan@pasarkita.demo
- **Password**: password123
- **Jumlah**: 8 akun

### 4. Produk
- **Jumlah**: 32 produk
- **Kategori**: Makanan, Fashion, Kerajinan, Rumah, Elektronik, Kecantikan, Olahraga, Buku
- **Range Harga**: Rp 24.000 - Rp 295.000
- **Distribusi**:
  - Nusantara Rasa: 8 produk (makanan & minuman)
  - Kriya Lokal: 8 produk (kerajinan & rumah)
  - Gaya UMKM: 8 produk (fashion)
  - Rumah Cerdas: 8 produk (elektronik, kecantikan, olahraga)

---

## 🗃️ STRUKTUR DATABASE

### Tabel Utama (19 tabel):

1. **users** - Data pengguna (buyer, seller, superadmin)
2. **seller_profiles** - Profil toko seller
3. **products** - Katalog produk
4. **user_addresses** - Alamat pengiriman user
5. **vouchers** - Voucher diskon
6. **product_discounts** - Diskon produk
7. **orders** - Data pesanan
8. **order_items** - Detail item pesanan
9. **order_status_history** - Riwayat status order
10. **ratings** - Rating & review produk
11. **notifications** - Notifikasi user
12. **complaints** - Komplain pesanan
13. **order_chat_messages** - Chat order
14. **product_chat_threads** - Thread chat produk
15. **product_chat_messages** - Pesan chat produk
16. **banners** - Banner marketplace
17. **banner_analytics** - Analitik banner
18. **ads** - Iklan seller
19. **ad_analytics** - Analitik iklan

### Stored Procedures (6):

1. `sp_create_checkout_order` - Checkout atomik dengan idempotency
2. `sp_release_checkout_stock` - Release reservasi stok
3. `sp_increment_banner_views` - Increment view banner
4. `sp_increment_ad_views` - Increment view iklan
5. `sp_increment_banner_clicks` - Increment click banner
6. `sp_increment_ad_clicks` - Increment click iklan

### Triggers (3):

1. `trg_product_chat_messages_touch_thread` - Update timestamp thread chat
2. `trg_orders_record_status_event` - Catat history status order
3. `trg_orders_set_fulfillment_timestamps` - Set timestamp processing/shipped

---

## 🔍 CARA VERIFIKASI DATA

### Menggunakan Navicat:

1. Buka Navicat
2. Connect ke database `pasarkita`
3. Jalankan query berikut untuk verifikasi:

```sql
-- Cek jumlah user per role
SELECT role, COUNT(*) as jumlah 
FROM users 
GROUP BY role;

-- Cek seller dan toko
SELECT u.name, u.email, sp.store_name, sp.verification_status
FROM users u
JOIN seller_profiles sp ON u.id = sp.seller_id
WHERE u.role = 'seller';

-- Cek produk per seller
SELECT 
  sp.store_name,
  COUNT(p.id) as jumlah_produk,
  MIN(p.price) as harga_termurah,
  MAX(p.price) as harga_termahal,
  SUM(p.stock) as total_stok
FROM products p
JOIN seller_profiles sp ON p.seller_id = sp.seller_id
GROUP BY sp.store_name;

-- Cek kategori produk
SELECT category, COUNT(*) as jumlah
FROM products
GROUP BY category
ORDER BY jumlah DESC;

-- Cek stored procedures
SHOW PROCEDURE STATUS WHERE Db = 'pasarkita';

-- Cek triggers
SHOW TRIGGERS FROM pasarkita;
```

---

## 🚀 CARA MENJALANKAN BACKEND

### 1. Start Backend Server:

```bash
cd pasarkita-monorepo/backend
npm run dev
```

Backend akan berjalan di `http://localhost:3001`

### 2. Test Endpoint:

```bash
# Health check
curl http://localhost:3001/api/health

# Login sebagai admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pasarkita.demo","password":"password123"}'

# Login sebagai seller
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller.rasa@pasarkita.demo","password":"password123"}'

# Login sebagai buyer
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alya.putri@pasarkita.demo","password":"password123"}'
```

### 3. Test Query Produk:

```bash
# Get semua produk
curl http://localhost:3001/api/products

# Get produk by category
curl http://localhost:3001/api/products?category=Makanan
```

---

## 📝 FILE KONFIGURASI

### File .env yang digunakan:

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=hakim
MYSQL_DATABASE=pasarkita

# JWT
JWT_SECRET=MarketplacePasarKita2026_SecretKey_Security!

# API Gateway
GATEWAY_BASE_URL=https://gateway.vercel.app/api
GATEWAY_API_KEY=your_gateway_api_key

# Integrations (Mock)
SMARTBANK_URL=http://localhost:4001/smartbank
LOGISTIKITA_URL=http://localhost:4002/logistikita

# App
NODE_ENV=development
PORT=3001
```

---

## 🔧 SCRIPT YANG DIBUAT

### migrate.js

Script custom untuk menjalankan migrasi schema MySQL dengan handling DELIMITER untuk stored procedures dan triggers.

**Lokasi**: `pasarkita-monorepo/backend/migrate.js`

**Cara pakai**:
```bash
cd pasarkita-monorepo/backend
node migrate.js
```

---

## 📦 NPM SCRIPTS TERSEDIA

```bash
# Development dengan auto-reload
npm run dev

# Production mode
npm start

# Migrasi database (custom script)
node migrate.js

# Seed data demo
npm run seed:demo

# Test (placeholder)
npm test
```

---

## ⚠️ CATATAN PENTING

### 1. Password Demo
Semua akun demo menggunakan password: **password123**
Untuk production, gunakan password yang lebih kuat.

### 2. Data Non-Destruktif
Seeder `seed-demo-catalog.js` bersifat non-destruktif:
- Tidak menghapus data yang sudah ada
- Hanya menambahkan data baru jika belum ada
- Aman dijalankan berulang kali

### 3. Stored Procedures
Checkout menggunakan stored procedure `sp_create_checkout_order` untuk:
- Transaksi atomik
- Stock reservation
- Idempotency handling
- Deadlock prevention

### 4. Triggers
Triggers otomatis:
- Mencatat history status order
- Update timestamp chat thread
- Set timestamp fulfillment

---

## 🎯 NEXT STEPS

### 1. Jalankan Backend
```bash
cd pasarkita-monorepo/backend
npm run dev
```

### 2. Jalankan Frontend (opsional)
```bash
cd pasarkita-monorepo/frontend
npm install
npm run dev
```

### 3. Jalankan Mock Server (opsional)
```bash
cd pasarkita-monorepo/mock
npm install
npm run dev
```

### 4. Test Full Flow
1. Login sebagai buyer
2. Browse produk
3. Tambah ke cart
4. Checkout (akan hit SmartBank mock jika running)
5. Tracking order

---

## 🐛 TROUBLESHOOTING

### Error: Cannot connect to MySQL
**Solusi**: 
- Pastikan MySQL service running
- Cek kredensial di `.env`
- Test koneksi di Navicat

### Error: DELIMITER syntax error
**Solusi**: 
- Gunakan script `migrate.js` yang sudah dibuat
- Jangan gunakan mysql CLI untuk stored procedures

### Error: bcrypt not found
**Solusi**: 
```bash
npm install
```

### Ingin reset database
```bash
# Drop semua tabel
DROP DATABASE pasarkita;
CREATE DATABASE pasarkita CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Jalankan ulang migrasi
node migrate.js
npm run seed:demo
```

---

## 📚 REFERENSI

- **README Backend**: `pasarkita-monorepo/backend/README.md`
- **Database README**: `pasarkita-monorepo/backend/database/README.md`
- **Schema SQL**: `pasarkita-monorepo/backend/database/schema/*.sql`
- **AGENTS.md**: `pasarkita-monorepo/AGENTS.md`

---

**Selamat! Database PasarKita sudah siap digunakan! 🎉**
