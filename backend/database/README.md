# Database PasarKita

Folder ini menjadi sumber schema MySQL PasarKita yang portabel.

## Struktur

- `schema/000_mysql_full_schema.sql`: setup lengkap tabel, index, constraints untuk MySQL 8.0+.
- `schema/001_mysql_stored_procedures.sql`: stored procedures untuk operasi bisnis.
- `schema/002_mysql_triggers.sql`: triggers untuk audit dan validasi otomatis.
- `scripts/apply-migrations.js`: runner migration untuk MySQL.
- `archive_pg/`: arsip schema PostgreSQL/Supabase lama (referensi historis).

## Setup Database MySQL Baru

Buat database baru:

```sql
CREATE DATABASE pasarkita CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Jalankan schema files secara berurutan:

```bash
cd backend

# Jalankan schema utama
mysql -u root -p pasarkita < database/schema/000_mysql_full_schema.sql

# Jalankan stored procedures
mysql -u root -p pasarkita < database/schema/001_mysql_stored_procedures.sql

# Jalankan triggers
mysql -u root -p pasarkita < database/schema/002_mysql_triggers.sql
```

## Seeding Data Demo

Untuk menambahkan data demo (users, products, sellers):

```bash
cd backend
npm run seed:demo
```

Script seeder:
- `seed.js`: Data mock minimal (3 users, 4 products)
- `seed-demo-catalog.js`: Katalog lengkap (4 sellers, 40+ products, 8 buyers, 1 admin)

## Konfigurasi Environment

Setup `.env` dengan kredensial MySQL Anda:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=pasarkita
```

## Migrasi dari Supabase (PostgreSQL)

Schema PostgreSQL/Supabase lama tersimpan di folder `archive_pg/` sebagai referensi historis. Konversi tipe data utama:

- UUID → CHAR(36)
- TIMESTAMPTZ → DATETIME
- BOOLEAN → TINYINT(1)
- JSONB → JSON
- TEXT[] → JSON
- gen_random_uuid() → UUID() (application layer)
