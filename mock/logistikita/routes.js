const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const readDb = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const writeDb = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

const VALID_STATUSES = ['created', 'picked_up', 'in_transit', 'delivered'];

/**
 * POST /logistikita/shipping
 * Body: { order_id, from_address, to_address, items_count? }
 */
router.post('/shipping', (req, res) => {
  const { order_id, from_address, to_address, items_count } = req.body;

  if (!order_id) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', details: 'order_id wajib diisi' },
    });
  }

  if (!to_address || to_address.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ADDRESS', details: 'Alamat tujuan tidak valid atau terlalu pendek (min 10 karakter)' },
    });
  }

  const db = readDb();
  const trackingId = `SHP-MOCK-${Date.now()}`;

  db.shipments.push({
    tracking_id: trackingId,
    order_id,
    status: 'created',
    from_address: from_address ?? 'Gudang PasarKita',
    to_address: to_address.trim(),
    items_count: items_count ?? 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  writeDb(db);

  console.log(`[Mock LogistiKita] Shipment created — order=${order_id} tracking=${trackingId}`);

  return res.status(200).json({
    success: true,
    data: { tracking_id: trackingId, status: 'created' },
  });
});

/**
 * PATCH /logistikita/shipping/:trackingId
 * Body: { status }
 */
router.patch('/shipping/:trackingId', (req, res) => {
  const { status } = req.body;
  const { trackingId } = req.params;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_STATUS',
        details: `Status harus salah satu dari: ${VALID_STATUSES.join(', ')}`,
      },
    });
  }

  const db = readDb();
  const shipment = db.shipments.find((s) => s.tracking_id === trackingId);

  if (!shipment) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', details: `Tracking ID ${trackingId} tidak ditemukan` },
    });
  }

  shipment.status = status;
  shipment.updated_at = new Date().toISOString();
  writeDb(db);

  console.log(`[Mock LogistiKita] Status updated — tracking=${trackingId} status=${status}`);

  return res.json({
    success: true,
    data: { tracking_id: shipment.tracking_id, status },
  });
});

/**
 * GET /logistikita/shipping/:trackingId
 */
router.get('/shipping/:trackingId', (req, res) => {
  const db = readDb();
  const shipment = db.shipments.find((s) => s.tracking_id === req.params.trackingId);

  if (!shipment) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', details: `Tracking ID ${req.params.trackingId} tidak ditemukan` },
    });
  }

  return res.json({ success: true, data: shipment });
});

/**
 * POST /logistikita/debug/reset
 */
router.post('/debug/reset', (req, res) => {
  writeDb({ shipments: [] });
  console.log('[Mock LogistiKita] Full reset done');
  return res.json({ success: true, message: 'Semua shipment direset' });
});

module.exports = router;
