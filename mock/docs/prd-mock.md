# PRD — Mock Server

## Marketplace — PasarKita

**Mata Kuliah:** Rekayasa Perangkat Lunak 2
**Dosen:** M. Yusril Helmi Setyawan, S.Kom., M.Kom.
**Kelompok:** 2 — PasarKita (Marketplace)
**Dokumen:** Mock Server Specification
**Versi:** 1.1
**Tanggal:** 18 April 2026

---

## 1. Overview

Dokumen ini mendeskripsikan setup dan implementasi mock server yang digunakan selama fase development dan unit testing PasarKita. Mock server mensimulasikan response dari service eksternal — SmartBank (Kelompok 1) dan LogistiKita (Kelompok 5) — sehingga development dan testing dapat berjalan sepenuhnya tanpa bergantung pada kesiapan kelompok lain.

Mock server **hanya berjalan secara lokal** di mesin developer, tidak pernah di-deploy ke environment manapun. Seluruh file mock berada di dalam `backend/mock/` — bagian dari repo `pasarkita` yang sama.

---

## 2. Kenapa Mock Server Dibutuhkan

PasarKita beroperasi dalam ekosistem terkontrol dengan limitasi finansial yang langsung berdampak ke proses testing:

| Limitasi | Nilai | Dampak ke Testing |
|---|---|---|
| Saldo awal user | Rp 50.000 | Satu user hanya bisa checkout ~8–9 kali sebelum saldo habis |
| Fee total per transaksi | ~5.5% | Marketplace 2% + bank 1% + gateway 0.5% + pajak 2% = saldo cepat terkuras |
| Max transaksi harian | 10x per user | Automated test yang hit checkout berkali-kali akan kena 429 |
| Cooldown transaksi | 10–30 detik | Test sequential checkout harus ada `sleep()` antar request |
| Total money supply | Rp 1.000.000.000 | Tidak bisa bebas buat akun test dengan saldo tinggi |

Testing full flow checkout ke SmartBank asli sangat terbatas. Mock server bukan opsional — ini **keharusan** selama development agar bisa test semua skenario tanpa khawatir saldo habis atau kena cooldown.

---

## 3. Environment Testing

| Environment | Marketplace | SmartBank | LogistiKita | Tujuan |
|---|---|---|---|---|
| Development | Local (port 3001) | Mock (port 4001) | Mock (port 4002) | Feature dev & unit test |
| Integration | Local / Vercel | Server asli (dev kelompok 1) | Server asli (dev kelompok 5) | Test koneksi antar kelompok |
| Demo | Vercel | Server asli | Server asli | Presentasi ke dosen |

---

## 4. Struktur Folder

Mock server berada di dalam `backend/mock/` — subfolder dari repo `pasarkita`:

```
pasarkita/                          ← root repo
├── frontend/
├── backend/
│   ├── src/
│   ├── mock/                       ← scope dokumen ini
│   │   ├── package.json            # Dependencies & scripts
│   │   ├── server.js               # Entry point, jalankan semua mock
│   │   ├── smartbank/
│   │   │   ├── db.json             # State saldo & riwayat transaksi
│   │   │   └── routes.js           # Handler semua endpoint SmartBank
│   │   └── logistikita/
│   │       ├── db.json             # State pengiriman
│   │       └── routes.js           # Handler semua endpoint LogistiKita
│   └── package.json
└── README.md
```

---

## 5. Setup & Instalasi

**`mock/package.json`:**

```json
{
  "name": "pasarkita-mock",
  "version": "1.0.0",
  "scripts": {
    "all": "concurrently \"node server.js --service=smartbank\" \"node server.js --service=logistikita\"",
    "smartbank": "node server.js --service=smartbank",
    "logistikita": "node server.js --service=logistikita"
  },
  "dependencies": {
    "express": "^4.18.0",
    "concurrently": "^8.0.0"
  }
}
```

**`mock/server.js`:**

```javascript
const express = require('express')
const smartbankRoutes = require('./smartbank/routes')
const logistiKitaRoutes = require('./logistikita/routes')

// Mock SmartBank — port 4001
const smartbank = express()
smartbank.use(express.json())
smartbank.use('/smartbank', smartbankRoutes)
smartbank.listen(4001, () => console.log('[Mock] SmartBank running on :4001'))

// Mock LogistiKita — port 4002
const logistikita = express()
logistikita.use(express.json())
logistikita.use('/logistikita', logistiKitaRoutes)
logistikita.listen(4002, () => console.log('[Mock] LogistiKita running on :4002'))
```

---

## 6. Mock SmartBank

Mensimulasikan semua skenario response SmartBank yang mungkin dihadapi Marketplace saat proses checkout.

### 6.1 State

**`mock/smartbank/db.json`:**

```json
{
  "balances": {
    "user_test_buyer": 500000,
    "user_test_seller": 200000
  },
  "transactions": []
}
```

> Saldo di mock sengaja dibuat jauh lebih besar dari ekosistem asli (Rp 500.000 vs Rp 50.000) agar testing tidak terhambat saldo habis.

### 6.2 Endpoint

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/smartbank/payment` | ✓ (JWT header) | Proses pembayaran |
| GET | `/smartbank/balance/:userId` | ✗ | Cek saldo user (debug) |
| POST | `/smartbank/debug/reset` | ✗ | Reset saldo user ke nilai tertentu |

### 6.3 Handler

**`mock/smartbank/routes.js`:**

```javascript
const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, 'db.json')
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
const writeDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))

// In-memory tracker untuk cooldown & daily limit
const lastTransaction = {}
const dailyCount = {}

router.post('/payment', (req, res) => {
  const { from_user, amount, metadata } = req.body

  // Simulasi JWT check
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED' }
    })
  }

  // Simulasi cooldown 10 detik
  const now = Date.now()
  if (lastTransaction[from_user] && now - lastTransaction[from_user] < 10_000) {
    const retryAfter = Math.ceil((10_000 - (now - lastTransaction[from_user])) / 1000)
    return res.status(429).json({
      success: false,
      error: { code: 'TRANSACTION_COOLDOWN', retry_after: retryAfter }
    })
  }

  // Simulasi limit harian 10 transaksi
  const today = new Date().toDateString()
  if (!dailyCount[from_user] || dailyCount[from_user].date !== today) {
    dailyCount[from_user] = { date: today, count: 0 }
  }
  if (dailyCount[from_user].count >= 10) {
    return res.status(429).json({
      success: false,
      error: { code: 'DAILY_LIMIT_EXCEEDED' }
    })
  }

  // Simulasi saldo tidak cukup
  const db = readDb()
  const balance = db.balances[from_user] ?? 0
  if (balance < amount) {
    return res.status(402).json({
      success: false,
      message: 'Pembayaran gagal: saldo tidak mencukupi',
      error: { code: 'PAYMENT_FAILED', details: 'INSUFFICIENT_BALANCE' }
    })
  }

  // Sukses — kurangi saldo, catat transaksi
  db.balances[from_user] = balance - amount
  lastTransaction[from_user] = now
  dailyCount[from_user].count++

  const txnId = `TXN-MOCK-${Date.now()}`
  db.transactions.push({ id: txnId, from_user, amount, order_id: metadata?.order_id })
  writeDb(db)

  res.status(200).json({
    success: true,
    message: 'Pembayaran berhasil',
    data: { transaction_id: txnId }
  })
})

router.get('/balance/:userId', (req, res) => {
  const db = readDb()
  const balance = db.balances[req.params.userId] ?? 0
  res.json({ success: true, data: { user_id: req.params.userId, balance } })
})

router.post('/debug/reset', (req, res) => {
  const { user_id, amount } = req.body
  const db = readDb()
  db.balances[user_id] = amount ?? 500000
  writeDb(db)
  res.json({ success: true, message: `Saldo ${user_id} direset ke ${db.balances[user_id]}` })
})

module.exports = router
```

### 6.4 Skenario yang Disimulasikan

| Skenario | Trigger | Response |
|---|---|---|
| Pembayaran sukses | Saldo cukup, cooldown clear, limit belum tercapai | 200, transaction_id |
| Saldo tidak cukup | `amount > balance` | 402, PAYMENT_FAILED |
| Cooldown aktif | Request < 10 detik dari transaksi sebelumnya | 429, TRANSACTION_COOLDOWN + retry_after |
| Limit harian tercapai | Sudah 10 transaksi hari ini | 429, DAILY_LIMIT_EXCEEDED |
| Token tidak ada | Header Authorization kosong | 401, UNAUTHORIZED |

---

## 7. Mock LogistiKita

Mensimulasikan proses pembuatan dan update status pengiriman.

### 7.1 State

**`mock/logistikita/db.json`:**

```json
{
  "shipments": []
}
```

### 7.2 Endpoint

| Method | Endpoint | Auth | Deskripsi |
|---|---|---|---|
| POST | `/logistikita/shipping` | ✗ | Buat pengiriman baru |
| PATCH | `/logistikita/shipping/:trackingId` | ✗ | Update status pengiriman |
| GET | `/logistikita/shipping/:trackingId` | ✗ | Cek status pengiriman |

### 7.3 Handler

**`mock/logistikita/routes.js`:**

```javascript
const express = require('express')
const router = express.Router()
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, 'db.json')
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
const writeDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))

router.post('/shipping', (req, res) => {
  const { order_id, from_address, to_address } = req.body

  // Simulasi validasi alamat terlalu pendek
  if (!to_address || to_address.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ADDRESS', details: 'Alamat tujuan tidak valid atau terlalu pendek' }
    })
  }

  const db = readDb()
  const trackingId = `SHP-MOCK-${Date.now()}`
  db.shipments.push({ tracking_id: trackingId, order_id, status: 'created', from_address, to_address })
  writeDb(db)

  res.status(200).json({
    success: true,
    data: { tracking_id: trackingId, status: 'created' }
  })
})

router.patch('/shipping/:trackingId', (req, res) => {
  const { status } = req.body
  const validStatuses = ['created', 'picked_up', 'in_transit', 'delivered']

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', details: `Status harus salah satu dari: ${validStatuses.join(', ')}` }
    })
  }

  const db = readDb()
  const shipment = db.shipments.find(s => s.tracking_id === req.params.trackingId)
  if (!shipment) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  }

  shipment.status = status
  writeDb(db)
  res.json({ success: true, data: { tracking_id: shipment.tracking_id, status } })
})

router.get('/shipping/:trackingId', (req, res) => {
  const db = readDb()
  const shipment = db.shipments.find(s => s.tracking_id === req.params.trackingId)
  if (!shipment) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } })
  }
  res.json({ success: true, data: shipment })
})

module.exports = router
```

### 7.4 Skenario yang Disimulasikan

| Skenario | Trigger | Response |
|---|---|---|
| Pengiriman berhasil dibuat | Alamat valid (≥10 karakter) | 200, tracking_id |
| Alamat tidak valid | `to_address` kosong atau < 10 karakter | 400, INVALID_ADDRESS |
| Update status sukses | Status valid, tracking_id ditemukan | 200, status baru |
| Tracking tidak ditemukan | tracking_id tidak ada di db | 404, NOT_FOUND |

---

## 8. Environment Switching (Mock vs Real)

Gunakan environment variable untuk switch antara mock dan service asli — tidak perlu ubah kode sama sekali.

**`.env.development`** — pakai mock saat dev lokal:

```env
GATEWAY_BASE_URL=http://localhost:4000
SMARTBANK_URL=http://localhost:4001/smartbank
LOGISTIKITA_URL=http://localhost:4002/logistikita
```

**`.env.integration`** — pakai server asli kelompok lain saat integration test:

```env
GATEWAY_BASE_URL=https://gateway-kelompok7.vercel.app/api
SMARTBANK_URL=https://smartbank-kelompok1.vercel.app/api
LOGISTIKITA_URL=https://logistikita-kelompok5.vercel.app/api
```

Di kode integrasi backend, baca dari `process.env` — switch environment cukup ganti file `.env`:

```javascript
// src/integrations/smartbank.js
const sendPaymentRequest = async (payload) => {
  return axios.post(`${process.env.SMARTBANK_URL}/payment`, payload, {
    headers: { Authorization: `Bearer ${process.env.GATEWAY_API_KEY}` },
    timeout: 8000
  })
}
```

---

## 9. Cara Menjalankan

```bash
# 1. Dari root repo, masuk ke folder mock
cd pasarkita/backend/mock

# 2. Install dependencies
npm install

# 3. Jalankan semua mock sekaligus
npm run all

# Output yang diharapkan:
# [Mock] SmartBank running on :4001
# [Mock] LogistiKita running on :4002
```

Jalankan backend di terminal terpisah:

```bash
cd pasarkita/backend
npm run dev    # Backend berjalan di port 3001
```

---

## 10. Referensi Endpoint Mock

| Service | Method | Endpoint | Deskripsi |
|---|---|---|---|
| SmartBank | POST | `localhost:4001/smartbank/payment` | Proses pembayaran |
| SmartBank | GET | `localhost:4001/smartbank/balance/:userId` | Cek saldo (debug) |
| SmartBank | POST | `localhost:4001/smartbank/debug/reset` | Reset saldo (testing) |
| LogistiKita | POST | `localhost:4002/logistikita/shipping` | Buat pengiriman |
| LogistiKita | PATCH | `localhost:4002/logistikita/shipping/:id` | Update status kirim |
| LogistiKita | GET | `localhost:4002/logistikita/shipping/:id` | Cek status kirim |