const pool = require('../../config/mysql');
const { writeAuditLog } = require('../../utils/observability');
const { kmpSearch } = require('../../utils/kmp-search');

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_ROLES = new Set(['buyer', 'seller', 'superadmin']);
const VALID_USER_STATUSES = new Set(['active', 'inactive']);
const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);
const REPORT_TYPES = new Set(['orders', 'users', 'sellers', 'products', 'analytics']);

const parsePositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const toIso = (date) => date.toISOString();

const startOfJakartaDay = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
};

const parsePeriod = (query) => {
  const now = new Date();
  let end = query.end ? new Date(query.end) : now;
  let start;
  if (Number.isNaN(end.getTime())) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tanggal akhir tidak valid' };
  if (query.start) { start = new Date(query.start); } else {
    const days = query.period === 'today' ? 1 : query.period === '7d' ? 7 : 30;
    start = startOfJakartaDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  }
  if (Number.isNaN(start.getTime()) || start >= end) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rentang tanggal tidak valid' };
  const duration = end.getTime() - start.getTime();
  if (duration > 366 * DAY_MS) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rentang analytics maksimal 366 hari' };
  const previousEnd = new Date(start.getTime());
  const previousStart = new Date(start.getTime() - duration);
  const granularity = duration <= 2 * DAY_MS ? 'hour' : 'day';
  return { start, end, previousStart, previousEnd, granularity };
};

const bucketKey = (iso, granularity) => {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', ...(granularity === 'hour' ? { hour: '2-digit', hourCycle: 'h23' } : {}) }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  return granularity === 'hour' ? `${day} ${values.hour}:00` : day;
};

const percentChange = (current, previous) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

const percentile = (values, pct) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1)];
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const summarizeOrders = (orders) => {
  const paidOrders = orders.filter(o => PAID_STATUSES.has(o.status));
  const paymentAttempts = orders.filter(o => o.status !== 'pending');
  const failedPayments = orders.filter(o => o.status === 'payment_failed');
  const gmv = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const marketplaceRevenue = paidOrders.reduce((s, o) => s + Number(o.fee_marketplace || 0), 0);
  return {
    gmv, marketplace_revenue: marketplaceRevenue, paid_orders: paidOrders.length, total_orders: orders.length,
    average_order_value: paidOrders.length ? Math.round(gmv / paidOrders.length) : 0,
    payment_failure_rate: paymentAttempts.length ? Math.round((failedPayments.length / paymentAttempts.length) * 1000) / 10 : 0,
  };
};

const getUsers = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = []; let params = [];
  if (query.role && VALID_ROLES.has(query.role)) { where.push('role = ?'); params.push(query.role); }
  if (query.status && VALID_USER_STATUSES.has(query.status)) { where.push('is_active = ?'); params.push(query.status === 'active' ? 1 : 0); }
  if (query.created_from) { where.push('created_at >= ?'); params.push(new Date(`${query.created_from}T00:00:00+07:00`).toISOString()); }
  if (query.created_to) { where.push('created_at <= ?'); params.push(new Date(`${query.created_to}T23:59:59.999+07:00`).toISOString()); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [rawData] = await pool.query(`SELECT id, name, email, role, is_active, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT 5000`, params);

  const term = query.search?.trim().replace(/[%_,]/g, '') || '';
  const filtered = term ? rawData.filter(u => kmpSearch(u.name || '', term) || kmpSearch(u.email || '', term)) : rawData;
  const total = filtered.length;
  return { data: filtered.slice(offset, offset + limit), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
};

const getUserById = async (userId) => {
  const [userRows] = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [userId]);
  const user = userRows[0];
  if (!user) throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };

  const result = { user, stats: { total_orders: 0, paid_orders: 0, total_spent: 0, total_products: 0, active_products: 0 }, recent_orders: [], recent_products: [], audit_history: { available: true, data: [] } };

  const [auditLogs] = await pool.query(
    `SELECT aal.*, au.name AS actor_name, au.email AS actor_email
     FROM admin_audit_logs aal LEFT JOIN users au ON au.id = aal.actor_id
     WHERE aal.target_type = 'user' AND aal.target_id = ?
     ORDER BY aal.created_at DESC LIMIT 20`, [userId]
  );
  result.audit_history.data = auditLogs.map(l => ({ ...l, actor: l.actor_name ? { id: l.actor_id, name: l.actor_name, email: l.actor_email } : null }));

  if (user.role === 'buyer') {
    const [orders] = await pool.query('SELECT id, status, total, transaction_id, tracking_id, created_at FROM orders WHERE buyer_id = ? ORDER BY created_at DESC', [userId]);
    const paidOrders = orders.filter(o => PAID_STATUSES.has(o.status));
    result.stats.total_orders = orders.length;
    result.stats.paid_orders = paidOrders.length;
    result.stats.total_spent = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    result.recent_orders = orders.slice(0, 10);
  } else if (user.role === 'seller') {
    const [products] = await pool.query('SELECT id, name, category, price, stock, is_active, created_at FROM products WHERE seller_id = ? ORDER BY created_at DESC', [userId]);
    result.stats.total_products = products.length;
    result.stats.active_products = products.filter(p => p.is_active).length;
    result.recent_products = products.slice(0, 10);
  }

  return result;
};

const getModerationSellers = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = ["role = 'seller'"]; let params = [];
  if (query.status && VALID_USER_STATUSES.has(query.status)) { where.push('is_active = ?'); params.push(query.status === 'active' ? 1 : 0); }
  const [rawData] = await pool.query(`SELECT id, name, email, is_active, created_at FROM users WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 5000`, params);

  const term = query.search?.trim().replace(/[%_,]/g, '') || '';
  const sellers = term ? rawData.filter(s => kmpSearch(s.name || '', term) || kmpSearch(s.email || '', term)) : rawData;
  const sellerIds = sellers.map(s => s.id);

  let productSummary = new Map();
  if (sellerIds.length > 0) {
    const [products] = await pool.query(`SELECT seller_id, is_active, stock FROM products WHERE seller_id IN (${sellerIds.map(() => '?').join(',')})`, sellerIds);
    products.forEach(p => {
      const cur = productSummary.get(p.seller_id) || { total_products: 0, active_products: 0, inactive_products: 0, low_stock_products: 0 };
      cur.total_products++;
      if (p.is_active) cur.active_products++; else cur.inactive_products++;
      if (p.is_active && p.stock <= 5) cur.low_stock_products++;
      productSummary.set(p.seller_id, cur);
    });
  }

  return {
    data: sellers.slice(offset, offset + limit).map(s => ({ ...s, verification_status: 'not_configured', product_summary: productSummary.get(s.id) || { total_products: 0, active_products: 0, inactive_products: 0, low_stock_products: 0 } })),
    pagination: { page, limit, total: sellers.length, total_pages: Math.ceil(sellers.length / limit) },
  };
};

const getModerationProducts = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = []; let params = [];
  if (query.status === 'active') { where.push('p.is_active = 1'); }
  if (query.status === 'inactive') { where.push('p.is_active = 0'); }
  if (query.category) { where.push('p.category = ?'); params.push(query.category); }
  if (query.seller_id) { where.push('p.seller_id = ?'); params.push(query.seller_id); }
  if (query.stock === 'low') { where.push('p.stock <= 5'); }
  if (query.stock === 'empty') { where.push('p.stock = 0'); }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [rawData] = await pool.query(
    `SELECT p.*, u.name AS seller_name, u.email AS seller_email, u.is_active AS seller_is_active
     FROM products p LEFT JOIN users u ON u.id = p.seller_id
     ${whereClause} ORDER BY p.created_at DESC LIMIT 5000`, params
  );

  const term = query.search?.trim().replace(/[%_,]/g, '') || '';
  const filtered = term ? rawData.filter(p => kmpSearch(p.name || '', term)) : rawData;
  return { data: filtered.slice(offset, offset + limit), pagination: { page, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) } };
};

const moderateProduct = async (actor, productId, payload) => {
  const [prodRows] = await pool.query('SELECT id, seller_id, name, is_active, stock FROM products WHERE id = ?', [productId]);
  const product = prodRows[0];
  if (!product) throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  if (payload.is_active && product.stock <= 0) throw { status: 400, code: 'OUT_OF_STOCK', message: 'Produk dengan stok habis tidak dapat diaktifkan' };

  await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [payload.is_active ? 1 : 0, productId]);
  await writeAuditLog({ actorId: actor.id, action: payload.is_active ? 'product.activated' : 'product.deactivated', targetType: 'product', targetId: productId, reason: payload.reason, before: { is_active: product.is_active }, after: { is_active: payload.is_active, moderation_rule: payload.rule, seller_id: product.seller_id } });

  const [rows] = await pool.query('SELECT id, seller_id, name, is_active, stock FROM products WHERE id = ?', [productId]);
  return rows[0];
};

const updateUserStatus = async (actor, userId, payload) => {
  const { is_active, reason } = payload;
  if (actor.id === userId) throw { status: 403, code: 'FORBIDDEN', message: 'Admin tidak dapat mengubah status akunnya sendiri' };

  const [targetRows] = await pool.query('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [userId]);
  const target = targetRows[0];
  if (!target) throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  if (target.role === 'superadmin') throw { status: 403, code: 'FORBIDDEN', message: 'Tidak bisa mengubah status superadmin' };

  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, userId]);
  await writeAuditLog({ actorId: actor.id, action: is_active ? 'user.activated' : 'user.banned', targetType: 'user', targetId: userId, reason, before: { is_active: target.is_active }, after: { is_active } });

  return { id: userId, is_active: is_active ? 1 : 0 };
};

const getAnalytics = async (query) => {
  const period = parsePeriod(query);
  const combinedStart = toIso(period.previousStart);
  const endIso = toIso(period.end);

  const [ordersData] = await pool.query('SELECT id, buyer_id, status, total, fee_marketplace, tracking_id, created_at, updated_at FROM orders WHERE created_at >= ?', [combinedStart]);
  const [usersData] = await pool.query('SELECT id, role, created_at FROM users WHERE created_at >= ?', [combinedStart]);
  const [productsData] = await pool.query('SELECT p.id, p.name, p.category, p.stock, p.is_active, u.name AS seller_name, u.id AS seller_id FROM products p LEFT JOIN users u ON u.id = p.seller_id');
  const [itemsData] = await pool.query('SELECT order_id, product_id, qty, price_at_purchase FROM order_items');
  const [sellersData] = await pool.query("SELECT id, is_active FROM users WHERE role = 'seller'");
  const [ratingsData] = await pool.query('SELECT rating, created_at FROM ratings WHERE created_at >= ?', [period.start]);

  const allOrders = ordersData;
  const allUsers = usersData;
  const products = productsData;
  const orderItems = itemsData;
  const sellers = sellersData;
  const ratings = ratingsData;

  const inRange = (iso, start, end) => { const t = new Date(iso).getTime(); return t >= start.getTime() && t <= end.getTime(); };
  const currentOrders = allOrders.filter(o => inRange(o.created_at, period.start, period.end));
  const previousOrders = allOrders.filter(o => inRange(o.created_at, period.previousStart, period.previousEnd));
  const currentUsers = allUsers.filter(u => inRange(u.created_at, period.start, period.end));
  const previousUsers = allUsers.filter(u => inRange(u.created_at, period.previousStart, period.previousEnd));
  const currentSummary = summarizeOrders(currentOrders);
  const previousSummary = summarizeOrders(previousOrders);

  const activeBuyerIds = new Set(currentOrders.map(o => o.buyer_id).filter(Boolean));
  const activeSellerIds = new Set();
  const currentOrderIds = new Set(currentOrders.map(o => o.id));
  const paidOrderIds = new Set(currentOrders.filter(o => PAID_STATUSES.has(o.status)).map(o => o.id));
  const orderById = new Map(currentOrders.map(o => [o.id, o]));

  orderItems.forEach(item => {
    if (currentOrderIds.has(item.order_id)) {
      const product = products.find(p => p.id === item.product_id);
      if (product?.seller_id) activeSellerIds.add(product.seller_id);
    }
  });

  const summary = { ...currentSummary, active_buyers: activeBuyerIds.size, active_sellers: activeSellerIds.size, new_users: currentUsers.length, total_products: products.length, low_stock_products: products.filter(p => p.is_active && p.stock <= 5).length };
  const comparison = { gmv: percentChange(summary.gmv, previousSummary.gmv), marketplace_revenue: percentChange(summary.marketplace_revenue, previousSummary.marketplace_revenue), paid_orders: percentChange(summary.paid_orders, previousSummary.paid_orders), new_users: percentChange(currentUsers.length, previousUsers.length) };

  // Time series
  const timeBuckets = new Map();
  currentOrders.forEach(order => {
    const key = bucketKey(order.created_at, period.granularity);
    const value = timeBuckets.get(key) || { bucket: key, gmv: 0, marketplace_revenue: 0, orders: 0, payment_success: 0, payment_failed: 0, shipping_created: 0, shipped: 0, delivered: 0, new_buyers: 0, new_sellers: 0 };
    value.orders++;
    if (PAID_STATUSES.has(order.status)) { value.gmv += Number(order.total || 0); value.marketplace_revenue += Number(order.fee_marketplace || 0); value.payment_success++; }
    if (order.status === 'payment_failed') value.payment_failed++;
    if (order.tracking_id) value.shipping_created++;
    if (['shipped', 'delivered'].includes(order.status)) value.shipped++;
    if (order.status === 'delivered') value.delivered++;
    timeBuckets.set(key, value);
  });
  currentUsers.forEach(user => {
    const key = bucketKey(user.created_at, period.granularity);
    const value = timeBuckets.get(key) || { bucket: key, gmv: 0, marketplace_revenue: 0, orders: 0, payment_success: 0, payment_failed: 0, shipping_created: 0, shipped: 0, delivered: 0, new_buyers: 0, new_sellers: 0 };
    if (user.role === 'buyer') value.new_buyers++;
    if (user.role === 'seller') value.new_sellers++;
    timeBuckets.set(key, value);
  });

  // Top products & categories
  const topProductMap = new Map();
  const categoryMap = new Map();
  orderItems.forEach(item => {
    if (!paidOrderIds.has(item.order_id)) return;
    const product = products.find(p => p.id === item.product_id);
    const existing = topProductMap.get(item.product_id) || { product_id: item.product_id, name: product?.name || 'Produk dihapus', seller: product?.seller_name || '-', sold: 0, gmv: 0 };
    existing.sold += Number(item.qty || 0); existing.gmv += Number(item.qty || 0) * Number(item.price_at_purchase || 0);
    topProductMap.set(item.product_id, existing);
    const cat = product?.category || 'Lainnya';
    const cv = categoryMap.get(cat) || { category: cat, sold: 0, gmv: 0 };
    cv.sold += Number(item.qty || 0); cv.gmv += Number(item.qty || 0) * Number(item.price_at_purchase || 0);
    categoryMap.set(cat, cv);
  });

  // Funnel
  const paid = currentOrders.filter(o => PAID_STATUSES.has(o.status)).length;
  const shippingCreated = currentOrders.filter(o => o.tracking_id).length;
  const funnel = [
    { key: 'checkout_created', label: 'Checkout dibuat', count: currentOrders.length },
    { key: 'payment_requested', label: 'Payment diproses', count: currentOrders.filter(o => o.status !== 'pending').length },
    { key: 'paid', label: 'Pembayaran sukses', count: paid },
    { key: 'shipping_created', label: 'Pengiriman dibuat', count: shippingCreated },
    { key: 'shipped', label: 'Dikirim', count: currentOrders.filter(o => ['shipped', 'delivered'].includes(o.status)).length },
    { key: 'delivered', label: 'Selesai', count: currentOrders.filter(o => o.status === 'delivered').length },
  ];

  // Health scores
  const now = Date.now();
  const paidWithoutTracking = currentOrders.filter(o => PAID_STATUSES.has(o.status) && !o.tracking_id);
  const stalePending = currentOrders.filter(o => o.status === 'pending' && now - new Date(o.created_at).getTime() > DAY_MS);
  const paymentFailed = currentOrders.filter(o => o.status === 'payment_failed');
  const lowStock = products.filter(p => p.is_active && p.stock <= 5);
  const delayedPaidOrders = currentOrders.filter(o => o.status === 'paid' && !o.tracking_id && now - new Date(o.updated_at || o.created_at).getTime() > DAY_MS);

  const paymentScore = clampScore(100 - summary.payment_failure_rate * 2);
  const paidOrderCount = currentOrders.filter(o => PAID_STATUSES.has(o.status)).length;
  const trackedPaidCount = currentOrders.filter(o => PAID_STATUSES.has(o.status) && o.tracking_id).length;
  const shippingCoverage = paidOrderCount ? (trackedPaidCount / paidOrderCount) * 100 : 100;
  const shippingScore = clampScore(shippingCoverage - (paidOrderCount ? (delayedPaidOrders.length / paidOrderCount) * 40 : 0));
  const activeProducts = products.filter(p => p.is_active);
  const healthyStockProducts = activeProducts.filter(p => p.stock > 5);
  const stockScore = clampScore(activeProducts.length ? (healthyStockProducts.length / activeProducts.length) * 100 : 100);
  const activeSellerCount = sellers.filter(s => s.is_active).length;
  const sellerActivation = sellers.length ? (activeSellerCount / sellers.length) * 100 : 100;
  const sellerScore = clampScore(sellerActivation - (paidOrderCount ? (delayedPaidOrders.length / paidOrderCount) * 30 : 0));
  const averageRating = ratings.length ? ratings.reduce((s, r) => s + Number(r.rating || 0), 0) / ratings.length : null;
  const deliveredCount = currentOrders.filter(o => o.status === 'delivered').length;
  const buyerScore = clampScore(averageRating !== null ? (averageRating / 5) * 100 : paidOrderCount ? (deliveredCount / paidOrderCount) * 100 : 100);

  const healthComponents = [
    { key: 'payment', label: 'Kesehatan Pembayaran', score: paymentScore, weight: 30, metric: `${summary.payment_failure_rate}% payment failure`, explanation: 'Skor turun dua poin untuk setiap satu persen payment failure.', href: '/admin/orders?status=payment_failed' },
    { key: 'shipping', label: 'Kesehatan Pengiriman', score: shippingScore, weight: 25, metric: paidOrderCount ? `${trackedPaidCount}/${paidOrderCount} paid order memiliki tracking` : 'Belum ada paid order', explanation: 'Mengukur cakupan tracking dan penalti order paid terlambat.', href: '/admin/orders?status=paid' },
    { key: 'stock', label: 'Ketersediaan Stok', score: stockScore, weight: 20, metric: `${healthyStockProducts.length}/${activeProducts.length} produk aktif memiliki stok > 5`, explanation: 'Produk aktif dengan stok lima atau kurang.', href: '/admin/moderation?status=active&stock=low' },
    { key: 'seller', label: 'Kualitas Seller', score: sellerScore, weight: 15, metric: `${activeSellerCount}/${sellers.length} seller aktif`, explanation: 'Status akun seller dan penalti keterlambatan.', href: '/admin/moderation' },
    { key: 'buyer', label: 'Kepuasan Buyer', score: buyerScore, weight: 10, metric: averageRating !== null ? `Rating rata-rata ${Math.round(averageRating * 10) / 10}/5` : 'Rating belum tersedia', explanation: 'Rating buyer pada periode terpilih.', href: '/admin/analytics' },
  ];
  const overallHealthScore = clampScore(healthComponents.reduce((s, c) => s + c.score * c.weight, 0) / 100);

  return {
    period: { start: toIso(period.start), end: endIso, timezone: 'Asia/Jakarta', granularity: period.granularity, generated_at: new Date().toISOString() },
    summary, comparison,
    timeseries: [...timeBuckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    transaction_funnel: funnel,
    orders_by_status: Object.entries(currentOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {})).map(([key, count]) => ({ key, count, pct: currentOrders.length ? Math.round((count / currentOrders.length) * 1000) / 10 : 0 })),
    top_products: [...topProductMap.values()].sort((a, b) => b.sold - a.sold).slice(0, 5).map((p, i) => ({ rank: i + 1, ...p })),
    top_categories: [...categoryMap.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 5),
    marketplace_health: { score: overallHealthScore, status: overallHealthScore >= 85 ? 'healthy' : overallHealthScore >= 65 ? 'attention' : 'critical', components: healthComponents },
    action_center: [
      { key: 'paid_without_tracking', severity: paidWithoutTracking.length ? 'high' : 'ok', title: 'Order dibayar tanpa tracking', count: paidWithoutTracking.length, href: '/admin/orders?status=paid' },
      { key: 'payment_failed', severity: paymentFailed.length ? 'medium' : 'ok', title: 'Pembayaran gagal', count: paymentFailed.length, href: '/admin/orders?status=payment_failed' },
      { key: 'stale_pending', severity: stalePending.length ? 'medium' : 'ok', title: 'Pending lebih dari 24 jam', count: stalePending.length, href: '/admin/orders?status=pending' },
      { key: 'seller_delay', severity: delayedPaidOrders.length ? 'high' : 'ok', title: 'Seller terlambat memproses', count: delayedPaidOrders.length, href: '/admin/orders?status=paid' },
      { key: 'low_stock', severity: lowStock.length ? 'low' : 'ok', title: 'Produk stok kritis', count: lowStock.length, href: '/admin/moderation?status=active&stock=low' },
    ],
  };
};

const getAuditLogs = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = []; let params = [];
  if (query.action) { where.push('aal.action = ?'); params.push(query.action); }
  if (query.target_type) { where.push('aal.target_type = ?'); params.push(query.target_type); }
  if (query.target_id) { where.push('aal.target_id = ?'); params.push(query.target_id); }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS cnt FROM admin_audit_logs aal ${whereClause}`, params);
  const [data] = await pool.query(
    `SELECT aal.*, au.name AS actor_name, au.email AS actor_email
     FROM admin_audit_logs aal LEFT JOIN users au ON au.id = aal.actor_id
     ${whereClause} ORDER BY aal.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { data: data.map(l => ({ ...l, actor: l.actor_name ? { id: l.actor_id, name: l.actor_name, email: l.actor_email } : null })), pagination: { page, limit, total: countRow.cnt, total_pages: Math.ceil(countRow.cnt / limit) } };
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '';
  const [name, domain] = email.split('@');
  return `${name.slice(0, Math.min(2, name.length))}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
};

const previewReport = async (query) => {
  const report = await buildReport(query);
  return { type: report.type, row_count: report.rows.length, columns: report.columns.map(c => c.label), sample: report.rows.slice(0, 3), truncated: report.rows.length >= 5000 };
};

const buildReport = async (query) => {
  const type = query.type;
  if (!REPORT_TYPES.has(type)) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Jenis laporan tidak valid' };

  const reportDateIso = (value, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`);
    if (Number.isNaN(date.getTime())) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Filter tanggal tidak valid' };
    return date.toISOString();
  };

  if (type === 'orders') {
    let where = []; let params = [];
    if (query.status) { where.push('o.status = ?'); params.push(query.status); }
    if (query.start) { where.push('o.created_at >= ?'); params.push(reportDateIso(query.start)); }
    if (query.end) { where.push('o.created_at <= ?'); params.push(reportDateIso(query.end, true)); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [data] = await pool.query(`SELECT o.id, o.buyer_id, o.status, o.subtotal, o.fee_marketplace, o.total, o.transaction_id, o.tracking_id, o.created_at, o.updated_at, b.name AS buyer_name, b.email AS buyer_email FROM orders o LEFT JOIN users b ON b.id = o.buyer_id ${whereClause} ORDER BY o.created_at DESC LIMIT 5000`, params);
    const term = query.search?.trim().toLowerCase();
    const filtered = term ? data.filter(o => o.id.toLowerCase().includes(term) || o.transaction_id?.toLowerCase().includes(term) || o.buyer_name?.toLowerCase().includes(term)) : data;
    return { type, columns: [{ key: 'order_id', label: 'Order ID' }, { key: 'buyer', label: 'Buyer' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' }, { key: 'created_at', label: 'Dibuat' }], rows: filtered.map(o => ({ order_id: o.id, buyer: o.buyer_name || '', status: o.status, total: o.total, created_at: o.created_at })) };
  }

  if (type === 'users' || type === 'sellers') {
    let where = []; let params = [];
    if (type === 'sellers') { where.push("role = 'seller'"); }
    if (query.role && VALID_ROLES.has(query.role)) { where.push('role = ?'); params.push(query.role); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [data] = await pool.query(`SELECT id, name, email, role, is_active, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT 5000`, params);
    return { type, columns: [{ key: 'user_id', label: 'User ID' }, { key: 'name', label: 'Nama' }, { key: 'role', label: 'Role' }, { key: 'created_at', label: 'Tanggal Daftar' }], rows: data.map(u => ({ user_id: u.id, name: u.name, role: u.role, created_at: u.created_at })) };
  }

  // Products
  const [data] = await pool.query(`SELECT p.id, p.name, p.category, p.price, p.stock, p.is_active, p.created_at, u.name AS seller_name FROM products p LEFT JOIN users u ON u.id = p.seller_id ORDER BY p.created_at DESC LIMIT 5000`);
  return { type, columns: [{ key: 'product_id', label: 'Product ID' }, { key: 'name', label: 'Produk' }, { key: 'seller', label: 'Seller' }, { key: 'price', label: 'Harga' }, { key: 'created_at', label: 'Dibuat' }], rows: data.map(p => ({ product_id: p.id, name: p.name, seller: p.seller_name || '', price: p.price, created_at: p.created_at })) };
};

const exportReport = async (actor, query) => {
  const escapeCsv = (v) => { if (v === null || v === undefined) return ''; let s = String(v).replace(/\r?\n/g, ' '); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rowsToCsv = (columns, rows) => { const header = columns.map(c => escapeCsv(c.label)).join(','); const body = rows.map(r => columns.map(c => escapeCsv(r[c.key])).join(',')); return `\uFEFF${[header, ...body].join('\n')}`; };

  const report = await buildReport(query);
  await writeAuditLog({ actorId: actor.id, action: 'report.exported', targetType: 'report', targetId: null, reason: `Export CSV ${report.type}`, after: { report_type: report.type, row_count: report.rows.length } });
  const date = new Date().toISOString().slice(0, 10);
  return { filename: `pasarkita-${report.type}-${date}.csv`, csv: rowsToCsv(report.columns, report.rows) };
};

const simulateFeeImpact = async (query) => {
  const period = parsePeriod({ ...query, start: query.start ? new Date(`${query.start}T00:00:00+07:00`).toISOString() : undefined, end: query.end ? new Date(`${query.end}T23:59:59.999+07:00`).toISOString() : undefined });
  const customRate = Number(query.rate ?? 2);
  if (!Number.isFinite(customRate) || customRate < 0 || customRate > 10) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Fee simulasi harus 0-10%' };

  const [data] = await pool.query(`SELECT id, subtotal, fee_marketplace, total, status, created_at FROM orders WHERE status IN (${PAID_STATUSES.values().toArray().map(() => '?').join(',')}) AND created_at >= ? AND created_at <= ? LIMIT 5000`, [...PAID_STATUSES, toIso(period.start), toIso(period.end)]);

  const orders = data || [];
  const subtotal = orders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const actualRevenue = orders.reduce((s, o) => s + Number(o.fee_marketplace || 0), 0);
  const buildScenario = (rate) => {
    const simulatedRevenue = orders.reduce((s, o) => s + Math.round(Number(o.subtotal || 0) * (rate / 100)), 0);
    return { rate, revenue: simulatedRevenue, revenue_difference: simulatedRevenue - actualRevenue, average_fee_per_order: orders.length ? Math.round(simulatedRevenue / orders.length) : 0 };
  };
  const rates = [...new Set([0, 1, 2, 3, 5, customRate])].sort((a, b) => a - b);
  return { period: { start: toIso(period.start), end: toIso(period.end) }, baseline: { production_fee_rate: 2, paid_orders: orders.length, subtotal, actual_revenue: actualRevenue }, selected_rate: customRate, selected_scenario: buildScenario(customRate), scenarios: rates.map(buildScenario) };
};

module.exports = { getUsers, getUserById, getModerationSellers, getModerationProducts, moderateProduct, updateUserStatus, getAnalytics, getAuditLogs, previewReport, exportReport, simulateFeeImpact };
