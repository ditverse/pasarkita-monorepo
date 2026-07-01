const pool = require('../../config/mysql');

const getNotifications = async (userId, query = {}) => {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50);
  const [rows] = await pool.query(
    'SELECT id, order_id, type, title, message, href, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, limit]
  );
  return rows;
};

const markRead = async (userId, notificationId) => {
  const [result] = await pool.query(
    'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [notificationId, userId]
  );
  if (result.affectedRows === 0) throw { status: 404, code: 'NOT_FOUND', message: 'Notifikasi tidak ditemukan' };
  const [rows] = await pool.query('SELECT id, read_at FROM notifications WHERE id = ?', [notificationId]);
  return rows[0];
};

const markAllRead = async (userId) => {
  await pool.query('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [userId]);
  return { changed: true };
};

const createNotification = async ({ userId, type, title, message, href = null, orderId = null }) => {
  try {
    const id = require('crypto').randomUUID();
    await pool.query(
      'INSERT INTO notifications (id, user_id, type, title, message, href, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, type, title, message, href, orderId]
    );
  } catch (err) {
    console.error('[Notification] Gagal membuat notifikasi:', err?.message ?? err);
  }
};

const notifySellerNewOrder = async (orderId, orderItems) => {
  try {
    if (!Array.isArray(orderItems) || orderItems.length === 0) return;
    const productIds = [...new Set(orderItems.map(i => i.product_id))];
    if (productIds.length === 0) return;
    const [products] = await pool.query(
      `SELECT id, name, seller_id FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
      productIds
    );
    if (!products.length) return;

    const sellerMap = new Map();
    for (const item of orderItems) {
      const product = products.find(p => p.id === item.product_id);
      if (!product?.seller_id) continue;
      if (!sellerMap.has(product.seller_id)) sellerMap.set(product.seller_id, []);
      sellerMap.get(product.seller_id).push(product.name);
    }

    const notifs = [];
    for (const [sellerId, names] of sellerMap.entries()) {
      const label = names.length === 1 ? `"${names[0]}"` : `${names.length} produk`;
      notifs.push({ user_id: sellerId, type: 'order', title: 'Pesanan Baru Masuk!', message: `Ada pesanan baru untuk ${label}. Segera proses.`, href: `/seller/orders/${orderId}`, order_id: orderId });
    }
    if (notifs.length > 0) {
      for (const n of notifs) {
        await createNotification({ userId: n.user_id, type: n.type, title: n.title, message: n.message, href: n.href, orderId: n.order_id });
      }
    }
  } catch (err) {
    console.error('[Notification] notifySellerNewOrder error:', err?.message ?? err);
  }
};

const notifySellerLowStock = async (productId, productName, sellerId, newStock, minimumStock) => {
  try {
    const isOut = newStock <= 0;
    const isLow = !isOut && newStock <= minimumStock;
    if (!isOut && !isLow) return;

    const title = isOut ? 'Stok Produk Habis!' : 'Stok Produk Menipis';
    const message = isOut
      ? `"${productName}" kehabisan stok. Segera perbarui stok agar produk tetap aktif.`
      : `"${productName}" tersisa ${newStock} unit (batas minimum: ${minimumStock}). Pertimbangkan restok.`;
    await createNotification({ userId: sellerId, type: 'system', title, message: `${message} [id:${productId}]`, href: `/seller/products/edit/${productId}` });
  } catch (err) {
    console.error('[Notification] notifySellerLowStock error:', err?.message ?? err);
  }
};

const notifyComplaintCreated = async (sellerId, orderId) => {
  await createNotification({ userId: sellerId, type: 'COMPLAINT_NEW', title: 'Komplain Baru', message: 'Pembeli mengajukan komplain untuk pesanan ini. Harap segera berikan tanggapan.', href: '/seller/complaints', orderId });
};

const notifyComplaintReplied = async (buyerId, orderId) => {
  await createNotification({ userId: buyerId, type: 'COMPLAINT_REPLIED', title: 'Tanggapan Komplain', message: 'Penjual telah merespons komplain Anda. Harap cek pusat resolusi.', href: `/orders/${orderId}`, orderId });
};

const notifyComplaintResolved = async (userId, orderId, isSeller = false) => {
  await createNotification({ userId, type: 'COMPLAINT_RESOLVED', title: 'Komplain Selesai', message: 'Sengketa telah diselesaikan atau ditutup. Cek detail pesanan.', href: isSeller ? `/seller/orders/${orderId}` : `/orders/${orderId}`, orderId });
};

module.exports = {
  getNotifications, markRead, markAllRead, createNotification,
  notifySellerNewOrder, notifySellerLowStock,
  notifyComplaintCreated, notifyComplaintReplied, notifyComplaintResolved,
};
