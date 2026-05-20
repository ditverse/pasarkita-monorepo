const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const writeDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

const DEFAULT_BALANCE = 500_000;

// In-memory tracker
const lastTransaction = {};
const dailyCount = {};

// ── Dashboard ────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ── Payment ──────────────────────────────────────────────────
router.post('/payment', (req, res) => {
  const { from_user, amount, metadata } = req.body;

  if (!from_user || !amount) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: 'from_user dan amount wajib diisi' },
    });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', details: 'Token tidak ditemukan' },
    });
  }

  const now = Date.now();

  // Cooldown 10 detik
  if (lastTransaction[from_user] && now - lastTransaction[from_user] < 10_000) {
    const retryAfter = Math.ceil((10_000 - (now - lastTransaction[from_user])) / 1000);
    return res.status(429).json({
      success: false,
      message: `Terlalu cepat. Coba lagi dalam ${retryAfter} detik`,
      error: { code: 'TRANSACTION_COOLDOWN', retry_after: retryAfter },
    });
  }

  // Limit harian 10 transaksi
  const today = new Date().toDateString();
  if (!dailyCount[from_user] || dailyCount[from_user].date !== today) {
    dailyCount[from_user] = { date: today, count: 0 };
  }
  if (dailyCount[from_user].count >= 10) {
    return res.status(429).json({
      success: false,
      message: 'Batas 10 transaksi harian telah tercapai',
      error: { code: 'DAILY_LIMIT_EXCEEDED' },
    });
  }

  const db = readDb();
  if (db.balances[from_user] === undefined) {
    db.balances[from_user] = DEFAULT_BALANCE;
  }

  const balance = db.balances[from_user];

  if (balance < amount) {
    return res.status(402).json({
      success: false,
      message: 'Pembayaran gagal: saldo tidak mencukupi',
      error: { code: 'PAYMENT_FAILED', details: 'INSUFFICIENT_BALANCE' },
    });
  }

  db.balances[from_user] = balance - amount;
  lastTransaction[from_user] = now;
  dailyCount[from_user].count++;

  const txnId = `TXN-MOCK-${Date.now()}`;
  db.transactions.push({
    id: txnId,
    from_user,
    amount,
    order_id: metadata?.order_id ?? null,
    created_at: new Date().toISOString(),
  });
  writeDb(db);

  console.log(`[Mock SmartBank] Payment OK — user=${from_user} amount=${amount} txn=${txnId}`);

  return res.status(200).json({
    success: true,
    message: 'Pembayaran berhasil',
    data: { transaction_id: txnId },
  });
});

// ── Balance ──────────────────────────────────────────────────
router.get('/balance/:userId', (req, res) => {
  const db = readDb();
  const userId = req.params.userId;

  if (db.balances[userId] === undefined) {
    db.balances[userId] = DEFAULT_BALANCE;
    writeDb(db);
  }

  return res.json({
    success: true,
    data: { user_id: userId, balance: db.balances[userId] },
  });
});

// ── Debug: state lengkap untuk dashboard ────────────────────
router.get('/debug/state', (req, res) => {
  const db = readDb();
  const now = Date.now();

  // Gabungkan cooldown + daily count per user
  const allUsers = new Set([
    ...Object.keys(db.balances),
    ...Object.keys(lastTransaction),
    ...Object.keys(dailyCount),
  ]);

  const cooldowns = {};
  for (const uid of allUsers) {
    const last = lastTransaction[uid];
    const today = new Date().toDateString();
    const dc = dailyCount[uid];
    const todayCount = dc && dc.date === today ? dc.count : 0;

    if (last || todayCount > 0) {
      cooldowns[uid] = {
        lastTxn: last ?? 0,
        remainingMs: last ? Math.max(0, 10_000 - (now - last)) : 0,
        todayCount,
      };
    }
  }

  return res.json({
    success: true,
    data: { balances: db.balances, transactions: db.transactions, cooldowns },
  });
});

// ── Debug: set saldo ─────────────────────────────────────────
router.post('/debug/reset', (req, res) => {
  const { user_id, amount } = req.body;

  if (!user_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: 'user_id wajib diisi' },
    });
  }

  const db = readDb();
  db.balances[user_id] = amount ?? DEFAULT_BALANCE;
  writeDb(db);

  console.log(`[Mock SmartBank] Balance set — user=${user_id} balance=${db.balances[user_id]}`);

  return res.json({
    success: true,
    message: `Saldo ${user_id} diset ke ${db.balances[user_id]}`,
  });
});

// ── Debug: reset cooldown per user ───────────────────────────
router.post('/debug/reset-cooldown', (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: 'user_id wajib diisi' },
    });
  }

  delete lastTransaction[user_id];
  if (dailyCount[user_id]) {
    dailyCount[user_id].count = 0;
  }

  console.log(`[Mock SmartBank] Cooldown reset — user=${user_id}`);

  return res.json({ success: true, message: `Cooldown ${user_id} direset` });
});

// ── Debug: hapus semua transaksi ─────────────────────────────
router.post('/debug/clear-transactions', (req, res) => {
  const db = readDb();
  db.transactions = [];
  writeDb(db);

  console.log('[Mock SmartBank] Transactions cleared');

  return res.json({ success: true, message: 'Semua transaksi dihapus' });
});

// ── Debug: reset semua state ─────────────────────────────────
router.post('/debug/reset-all', (req, res) => {
  writeDb({ balances: {}, transactions: [] });
  Object.keys(lastTransaction).forEach((k) => delete lastTransaction[k]);
  Object.keys(dailyCount).forEach((k) => delete dailyCount[k]);

  console.log('[Mock SmartBank] Full reset done');

  return res.json({ success: true, message: 'Semua state SmartBank direset' });
});

module.exports = router;
