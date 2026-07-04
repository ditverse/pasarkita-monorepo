const pool = require('../../config/mysql');
const { randomUUID } = require('crypto');
const { kmpFilterProducts } = require('../../utils/kmp-search');
const { enrichProductsWithPromotions } = require('../promotions/promotion.service');
const { AppError } = require('../../utils/app-error');
const { saveUploadedFile } = require('../../utils/storage');
const { escapeCSV } = require('../../utils/shared');

const PRODUCT_IMAGE_BUCKET = 'product-images';
const SELLER_PRODUCT_SORTS = {
  created_desc: 'created_at DESC',
  created_asc: 'created_at ASC',
  name_asc: 'name ASC',
  name_desc: 'name DESC',
  price_asc: 'price ASC',
  price_desc: 'price DESC',
  stock_asc: 'stock ASC',
  stock_desc: 'stock DESC',
  status_asc: 'is_active ASC',
  status_desc: 'is_active DESC',
};

const uploadProductImage = async (sellerId, file) => {
  try {
    const result = await saveUploadedFile(PRODUCT_IMAGE_BUCKET, sellerId, file);
    return { image_url: result.url, path: result.path };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.status || 500, err.code || 'UPLOAD_FAILED', err.message || 'Gagal mengunggah gambar');
  }
};

const getProducts = async (query) => {
  const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
  const page = Math.max(parseInt(query.page) || 1, 1);
  const offset = (page - 1) * limit;

  let where = ['p.is_active = 1'];
  let params = [];

  if (query.category) { where.push('p.category = ?'); params.push(query.category); }

  const minPrice = Number.parseInt(query.min_price, 10);
  const maxPrice = Number.parseInt(query.max_price, 10);
  if (Number.isFinite(minPrice) && minPrice >= 0) { where.push('p.price >= ?'); params.push(minPrice); }
  if (Number.isFinite(maxPrice) && maxPrice >= 0) { where.push('p.price <= ?'); params.push(maxPrice); }
  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && minPrice > maxPrice) {
    throw { status: 400, code: 'INVALID_PRICE_RANGE', message: 'Harga minimum tidak boleh lebih besar dari harga maksimum' };
  }
  if (query.in_stock === 'true') { where.push('p.stock > 0'); }
  if (query.seller_id) { where.push('p.seller_id = ?'); params.push(query.seller_id); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Fetch all matching products (KMP filter done in memory)
  const [rawData] = await pool.query(
    `SELECT p.*, u.id AS seller_id_seller, u.name AS seller_name
     FROM products p
     LEFT JOIN users u ON u.id = p.seller_id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT 1000`,
    params
  );

  // Map seller info
  const data = rawData.map(row => ({
    ...row,
    seller: row.seller_id_seller ? { id: row.seller_id_seller, name: row.seller_name } : null,
  }));

  // KMP filter
  const filtered = query.search
    ? kmpFilterProducts(data, query.search, 'name')
    : data;

  // Handle sort: rating_desc or sold_desc needs extra data
  if (query.sort === 'rating_desc' || query.sort === 'sold_desc') {
    const productIds = filtered.map(p => p.id);
    if (productIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0, total_pages: 0 } };
    }

    const placeholders = productIds.map(() => '?').join(',');
    const [ratingsData] = await pool.query(
      `SELECT product_id, rating FROM ratings WHERE product_id IN (${placeholders})`, productIds
    );
    const [salesData] = await pool.query(
      `SELECT oi.product_id, oi.qty FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id IN (${placeholders}) AND o.status IN ('paid','processing','shipped','delivered')`,
      productIds
    );

    const ratingTotals = new Map();
    ratingsData.forEach(r => {
      const cur = ratingTotals.get(r.product_id) || { sum: 0, count: 0 };
      ratingTotals.set(r.product_id, { sum: cur.sum + r.rating, count: cur.count + 1 });
    });
    const soldTotals = new Map();
    salesData.forEach(s => {
      soldTotals.set(s.product_id, (soldTotals.get(s.product_id) || 0) + s.qty);
    });

    const ranked = filtered.map(product => {
      const rating = ratingTotals.get(product.id);
      return {
        ...product,
        rating_average: rating ? Math.round((rating.sum / rating.count) * 10) / 10 : null,
        rating_count: rating?.count || 0,
        sold_units: soldTotals.get(product.id) || 0,
      };
    }).sort((a, b) => {
      const primary = query.sort === 'rating_desc'
        ? (b.rating_average || 0) - (a.rating_average || 0)
        : b.sold_units - a.sold_units;
      if (primary !== 0) return primary;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const pageData = ranked.slice(offset, offset + limit);
    return {
      data: await enrichProductsWithPromotions(pageData),
      pagination: { page, limit, total: ranked.length, total_pages: Math.ceil(ranked.length / limit) },
    };
  }

  // Sort for non-ranked
  const pageData = filtered.slice(offset, offset + limit);
  return {
    data: await enrichProductsWithPromotions(pageData),
    pagination: { page, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) },
  };
};

const getProductById = async (id) => {
  const [rows] = await pool.query(
    `SELECT p.*, u.id AS seller_user_id, u.name AS seller_name, u.email AS seller_email
     FROM products p
     LEFT JOIN users u ON u.id = p.seller_id
     WHERE p.id = ? AND p.is_active = 1`,
    [id]
  );
  const data = rows[0];
  if (!data) throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  data.seller = data.seller_user_id ? { id: data.seller_user_id, name: data.seller_name, email: data.seller_email } : null;
  return enrichProductsWithPromotions(data);
};

const getPublicStore = async (sellerId) => {
  const [sellerRows] = await pool.query(
    `SELECT u.id, u.name, u.created_at, u.is_active
     FROM users u WHERE u.id = ? AND u.role = 'seller'`,
    [sellerId]
  );
  const seller = sellerRows[0];
  if (!seller || !seller.is_active) throw { status: 404, code: 'NOT_FOUND', message: 'Toko tidak ditemukan' };

  const [profileRows] = await pool.query(
    `SELECT store_name, logo_url, description, contact_phone, open_time, close_time, processing_days, verification_status
     FROM seller_profiles WHERE seller_id = ?`,
    [sellerId]
  );
  const profile = profileRows[0] || null;

  const [productRows] = await pool.query(
    'SELECT id FROM products WHERE seller_id = ? AND is_active = 1', [sellerId]
  );
  const productIds = productRows.map(p => p.id);

  if (productIds.length === 0) {
    return {
      seller: {
        ...seller,
        store_name: profile?.store_name || seller.name,
        logo_url: profile?.logo_url || null,
        description: profile?.description || null,
        contact_phone: profile?.contact_phone || null,
        open_time: profile?.open_time || null,
        close_time: profile?.close_time || null,
        processing_days: profile?.processing_days || null,
        verification_status: profile?.verification_status || 'unverified',
      },
      stats: { active_products: 0, sold_units: 0, rating_average: null, rating_count: 0, tracking_coverage: null },
    };
  }

  const placeholders = productIds.map(() => '?').join(',');
  const [[ratingStats]] = await pool.query(
    `SELECT COUNT(*) AS rating_count, ROUND(AVG(rating), 1) AS rating_average
     FROM ratings WHERE product_id IN (${placeholders})`, productIds
  );
  const [orderItems] = await pool.query(
    `SELECT oi.qty, o.id AS order_id, o.tracking_id FROM order_items oi
     INNER JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id IN (${placeholders}) AND o.status IN ('paid','processing','shipped','delivered')`,
    productIds
  );

  const orderTracking = new Map();
  orderItems.forEach(item => {
    orderTracking.set(item.order_id, Boolean(item.tracking_id));
  });
  const trackedOrders = [...orderTracking.values()].filter(Boolean).length;

  return {
    seller: {
      ...seller,
      store_name: profile?.store_name || seller.name,
      logo_url: profile?.logo_url || null,
      description: profile?.description || null,
      contact_phone: profile?.contact_phone || null,
      open_time: profile?.open_time || null,
      close_time: profile?.close_time || null,
      processing_days: profile?.processing_days || null,
      verification_status: profile?.verification_status || 'unverified',
    },
    stats: {
      active_products: productIds.length,
      sold_units: orderItems.reduce((sum, item) => sum + item.qty, 0),
      rating_average: ratingStats.rating_count > 0 ? ratingStats.rating_average : null,
      rating_count: ratingStats.rating_count,
      tracking_coverage: orderTracking.size > 0
        ? Math.round((trackedOrders / orderTracking.size) * 100) : null,
    },
  };
};

const getProductsBySeller = async (sellerId, query) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;
  const orderBy = SELLER_PRODUCT_SORTS[query.sort] || SELLER_PRODUCT_SORTS.created_desc;

  let where = ['seller_id = ?'];
  let params = [sellerId];

  if (query.status === 'active') { where.push('is_active = 1'); }
  else if (query.status === 'inactive') { where.push('is_active = 0'); }
  if (query.stock === 'out') { where.push('stock = 0'); }
  else if (query.stock === 'low') { where.push('is_low_stock = 1'); }

  const [rawData] = await pool.query(
    `SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT 5000`,
    params
  );

  const filtered = query.search?.trim()
    ? kmpFilterProducts(rawData, query.search.trim(), 'name')
    : rawData;

  return {
    data: await enrichProductsWithPromotions(filtered.slice(offset, offset + limit)),
    pagination: { page, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) },
  };
};

const getProductBySeller = async (sellerId, productId) => {
  const [rows] = await pool.query(
    'SELECT * FROM products WHERE id = ? AND seller_id = ?', [productId, sellerId]
  );
  if (!rows[0]) throw { status: 404, code: 'NOT_FOUND', message: 'Produk seller tidak ditemukan' };
  return enrichProductsWithPromotions(rows[0]);
};

const createProduct = async (sellerId, payload) => {
  const isActive = payload.is_active === false ? 0 : (payload.stock > 0 ? 1 : 0);
  const prodId = randomUUID();

  await pool.query(
    `INSERT INTO products (id, seller_id, name, description, category, price, stock, is_active, image_url, minimum_stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [prodId, sellerId, payload.name, payload.description || null, payload.category,
     payload.price, payload.stock || 0, isActive, payload.image_url || null, payload.minimum_stock || 5]
  );

  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [prodId]);
  return enrichProductsWithPromotions(rows[0]);
};

const updateProduct = async (user, productId, payload) => {
  const [prodRows] = await pool.query('SELECT seller_id, stock FROM products WHERE id = ?', [productId]);
  const prod = prodRows[0];
  if (!prod) throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  if (prod.seller_id !== user.id && user.role !== 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }

  if (user.role === 'seller' && payload.is_active === true) {
    const [auditRows] = await pool.query(
      `SELECT action, reason, created_at FROM admin_audit_logs
       WHERE target_type = 'product' AND target_id = ?
       AND action IN ('product.activated', 'product.deactivated')
       ORDER BY created_at DESC LIMIT 1`,
      [productId]
    );
    if (auditRows[0]?.action === 'product.deactivated') {
      throw { status: 403, code: 'ADMIN_MODERATION_LOCK', message: `Produk dikunci oleh admin: ${auditRows[0].reason || 'menunggu review ulang'}` };
    }
  }

  if (payload.stock !== undefined && payload.stock <= 0) {
    payload.is_active = false;
  }

  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(payload)) {
    if (['name', 'description', 'category', 'price', 'stock', 'is_active', 'image_url', 'minimum_stock'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'is_active' ? (value ? 1 : 0) : value);
    }
  }
  if (fields.length > 0) {
    values.push(productId);
    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
  return enrichProductsWithPromotions(rows[0]);
};

const deleteProduct = async (user, productId) => {
  const [prodRows] = await pool.query('SELECT seller_id FROM products WHERE id = ?', [productId]);
  if (!prodRows[0]) throw { status: 404, code: 'NOT_FOUND', message: 'Produk tidak ditemukan' };
  if (prodRows[0].seller_id !== user.id && user.role !== 'superadmin') {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akses ditolak' };
  }
  await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [productId]);
  return { success: true };
};

const exportProductsBySeller = async (sellerId, query) => {
  let where = ['seller_id = ?'];
  let params = [sellerId];
  if (query.status === 'active') { where.push('is_active = 1'); }
  else if (query.status === 'inactive') { where.push('is_active = 0'); }
  if (query.stock === 'out') { where.push('stock = 0'); }
  else if (query.stock === 'low') { where.push('is_low_stock = 1'); }

  const [rawData] = await pool.query(
    `SELECT id, name, category, description, price, stock, minimum_stock, is_low_stock, is_active, image_url, created_at, updated_at
     FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 5000`,
    params
  );

  const data = query.search?.trim()
    ? kmpFilterProducts(rawData, query.search.trim(), 'name')
    : rawData;

  const rows = data || [];
  const headers = ['ID', 'Nama Produk', 'Kategori', 'Deskripsi', 'Harga', 'Stok', 'Stok Minimum', 'Status', 'Gambar URL', 'Dibuat', 'Diperbarui'];
  const lines = [
    headers.join(','),
    ...rows.map(row => [
      row.id, escapeCSV(row.name), escapeCSV(row.category), escapeCSV(row.description),
      row.price, row.stock, row.minimum_stock ?? '',
      row.is_active ? 'Aktif' : 'Nonaktif', escapeCSV(row.image_url),
      row.created_at ? new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '',
      row.updated_at ? new Date(row.updated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '',
    ].join(',')),
  ];

  return { csv: lines.join('\r\n'), count: rows.length, truncated: rows.length >= 5000 };
};

module.exports = {
  getProducts, getProductById, getPublicStore, getProductsBySeller, getProductBySeller,
  uploadProductImage, createProduct, updateProduct, deleteProduct, exportProductsBySeller,
};
