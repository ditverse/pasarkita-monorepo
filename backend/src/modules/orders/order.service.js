const pool = require('../../config/mysql');
const { triggerShipping } = require('../../integrations/logistikita');
const axios = require('axios');
const env = require('../../config/env');
const { writeAuditLog, writeIntegrationLog } = require('../../utils/observability');
const { getIntegrationTarget } = require('../../integrations/target');
const { kmpSearch } = require('../../utils/kmp-search');
const { AppError } = require('../../utils/app-error');
const { ORDER_STATUSES, ROLE_STATUS_POLICY, ORDER_STATUS } = require('../../constants');
const { parsePositiveInt, escapeCSV } = require('../../utils/shared');

const ORDER_SORTS = {
  created_desc: 'o.created_at DESC', created_asc: 'o.created_at ASC',
  total_desc: 'o.total DESC', total_asc: 'o.total ASC',
  status_asc: 'o.status ASC', status_desc: 'o.status DESC',
  updated_desc: 'o.updated_at DESC', updated_asc: 'o.updated_at ASC',
  action_deadline: 'o.created_at ASC',
};

const getOrders = async (user, query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;
  const orderBy = ORDER_SORTS[query.sort] || ORDER_SORTS.created_desc;

  let where = [];
  let params = [];

  if (user.role === 'buyer') { where.push('o.buyer_id = ?'); params.push(user.id); }

  if (user.role === 'seller') {
    const [sellerItems] = await pool.query(
      `SELECT DISTINCT oi.order_id FROM order_items oi
       INNER JOIN products p ON p.id = oi.product_id WHERE p.seller_id = ?`, [user.id]
    );
    const sellerOrderIds = sellerItems.map(i => i.order_id);
    if (sellerOrderIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, total_pages: 0 } };
    }
    where.push(`o.id IN (${sellerOrderIds.map(() => '?').join(',')})`);
    params.push(...sellerOrderIds);
  }

  if (query.status && ORDER_STATUSES.has(query.status)) { where.push('o.status = ?'); params.push(query.status); }
  if (query.created_from) { where.push('o.created_at >= ?'); params.push(new Date(`${query.created_from}T00:00:00+07:00`).toISOString()); }
  if (query.created_to) { where.push('o.created_at <= ?'); params.push(new Date(`${query.created_to}T23:59:59.999+07:00`).toISOString()); }

  // Admin search
  if (user.role === 'superadmin' && query.search?.trim()) {
    const term = query.search.trim().replace(/[%_,]/g, '');
    const [buyerUsers] = await pool.query(
      `SELECT id FROM users WHERE role = 'buyer' AND (name LIKE ? OR email LIKE ?)`,
      [`%${term}%`, `%${term}%`]
    );
    const buyerIds = buyerUsers.map(b => b.id);
    const conditions = [`(o.id LIKE ? OR o.transaction_id LIKE ? OR o.tracking_id LIKE ?`];
    params.push(`${term}%`, `%${term}%`, `%${term}%`);
    if (buyerIds.length > 0) {
      conditions[0] += ` OR o.buyer_id IN (${buyerIds.map(() => '?').join(',')})`;
      params.push(...buyerIds);
    }
    conditions[0] += ')';
    where.push(conditions[0]);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Count
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM orders o ${whereClause}`, params
  );
  const total = countRow.cnt;

  // Data with joins
  const [orders] = await pool.query(
    `SELECT o.*,
      b.name AS buyer_name, b.email AS buyer_email
     FROM orders o
     LEFT JOIN users b ON b.id = o.buyer_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Fetch order items for each order
  const orderIds = orders.map(o => o.id);
  if (orderIds.length > 0) {
    const ph = orderIds.map(() => '?').join(',');
    const [items] = await pool.query(
      `SELECT oi.*, p.name AS product_name, p.seller_id AS product_seller_id,
              s.name AS seller_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN users s ON s.id = p.seller_id
       WHERE oi.order_id IN (${ph})`,
      orderIds
    );

    const itemsByOrder = new Map();
    items.forEach(item => {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder.get(item.order_id).push({
        product_id: item.product_id,
        product_name: item.product_name_at_purchase ?? item.product_name ?? 'Produk dihapus',
        seller: item.product_seller_id ? { id: item.product_seller_id, name: item.seller_name } : null,
        qty: item.qty,
        price_at_purchase: item.price_at_purchase,
        original_price_at_purchase: item.original_price_at_purchase ?? item.price_at_purchase,
        product_discount_per_unit: item.product_discount_per_unit ?? 0,
        product_discount_id: item.product_discount_id ?? null,
      });
    });

    orders.forEach(order => {
      order.buyer = order.buyer_name ? { id: order.buyer_id, name: order.buyer_name, email: order.buyer_email } : null;
      order.items = itemsByOrder.get(order.id) || [];
    });
  }

  return {
    data: orders,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

const getOrderById = async (user, orderId) => {
  const [orderRows] = await pool.query(
    `SELECT o.*, b.name AS buyer_name, b.email AS buyer_email
     FROM orders o LEFT JOIN users b ON b.id = o.buyer_id WHERE o.id = ?`, [orderId]
  );
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');

  order.buyer = order.buyer_name ? { id: order.buyer_id, name: order.buyer_name, email: order.buyer_email } : null;

  const [items] = await pool.query(
    `SELECT oi.*, p.name AS product_name, p.category AS product_category, p.seller_id AS product_seller_id,
            s.name AS seller_name, s.email AS seller_email
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN users s ON s.id = p.seller_id
     WHERE oi.order_id = ?`, [orderId]
  );

  order.items = items.map(item => ({
    product_id: item.product_id,
    product_name: item.product_name_at_purchase ?? item.product_name ?? 'Produk dihapus',
    category: item.product_category ?? null,
    seller: item.product_seller_id ? { id: item.product_seller_id, name: item.seller_name, email: item.seller_email } : null,
    qty: item.qty,
    price_at_purchase: item.price_at_purchase,
    original_price_at_purchase: item.original_price_at_purchase ?? item.price_at_purchase,
    product_discount_per_unit: item.product_discount_per_unit ?? 0,
    product_discount_id: item.product_discount_id ?? null,
  }));

  // Access checks
  if (user.role === 'seller') {
    if (!order.items.some(i => i.seller?.id === user.id)) {
      throw new AppError(403, 'FORBIDDEN', 'Akses ditolak');
    }
  } else if (user.role !== 'superadmin' && order.buyer_id !== user.id) {
    throw new AppError(403, 'FORBIDDEN', 'Akses ditolak');
  }

  // Status history
  const [statusHistory] = await pool.query(
    'SELECT id, status, source, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
  order.status_history = statusHistory;

  // Vouchers
  const [vouchers] = await pool.query(
    'SELECT id, voucher_id, voucher_code, scope, seller_id, discount_type, discount_amount, eligible_subtotal, created_at FROM order_vouchers WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
  order.vouchers = vouchers.map(v => ({ id: v.voucher_id, code: v.voucher_code, scope: v.scope, seller_id: v.seller_id, discount_type: v.discount_type, discount_amount: v.discount_amount, eligible_subtotal: v.eligible_subtotal, created_at: v.created_at }));

  // Admin audit & integration logs
  if (user.role === 'superadmin') {
    const [auditLogs] = await pool.query(
      `SELECT aal.*, au.name AS actor_name, au.email AS actor_email
       FROM admin_audit_logs aal LEFT JOIN users au ON au.id = aal.actor_id
       WHERE aal.target_type = 'order' AND aal.target_id = ?
       ORDER BY aal.created_at DESC LIMIT 20`, [orderId]
    );
    order.audit_history = { available: true, data: auditLogs.map(l => ({ ...l, actor: l.actor_name ? { id: l.actor_id, name: l.actor_name, email: l.actor_email } : null })) };

    const [intLogs] = await pool.query(
      'SELECT id, service, operation, success, duration_ms, status_code, error_code, created_at FROM integration_logs WHERE order_id = ? ORDER BY created_at ASC',
      [orderId]
    );
    order.integration_timeline = { available: true, data: intLogs };
  }

  return order;
};

const updateOrderStatus = async (user, orderId, status, reason = null) => {
  const allowed = ROLE_STATUS_POLICY[user.role] || [];

  if (!allowed.includes(status)) {
    throw new AppError(403, 'FORBIDDEN', `Status tidak valid. Pilihan: ${allowed.join(', ')}`);
  }
  if (user.role === 'superadmin' && (!reason || reason.trim().length < 3)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Alasan perubahan status wajib diisi oleh admin');
  }

  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');

  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

  if (user.role === 'superadmin') {
    await writeAuditLog({
      actorId: user.id, action: 'order.status_changed', targetType: 'order', targetId: orderId, reason,
      before: { status: order.status }, after: { status },
    });
  }

  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  return rows[0];
};

const startProcessing = async (user, orderId, pickupAddress) => {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');

  // Verify seller owns items
  const [sellerItems] = await pool.query(
    `SELECT 1 FROM order_items oi INNER JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ? AND p.seller_id = ? LIMIT 1`, [orderId, user.id]
  );
  if (sellerItems.length === 0) throw new AppError(403, 'FORBIDDEN', 'Akses ditolak');

  if (order.status !== ORDER_STATUS.PAID) throw new AppError(400, 'INVALID_STATUS', 'Hanya pesanan berstatus paid yang dapat mulai diproses');

  await pool.query(
    'UPDATE orders SET status = ?, pickup_address_snapshot = ? WHERE id = ? AND status = ?',
    ['processing', pickupAddress.trim(), orderId, 'paid']
  );
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  return rows[0];
};

const saveShippingSync = async (orderId, status, errorMessage = null, trackingId = undefined) => {
  const fields = ['shipping_sync_status = ?', 'shipping_sync_error = ?', 'shipping_sync_updated_at = NOW()'];
  const params = [status, errorMessage];
  if (trackingId !== undefined) { fields.push('tracking_id = ?'); params.push(trackingId); }
  params.push(orderId);
  await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, params);
};

const syncShipping = async (order) => {
  await saveShippingSync(order.id, 'pending');
  try {
    let trackingId = order.tracking_id;
    if (!trackingId) {
      const result = await triggerShipping({
        orderId: order.id,
        fromAddress: order.pickup_address_snapshot,
        toAddress: order.shipping_address,
        itemsCount: (order.items || []).reduce((sum, item) => sum + item.qty, 0),
      });
      trackingId = result.data?.tracking_id ?? null;
      if (!trackingId) throw new AppError(502, 'TRACKING_ID_MISSING', 'LogistiKita tidak mengembalikan tracking ID');
    } else {
      const target = getIntegrationTarget('logistikita', `/shipping/${trackingId}`);
      const startedAt = Date.now();
      try {
        const response = await axios.patch(target.url, { status: 'picked_up' }, {
          headers: { Authorization: `Bearer ${env.GATEWAY_API_KEY || 'mock-key'}` },
          timeout: 5000,
        });
        await writeIntegrationLog({ service: target.logService, operation: 'shipping.update', success: true, durationMs: Date.now() - startedAt, orderId: order.id, statusCode: response.status });
      } catch (error) {
        await writeIntegrationLog({ service: target.logService, operation: 'shipping.update', success: false, durationMs: Date.now() - startedAt, orderId: order.id, statusCode: error.response?.status ?? null, errorCode: error.response?.data?.error?.code ?? 'GATEWAY_ERROR' });
        throw error;
      }
    }
    await saveShippingSync(order.id, 'synced', null, trackingId);
    return trackingId;
  } catch (error) {
    const message = error.message || 'Sinkronisasi LogistiKita gagal';
    await saveShippingSync(order.id, 'failed', message);
    throw new AppError(error.status || 502, 'LOGISTICS_SYNC_FAILED', message);
  }
};

const shipOrder = async (user, orderId) => {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');

  const [sellerItems] = await pool.query(
    'SELECT 1 FROM order_items oi INNER JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND p.seller_id = ? LIMIT 1',
    [orderId, user.id]
  );
  if (sellerItems.length === 0) throw new AppError(403, 'FORBIDDEN', 'Akses ditolak');
  if (order.status !== ORDER_STATUS.PROCESSING) throw new AppError(400, 'INVALID_STATUS', 'Pesanan harus berstatus processing sebelum dikirim');

  await syncShipping(order);
  await pool.query('UPDATE orders SET status = ? WHERE id = ? AND status = ?', ['shipped', orderId, 'processing']);
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  return rows[0];
};

const retryShipping = async (user, orderId) => {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');
  if (order.status !== ORDER_STATUS.PROCESSING) throw new AppError(400, 'INVALID_STATUS', 'Sinkronisasi hanya dapat dilakukan saat pesanan diproses');
  if (!order.pickup_address_snapshot) throw new AppError(400, 'PICKUP_REQUIRED', 'Alamat pickup belum dikonfirmasi');

  const trackingId = await syncShipping(order);
  return { tracking_id: trackingId, shipping_sync_status: 'synced' };
};

const getPackingList = async (user, orderId) => {
  const [orderRows] = await pool.query(
    `SELECT o.*, b.name AS buyer_name FROM orders o LEFT JOIN users b ON b.id = o.buyer_id WHERE o.id = ?`, [orderId]
  );
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');

  const [items] = await pool.query(
    `SELECT oi.*, p.seller_id, p.name AS pname FROM order_items oi
     INNER JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ? AND p.seller_id = ?`,
    [orderId, user.id]
  );

  const [profileRows] = await pool.query(
    'SELECT store_name, contact_phone, pickup_address FROM seller_profiles WHERE seller_id = ?', [user.id]
  );
  const profile = profileRows[0];

  return {
    order_id: order.id, created_at: order.created_at,
    buyer_name: order.buyer_name || 'Pembeli',
    shipping_address: order.shipping_address, tracking_id: order.tracking_id,
    pickup_address: order.pickup_address_snapshot || profile?.pickup_address || null,
    store_name: profile?.store_name || user.name || 'Toko',
    contact_phone: profile?.contact_phone || null,
    items: items.map(item => ({ product_id: item.product_id, product_name: item.product_name_at_purchase || item.pname || 'Produk', qty: item.qty })),
  };
};

const cancelOrder = async (orderId, buyerId) => {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ? AND buyer_id = ?', [orderId, buyerId]);
  const order = orderRows[0];
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Order tidak ditemukan');
  if (order.status !== ORDER_STATUS.PENDING) throw new AppError(400, 'INVALID_STATUS', 'Hanya pesanan pending yang dapat dibatalkan');

  await pool.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);

  if (order.stock_reserved) {
    await pool.query('CALL sp_release_checkout_stock(?)', [orderId]).catch(e => {
      console.error('[cancelOrder] Gagal restore stok:', e);
    });
  }

  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  return rows[0];
};

const exportOrdersBySeller = async (sellerId, query) => {
  const [sellerItems] = await pool.query(
    `SELECT DISTINCT oi.order_id FROM order_items oi
     INNER JOIN products p ON p.id = oi.product_id WHERE p.seller_id = ?`, [sellerId]
  );
  const sellerOrderIds = sellerItems.map(i => i.order_id);
  if (sellerOrderIds.length === 0) {
    return { csv: 'ID,Status,Subtotal,Fee,Total,Pembeli,Alamat Pengiriman,Resi,Dibuat\r\n', count: 0, truncated: false };
  }

  let where = [`o.id IN (${sellerOrderIds.map(() => '?').join(',')})`];
  let params = [...sellerOrderIds];
  if (query.status && ORDER_STATUSES.has(query.status)) { where.push('o.status = ?'); params.push(query.status); }
  if (query.created_from) { where.push('o.created_at >= ?'); params.push(new Date(`${query.created_from}T00:00:00+07:00`).toISOString()); }
  if (query.created_to) { where.push('o.created_at <= ?'); params.push(new Date(`${query.created_to}T23:59:59.999+07:00`).toISOString()); }

  const [data] = await pool.query(
    `SELECT o.id, o.status, o.subtotal, o.fee_marketplace, o.total, o.shipping_address, o.transaction_id, o.tracking_id, o.created_at,
            b.name AS buyer_name
     FROM orders o LEFT JOIN users b ON b.id = o.buyer_id
     WHERE ${where.join(' AND ')} ORDER BY o.created_at DESC LIMIT 5000`,
    params
  );

  const STATUS_LABEL = { pending: 'Menunggu Pembayaran', paid: 'Perlu Diproses', processing: 'Sedang Dikemas', shipped: 'Sedang Dikirim', delivered: 'Selesai', payment_failed: 'Pembayaran Gagal' };
  const headers = ['Order ID', 'Status', 'Subtotal', 'Fee Marketplace', 'Total', 'Nama Pembeli', 'Alamat Pengiriman', 'Transaction ID', 'Nomor Resi', 'Tanggal Order'];
  const lines = [headers.join(','), ...data.map(row => [
    row.id, escapeCSV(STATUS_LABEL[row.status] ?? row.status), row.subtotal, row.fee_marketplace, row.total,
    escapeCSV(row.buyer_name), escapeCSV(row.shipping_address), escapeCSV(row.transaction_id), escapeCSV(row.tracking_id),
    row.created_at ? new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '',
  ].join(','))];

  return { csv: lines.join('\r\n'), count: data.length, truncated: data.length >= 5000 };
};

module.exports = {
  getOrders, getOrderById, updateOrderStatus, startProcessing, shipOrder, retryShipping,
  getPackingList, cancelOrder, exportOrdersBySeller,
};
