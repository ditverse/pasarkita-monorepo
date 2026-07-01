const pool = require('../../config/mysql');
const { randomUUID } = require('crypto');

const DAY_MS = 24 * 60 * 60 * 1000;
const PAID_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];
const STORE_ASSET_BUCKET = 'store-assets';
const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const startOfJakartaDay = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+07:00`);
};

const bucketKey = (iso) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parsePeriod = (query) => {
  if (query.date_from && query.date_to) {
    const start = new Date(`${query.date_from}T00:00:00+07:00`);
    const end = new Date(`${query.date_to}T23:59:59.999+07:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
      if (days <= 366) return { days, start, end };
    }
  }
  const days = query.period === '7d' ? 7 : 30;
  const end = new Date();
  const start = startOfJakartaDay(new Date(end.getTime() - (days - 1) * DAY_MS));
  return { days, start, end };
};

const getSellerAnalytics = async (sellerId, query) => {
  const period = parsePeriod(query);
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();

  const [products] = await pool.query(
    'SELECT id, name, category, stock, minimum_stock, is_low_stock, is_active, image_url FROM products WHERE seller_id = ?',
    [sellerId]
  );
  const productIds = products.map(p => p.id);
  if (productIds.length === 0) {
    return {
      period: { days: period.days, start: startIso, end: endIso, generated_at: new Date().toISOString() },
      summary: { gross_sales: 0, marketplace_fee: 0, estimated_net: 0, paid_orders: 0, new_orders: 0, overdue_orders: 0, out_of_stock: 0, low_stock: 0, average_rating: null, new_reviews: 0 },
      timeseries: [], orders_by_status: [], top_products: [], critical_stock: [],
    };
  }

  const placeholders = productIds.map(() => '?').join(',');
  const [itemsData] = await pool.query(
    `SELECT oi.order_id, oi.product_id, oi.qty, oi.price_at_purchase,
            o.id AS o_id, o.status AS o_status, o.subtotal AS o_subtotal, o.fee_marketplace AS o_fee, o.created_at AS o_created, o.processing_at AS o_processing
     FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id IN (${placeholders}) AND o.created_at >= ? AND o.created_at <= ?`,
    [...productIds, startIso, endIso]
  );

  const [ratingsData] = await pool.query(
    'SELECT rating, created_at FROM ratings WHERE product_id IN (' + placeholders + ')',
    productIds
  );

  const productById = new Map(products.map(p => [p.id, p]));
  const orderMap = new Map();
  const productSales = new Map();
  const buckets = new Map();

  for (const item of itemsData) {
    const itemGross = Number(item.qty) * Number(item.price_at_purchase);
    const feeShare = Number(item.o_subtotal) > 0 ? Math.round(Number(item.o_fee || 0) * (itemGross / Number(item.o_subtotal))) : 0;
    const cur = orderMap.get(item.order_id) || { id: item.o_id, status: item.o_status, created_at: item.o_created, processing_at: item.o_processing, gross: 0, fee: 0 };
    cur.gross += itemGross; cur.fee += feeShare;
    orderMap.set(item.order_id, cur);

    if (PAID_STATUSES.includes(item.o_status)) {
      const product = productById.get(item.product_id);
      const cp = productSales.get(item.product_id) || { product_id: item.product_id, name: product?.name || 'Produk dihapus', sold: 0, gross_sales: 0 };
      cp.sold += Number(item.qty); cp.gross_sales += itemGross;
      productSales.set(item.product_id, cp);
    }
  }

  const orders = [...orderMap.values()];
  const paidOrders = orders.filter(o => PAID_STATUSES.includes(o.status));
  const grossSales = paidOrders.reduce((s, o) => s + o.gross, 0);
  const marketplaceFee = paidOrders.reduce((s, o) => s + o.fee, 0);
  const overdueCutoff = Date.now() - 2 * DAY_MS;
  const overdueOrders = orders.filter(o => {
    if (o.status === 'paid') return new Date(o.created_at).getTime() < overdueCutoff;
    if (o.status === 'processing') return new Date(o.processing_at || o.created_at).getTime() < overdueCutoff;
    return false;
  }).length;

  for (const order of orders) {
    const key = bucketKey(order.created_at);
    const b = buckets.get(key) || { bucket: key, gross_sales: 0, estimated_net: 0, orders: 0 };
    b.orders++;
    if (PAID_STATUSES.includes(order.status)) { b.gross_sales += order.gross; b.estimated_net += order.gross - order.fee; }
    buckets.set(key, b);
  }

  const statusCounts = new Map();
  orders.forEach(o => statusCounts.set(o.status, (statusCounts.get(o.status) || 0) + 1));

  const ratings = ratingsData || [];
  const newReviews = ratings.filter(r => new Date(r.created_at).getTime() >= period.start.getTime()).length;
  const averageRating = ratings.length ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10 : null;
  const criticalStock = products.filter(p => p.stock === 0 || p.is_low_stock).sort((a, b) => a.stock - b.stock).slice(0, 10).map(p => ({ id: p.id, name: p.name, stock: p.stock, minimum_stock: p.minimum_stock, status: p.stock === 0 ? 'out' : 'low' }));

  return {
    period: { days: period.days, start: startIso, end: endIso, generated_at: new Date().toISOString() },
    summary: { gross_sales: grossSales, marketplace_fee: marketplaceFee, estimated_net: grossSales - marketplaceFee, paid_orders: paidOrders.length, new_orders: orders.filter(o => o.status === 'paid').length, overdue_orders: overdueOrders, out_of_stock: products.filter(p => p.stock === 0).length, low_stock: products.filter(p => p.is_low_stock).length, average_rating: averageRating, new_reviews: newReviews },
    timeseries: [...buckets.values()].sort((a, b) => a.bucket.localeCompare(b.bucket)),
    orders_by_status: [...statusCounts.entries()].map(([key, count]) => ({ key, count, pct: orders.length ? Math.round((count / orders.length) * 1000) / 10 : 0 })),
    top_products: [...productSales.values()].sort((a, b) => b.sold - a.sold || b.gross_sales - a.gross_sales).slice(0, 5),
    critical_stock: criticalStock,
  };
};

const ensureSellerProfile = async (sellerId) => {
  const [existing] = await pool.query('SELECT * FROM seller_profiles WHERE seller_id = ?', [sellerId]);
  if (existing[0]) return existing[0];

  const [seller] = await pool.query('SELECT id, name FROM users WHERE id = ? AND role = ?', [sellerId, 'seller']);
  if (!seller[0]) throw { status: 404, code: 'NOT_FOUND', message: 'Seller tidak ditemukan' };

  await pool.query('INSERT INTO seller_profiles (seller_id, store_name) VALUES (?, ?)', [sellerId, seller[0].name]);
  const [rows] = await pool.query('SELECT * FROM seller_profiles WHERE seller_id = ?', [sellerId]);
  return rows[0];
};

const getStoreProfile = async (sellerId) => ensureSellerProfile(sellerId);

const updateStoreProfile = async (sellerId, payload) => {
  await ensureSellerProfile(sellerId);
  const complete = Boolean(payload.store_name && payload.description && payload.pickup_address && payload.contact_phone);

  const fields = []; const values = [];
  for (const [key, value] of Object.entries(payload)) {
    if (['store_name', 'logo_url', 'description', 'pickup_address', 'contact_phone', 'open_time', 'close_time', 'processing_days'].includes(key)) {
      fields.push(`${key} = ?`); values.push(value);
    }
  }
  fields.push('verification_status = ?'); values.push(complete ? 'demo_verified' : 'unverified');
  values.push(sellerId);

  if (fields.length > 1) {
    await pool.query(`UPDATE seller_profiles SET ${fields.join(', ')} WHERE seller_id = ?`, values);
  }
  const [rows] = await pool.query('SELECT * FROM seller_profiles WHERE seller_id = ?', [sellerId]);
  return rows[0];
};

const uploadStoreLogo = async (sellerId, file) => {
  if (!file) throw { status: 400, code: 'IMAGE_REQUIRED', message: 'Pilih logo toko terlebih dahulu' };
  const extension = IMAGE_EXTENSIONS[file.mimetype];
  if (!extension) throw { status: 400, code: 'INVALID_IMAGE_TYPE', message: 'Format logo harus JPG, PNG, atau WebP' };

  const fs = require('fs');
  const pathMod = require('path');
  const fileName = `logo-${randomUUID()}.${extension}`;
  const uploadDir = pathMod.join(__dirname, '../../../uploads', STORE_ASSET_BUCKET, sellerId);
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(pathMod.join(uploadDir, fileName), file.buffer);

  const filePath = `${sellerId}/${fileName}`;
  const logoUrl = `/uploads/${STORE_ASSET_BUCKET}/${filePath}`;
  return { logo_url: logoUrl, path: filePath };
};

const setVacationMode = async (sellerId, payload) => {
  await ensureSellerProfile(sellerId);
  const isVacation = Boolean(payload.is_on_vacation);
  let vacationUntil = null;

  if (isVacation && payload.vacation_until) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.vacation_until)) {
      throw { status: 400, code: 'VALIDATION_ERROR', message: 'Format vacation_until harus YYYY-MM-DD' };
    }
    vacationUntil = payload.vacation_until;
  }

  await pool.query(
    'UPDATE seller_profiles SET is_on_vacation = ?, vacation_until = ? WHERE seller_id = ?',
    [isVacation ? 1 : 0, isVacation ? vacationUntil : null, sellerId]
  );
  const [rows] = await pool.query('SELECT * FROM seller_profiles WHERE seller_id = ?', [sellerId]);
  return rows[0];
};

module.exports = { getSellerAnalytics, getStoreProfile, updateStoreProfile, uploadStoreLogo, setVacationMode };
