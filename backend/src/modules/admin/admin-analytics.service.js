const pool = require('../../config/mysql');
const { AppError } = require('../../utils/app-error');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);

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
  if (Number.isNaN(end.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Tanggal akhir tidak valid');
  if (query.start) {
    start = new Date(query.start);
  } else {
    const days = query.period === 'today' ? 1 : query.period === '7d' ? 7 : 30;
    start = startOfJakartaDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  }
  if (Number.isNaN(start.getTime()) || start >= end) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Rentang tanggal tidak valid');
  }
  const duration = end.getTime() - start.getTime();
  if (duration > 366 * DAY_MS) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Rentang analytics maksimal 366 hari');
  }
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

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const summarizeOrders = (orders) => {
  const paidOrders = orders.filter(o => PAID_STATUSES.has(o.status));
  const paymentAttempts = orders.filter(o => o.status !== 'pending');
  const failedPayments = orders.filter(o => o.status === 'payment_failed');
  const gmv = paidOrders.reduce((s, o) => s + Number(o.total || 0), 0);
  const marketplaceRevenue = paidOrders.reduce((s, o) => s + Number(o.fee_marketplace || 0), 0);
  return {
    gmv,
    marketplace_revenue: marketplaceRevenue,
    paid_orders: paidOrders.length,
    total_orders: orders.length,
    average_order_value: paidOrders.length ? Math.round(gmv / paidOrders.length) : 0,
    payment_failure_rate: paymentAttempts.length ? Math.round((failedPayments.length / paymentAttempts.length) * 1000) / 10 : 0,
  };
};

const getAnalytics = async (query) => {
  const period = parsePeriod(query);
  const combinedStart = toIso(period.previousStart);

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

  const inRange = (iso, start, end) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
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

  orderItems.forEach(item => {
    if (currentOrderIds.has(item.order_id)) {
      const product = products.find(p => p.id === item.product_id);
      if (product?.seller_id) activeSellerIds.add(product.seller_id);
    }
  });

  const summary = {
    ...currentSummary,
    active_buyers: activeBuyerIds.size,
    active_sellers: activeSellerIds.size,
    new_users: currentUsers.length,
    total_products: products.length,
    low_stock_products: products.filter(p => p.is_active && p.stock <= 5).length
  };
  const comparison = {
    gmv: percentChange(summary.gmv, previousSummary.gmv),
    marketplace_revenue: percentChange(summary.marketplace_revenue, previousSummary.marketplace_revenue),
    paid_orders: percentChange(summary.paid_orders, previousSummary.paid_orders),
    new_users: percentChange(currentUsers.length, previousUsers.length)
  };

  // Time series
  const timeBuckets = new Map();
  currentOrders.forEach(order => {
    const key = bucketKey(order.created_at, period.granularity);
    const value = timeBuckets.get(key) || { bucket: key, gmv: 0, marketplace_revenue: 0, orders: 0, payment_success: 0, payment_failed: 0, shipping_created: 0, shipped: 0, delivered: 0, new_buyers: 0, new_sellers: 0 };
    value.orders++;
    if (PAID_STATUSES.has(order.status)) {
      value.gmv += Number(order.total || 0);
      value.marketplace_revenue += Number(order.fee_marketplace || 0);
      value.payment_success++;
    }
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
    existing.sold += Number(item.qty || 0);
    existing.gmv += Number(item.qty || 0) * Number(item.price_at_purchase || 0);
    topProductMap.set(item.product_id, existing);
    const cat = product?.category || 'Lainnya';
    const cv = categoryMap.get(cat) || { category: cat, sold: 0, gmv: 0 };
    cv.sold += Number(item.qty || 0);
    cv.gmv += Number(item.qty || 0) * Number(item.price_at_purchase || 0);
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
    summary,
    comparison,
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

module.exports = {
  getAnalytics,
};
