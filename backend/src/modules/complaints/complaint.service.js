const pool = require('../../config/mysql');
const { randomUUID } = require('crypto');
const { AppError } = require('../../utils/app-error');
const {
  notifyComplaintCreated,
  notifyComplaintReplied,
  notifyComplaintResolved
} = require('../notifications/notification.service');

const createComplaint = async (buyerId, orderId, payload) => {
  const [orderRows] = await pool.query(
    `SELECT o.id, o.status, o.buyer_id,
            oi.product_id, p.seller_id
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
     INNER JOIN products p ON p.id = oi.product_id
     WHERE o.id = ? LIMIT 1`,
    [orderId]
  );
  const order = orderRows[0];

  if (!order) throw new AppError(404, 'NOT_FOUND', 'Pesanan tidak ditemukan');
  if (order.buyer_id !== buyerId) throw new AppError(403, 'FORBIDDEN', 'Tidak diizinkan mengakses pesanan ini');
  if (!['shipped', 'delivered'].includes(order.status)) {
    throw new AppError(400, 'INVALID_STATUS', 'Komplain hanya dapat diajukan untuk pesanan yang sudah dikirim atau diterima');
  }

  const [existing] = await pool.query('SELECT id FROM complaints WHERE order_id = ?', [orderId]);
  if (existing.length > 0) {
    throw new AppError(409, 'COMPLAINT_ALREADY_EXISTS', 'Komplain untuk pesanan ini sudah diajukan sebelumnya');
  }

  const sellerId = order.seller_id;
  if (!sellerId) throw new AppError(500, 'SELLER_NOT_FOUND', 'Gagal mendeteksi penjual');

  const complaintId = randomUUID();
  await pool.query(
    `INSERT INTO complaints (id, order_id, buyer_id, seller_id, type, description, status)
     VALUES (?, ?, ?, ?, ?, ?, 'open')`,
    [complaintId, orderId, buyerId, sellerId, payload.type, payload.description]
  );

  void notifyComplaintCreated(sellerId, orderId);

  const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [complaintId]);
  return rows[0];
};

const getComplaints = async (userId, role, filters = {}) => {
  let sql = `SELECT c.*,
    o.status AS order_status, o.total AS order_total, o.created_at AS order_created_at, o.tracking_id,
    b.name AS buyer_name, b.email AS buyer_email,
    s.name AS seller_name, s.email AS seller_email
  FROM complaints c
  INNER JOIN orders o ON o.id = c.order_id
  INNER JOIN users b ON b.id = c.buyer_id
  INNER JOIN users s ON s.id = c.seller_id`;
  const params = [];

  if (role === 'buyer') {
    sql += ' WHERE c.buyer_id = ?';
    params.push(userId);
  } else if (role === 'seller') {
    sql += ' WHERE c.seller_id = ?';
    params.push(userId);
  } else if (role === 'superadmin' && filters.status) {
    sql += ' WHERE c.status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY c.created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
};

const getComplaintById = async (complaintId, userId, role) => {
  const [rows] = await pool.query(
    `SELECT c.*,
      o.status AS order_status, o.total AS order_total, o.created_at AS order_created_at, o.tracking_id,
      b.name AS buyer_name, b.email AS buyer_email,
      s.name AS seller_name, s.email AS seller_email
    FROM complaints c
    INNER JOIN orders o ON o.id = c.order_id
    INNER JOIN users b ON b.id = c.buyer_id
    INNER JOIN users s ON s.id = c.seller_id
    WHERE c.id = ?`,
    [complaintId]
  );
  const data = rows[0];
  if (!data) throw new AppError(404, 'NOT_FOUND', 'Komplain tidak ditemukan');
  if (role === 'buyer' && data.buyer_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Akses ditolak');
  if (role === 'seller' && data.seller_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Akses ditolak');
  return data;
};

const replyComplaint = async (sellerId, complaintId, replyText) => {
  const comp = await getComplaintById(complaintId, sellerId, 'seller');
  if (comp.status !== 'open') {
    throw new AppError(400, 'INVALID_STATUS', 'Hanya bisa merespons komplain yang berstatus open');
  }

  await pool.query(
    'UPDATE complaints SET seller_response = ?, status = ? WHERE id = ?',
    [replyText, 'seller_replied', complaintId]
  );

  void notifyComplaintReplied(comp.buyer_id, comp.order_id);

  const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [complaintId]);
  return rows[0];
};

const resolveComplaint = async (buyerId, complaintId, accepted) => {
  const comp = await getComplaintById(complaintId, buyerId, 'buyer');
  if (comp.status !== 'seller_replied') {
    throw new AppError(400, 'INVALID_STATUS', 'Komplain belum direspons penjual');
  }

  const newStatus = accepted ? 'resolved' : 'admin_review';
  await pool.query('UPDATE complaints SET status = ? WHERE id = ?', [newStatus, complaintId]);

  if (accepted) {
    void notifyComplaintResolved(comp.seller_id, comp.order_id, true);
  }

  const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [complaintId]);
  return rows[0];
};

const adminResolveComplaint = async (adminId, complaintId, payload) => {
  const comp = await getComplaintById(complaintId, adminId, 'superadmin');
  if (comp.status !== 'admin_review') {
    throw new AppError(400, 'INVALID_STATUS', 'Hanya komplain dengan status admin_review yang bisa diputuskan admin');
  }

  await pool.query(
    'UPDATE complaints SET status = ?, admin_notes = ? WHERE id = ?',
    [payload.action, payload.notes, complaintId]
  );

  await pool.query(
    `INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, reason)
     VALUES (UUID(), ?, ?, 'complaint', ?, ?)`,
    [adminId, `resolve_complaint_${payload.action}`, complaintId, payload.notes]
  );

  void notifyComplaintResolved(comp.buyer_id, comp.order_id, false);
  void notifyComplaintResolved(comp.seller_id, comp.order_id, true);

  const [rows] = await pool.query('SELECT * FROM complaints WHERE id = ?', [complaintId]);
  return rows[0];
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  replyComplaint,
  resolveComplaint,
  adminResolveComplaint,
};
