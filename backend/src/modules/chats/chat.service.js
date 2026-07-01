const pool = require('../../config/mysql');

const getOrderChatAccess = async (user, orderId) => {
  const [rows] = await pool.query(
    `SELECT o.id, o.buyer_id,
            oi.product_id, p.seller_id
     FROM orders o
     INNER JOIN order_items oi ON oi.order_id = o.id
     INNER JOIN products p ON p.id = oi.product_id
     WHERE o.id = ?`,
    [orderId]
  );
  if (!rows[0]) throw { status: 404, code: 'NOT_FOUND', message: 'Pesanan tidak ditemukan' };

  const order = rows[0];
  const sellerIds = new Set(rows.map(r => r.seller_id).filter(Boolean));

  if (user.role === 'superadmin') return { order: { id: order.id, buyer_id: order.buyer_id }, role: 'admin' };
  if (order.buyer_id === user.id) return { order: { id: order.id, buyer_id: order.buyer_id }, role: 'buyer' };
  if (sellerIds.has(user.id)) return { order: { id: order.id, buyer_id: order.buyer_id }, role: 'seller' };

  throw { status: 403, code: 'FORBIDDEN', message: 'Tidak diizinkan mengakses chat pesanan ini' };
};

const getMessagesByOrder = async (user, orderId, limit = 50) => {
  await getOrderChatAccess(user, orderId);

  const [rows] = await pool.query(
    `SELECT id, order_id, sender_id, content, created_at
     FROM order_chat_messages WHERE order_id = ?
     ORDER BY created_at ASC LIMIT ?`,
    [orderId, limit]
  );
  return rows;
};

const postMessage = async (user, orderId, content) => {
  const access = await getOrderChatAccess(user, orderId);
  if (access.role === 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Admin hanya dapat memantau chat pesanan' };
  }

  const msgId = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO order_chat_messages (id, order_id, sender_id, content) VALUES (?, ?, ?, ?)',
    [msgId, orderId, user.id, content]
  );

  const [rows] = await pool.query('SELECT * FROM order_chat_messages WHERE id = ?', [msgId]);
  return rows[0];
};

const mapProductThread = (thread) => ({
  id: thread.id,
  product_id: thread.product_id,
  buyer_id: thread.buyer_id,
  seller_id: thread.seller_id,
  created_at: thread.created_at,
  updated_at: thread.updated_at,
  product: thread.product_name ? {
    id: thread.product_id,
    name: thread.product_name,
    image_url: thread.product_image_url,
    price: thread.product_price,
  } : null,
  buyer: thread.buyer_name ? {
    id: thread.buyer_id,
    name: thread.buyer_name,
    email: thread.buyer_email,
  } : null,
  seller: thread.seller_name ? {
    id: thread.seller_id,
    name: thread.seller_name,
    email: thread.seller_email,
  } : null,
  last_message: thread.last_message_content ? {
    id: thread.last_message_id,
    sender_id: thread.last_message_sender_id,
    content: thread.last_message_content,
    created_at: thread.last_message_created_at,
  } : null,
});

const getProductThreadAccess = async (user, threadId) => {
  const [rows] = await pool.query(
    'SELECT id, product_id, buyer_id, seller_id FROM product_chat_threads WHERE id = ?',
    [threadId]
  );
  const thread = rows[0];
  if (!thread) throw { status: 404, code: 'NOT_FOUND', message: 'Thread chat tidak ditemukan' };
  if (user.role === 'superadmin') return { thread, role: 'admin' };
  if (thread.buyer_id === user.id) return { thread, role: 'buyer' };
  if (thread.seller_id === user.id) return { thread, role: 'seller' };
  throw { status: 403, code: 'FORBIDDEN', message: 'Tidak diizinkan mengakses thread chat ini' };
};

const listProductThreads = async (user) => {
  let sql = `SELECT t.id, t.product_id, t.buyer_id, t.seller_id, t.created_at, t.updated_at,
    p.name AS product_name, p.image_url AS product_image_url, p.price AS product_price,
    b.name AS buyer_name, b.email AS buyer_email,
    s.name AS seller_name, s.email AS seller_email,
    lm.id AS last_message_id, lm.sender_id AS last_message_sender_id,
    lm.content AS last_message_content, lm.created_at AS last_message_created_at
  FROM product_chat_threads t
  INNER JOIN products p ON p.id = t.product_id
  INNER JOIN users b ON b.id = t.buyer_id
  INNER JOIN users s ON s.id = t.seller_id
  LEFT JOIN product_chat_messages lm ON lm.thread_id = t.id AND lm.created_at = (
    SELECT MAX(created_at) FROM product_chat_messages WHERE thread_id = t.id
  )`;
  const params = [];

  if (user.role === 'buyer') {
    sql += ' WHERE t.buyer_id = ?';
    params.push(user.id);
  } else if (user.role === 'seller') {
    sql += ' WHERE t.seller_id = ?';
    params.push(user.id);
  }

  sql += ' ORDER BY t.updated_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapProductThread);
};

const startProductThread = async (user, productId, initialContent = '') => {
  if (user.role !== 'buyer') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Hanya buyer yang dapat memulai chat produk' };
  }

  const [prodRows] = await pool.query(
    'SELECT id, name, seller_id, is_active FROM products WHERE id = ?', [productId]
  );
  const product = prodRows[0];
  if (!product || !product.is_active) {
    throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  }
  if (product.seller_id === user.id) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Tidak dapat chat toko sendiri' };
  }

  // Upsert thread
  const [existing] = await pool.query(
    'SELECT id, product_id, buyer_id, seller_id, created_at, updated_at FROM product_chat_threads WHERE product_id = ? AND buyer_id = ? AND seller_id = ?',
    [productId, user.id, product.seller_id]
  );

  let thread;
  if (existing[0]) {
    thread = existing[0];
  } else {
    const threadId = require('crypto').randomUUID();
    await pool.query(
      'INSERT INTO product_chat_threads (id, product_id, buyer_id, seller_id) VALUES (?, ?, ?, ?)',
      [threadId, productId, user.id, product.seller_id]
    );
    const [rows] = await pool.query('SELECT * FROM product_chat_threads WHERE id = ?', [threadId]);
    thread = rows[0];
  }

  const trimmedContent = initialContent.trim();
  if (trimmedContent) {
    await sendProductThreadMessage(user, thread.id, trimmedContent);
  }

  return thread;
};

const getProductMessages = async (user, threadId, limit = 50) => {
  await getProductThreadAccess(user, threadId);
  const [rows] = await pool.query(
    `SELECT id, thread_id, sender_id, content, created_at
     FROM product_chat_messages WHERE thread_id = ?
     ORDER BY created_at ASC LIMIT ?`,
    [threadId, limit]
  );
  return rows || [];
};

const sendProductThreadMessage = async (user, threadId, content) => {
  const access = await getProductThreadAccess(user, threadId);
  if (access.role === 'admin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Admin hanya dapat memantau chat produk' };
  }

  const msgId = require('crypto').randomUUID();
  await pool.query(
    'INSERT INTO product_chat_messages (id, thread_id, sender_id, content) VALUES (?, ?, ?, ?)',
    [msgId, threadId, user.id, content]
  );

  const [rows] = await pool.query('SELECT * FROM product_chat_messages WHERE id = ?', [msgId]);
  return rows[0];
};

module.exports = {
  getMessagesByOrder,
  postMessage,
  listProductThreads,
  startProductThread,
  getProductMessages,
  sendProductThreadMessage,
};
