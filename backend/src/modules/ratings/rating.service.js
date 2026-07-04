const pool = require('../../config/mysql');
const { randomUUID } = require('crypto');
const { AppError } = require('../../utils/app-error');
const { saveUploadedFile } = require('../../utils/storage');

const REVIEW_IMAGE_BUCKET = 'review-images';
const MAX_PHOTOS_PER_PRODUCT = 3;

const uploadReviewImage = async (userId, file) => {
  try {
    const result = await saveUploadedFile(REVIEW_IMAGE_BUCKET, userId, file);
    return { image_url: result.url, path: result.path };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.status || 500, err.code || 'UPLOAD_FAILED', err.message || 'Gagal mengunggah gambar');
  }
};

const submitRating = async (buyerId, payload) => {
  const { order_id, product_id, rating, comment, image_urls } = payload;

  if (!order_id || !product_id || !rating) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'order_id, product_id, dan rating wajib diisi' };
  }
  if (rating < 1 || rating > 5) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Rating harus antara 1 dan 5' };
  }

  const sanitizedImages = Array.isArray(image_urls)
    ? image_urls.slice(0, MAX_PHOTOS_PER_PRODUCT).filter(url => typeof url === 'string' && url.startsWith('http'))
    : [];

  const [orderRows] = await pool.query(
    'SELECT id, buyer_id, status FROM orders WHERE id = ?', [order_id]
  );
  const order = orderRows[0];
  if (!order) throw { status: 404, code: 'NOT_FOUND', message: 'Order tidak ditemukan' };
  if (order.buyer_id !== buyerId) throw { status: 403, code: 'FORBIDDEN', message: 'Bukan order Anda' };
  if (order.status !== 'delivered') {
    throw { status: 400, code: 'INVALID_STATUS', message: 'Rating hanya bisa diberikan setelah pesanan selesai' };
  }

  const [existing] = await pool.query(
    'SELECT id FROM ratings WHERE order_id = ? AND product_id = ?', [order_id, product_id]
  );
  if (existing.length > 0) {
    throw { status: 409, code: 'ALREADY_RATED', message: 'Anda sudah memberikan ulasan untuk produk ini' };
  }

  const ratingId = randomUUID();
  await pool.query(
    `INSERT INTO ratings (id, order_id, product_id, buyer_id, rating, comment, image_urls)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ratingId, order_id, product_id, buyerId, rating, comment?.trim() || null, JSON.stringify(sanitizedImages)]
  );

  const [rows] = await pool.query('SELECT * FROM ratings WHERE id = ?', [ratingId]);
  return rows[0];
};

const getProductRatings = async (productId) => {
  const [ratings] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, r.buyer_id, r.image_urls, r.seller_reply, r.seller_replied_at
     FROM ratings r WHERE r.product_id = ? ORDER BY r.created_at DESC`,
    [productId]
  );

  const buyerIds = [...new Set(ratings.map(r => r.buyer_id))].filter(Boolean);
  let buyerMap = {};
  if (buyerIds.length > 0) {
    const placeholders = buyerIds.map(() => '?').join(',');
    const [buyers] = await pool.query(`SELECT id, name FROM users WHERE id IN (${placeholders})`, buyerIds);
    buyerMap = Object.fromEntries(buyers.map(b => [b.id, b.name]));
  }

  const total = ratings.length;
  const average = total > 0 ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10 : 0;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratings.forEach(r => { distribution[r.rating] = (distribution[r.rating] || 0) + 1; });
  const pct = {};
  Object.entries(distribution).forEach(([star, count]) => {
    pct[star] = total > 0 ? Math.round((count / total) * 100) : 0;
  });

  return {
    summary: { average, total, distribution: pct },
    reviews: ratings.map(r => ({
      id: r.id, rating: r.rating, comment: r.comment,
      image_urls: typeof r.image_urls === 'string' ? JSON.parse(r.image_urls) : (r.image_urls || []),
      date: r.created_at, buyer_name: buyerMap[r.buyer_id] ?? 'Pembeli',
      seller_reply: r.seller_reply ?? null, seller_replied_at: r.seller_replied_at ?? null,
    })),
  };
};

const checkRated = async (buyerId, orderId, productId) => {
  const [rows] = await pool.query(
    'SELECT id FROM ratings WHERE order_id = ? AND product_id = ? AND buyer_id = ?',
    [orderId, productId, buyerId]
  );
  return rows.length > 0;
};

const replyToRating = async (sellerId, ratingId, reply) => {
  if (!reply || !reply.trim()) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Balasan tidak boleh kosong' };
  if (reply.trim().length > 500) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Balasan maksimal 500 karakter' };

  const [ratingRows] = await pool.query(
    `SELECT r.id, r.product_id, r.seller_reply, p.seller_id AS product_seller_id
     FROM ratings r INNER JOIN products p ON p.id = r.product_id WHERE r.id = ?`,
    [ratingId]
  );
  const rating = ratingRows[0];
  if (!rating) throw { status: 404, code: 'NOT_FOUND', message: 'Ulasan tidak ditemukan' };
  if (rating.product_seller_id !== sellerId) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Anda bukan pemilik produk ini' };
  }
  if (rating.seller_reply) {
    throw { status: 409, code: 'ALREADY_REPLIED', message: 'Anda sudah membalas ulasan ini' };
  }

  await pool.query(
    'UPDATE ratings SET seller_reply = ?, seller_replied_at = NOW() WHERE id = ?',
    [reply.trim(), ratingId]
  );

  const [rows] = await pool.query('SELECT * FROM ratings WHERE id = ?', [ratingId]);
  return rows[0];
};

const getSellerReviews = async (sellerId, options = {}) => {
  const { replied, rating: ratingFilter, page = 1, limit = 20 } = options;

  const [products] = await pool.query('SELECT id FROM products WHERE seller_id = ?', [sellerId]);
  const productIds = products.map(p => p.id);
  if (productIds.length === 0) {
    return { reviews: [], pagination: { page, limit, total: 0, total_pages: 0 } };
  }

  const placeholders = productIds.map(() => '?').join(',');
  let where = [`r.product_id IN (${placeholders})`];
  let params = [...productIds];

  if (replied === true) { where.push('r.seller_reply IS NOT NULL'); }
  else if (replied === false) { where.push('r.seller_reply IS NULL'); }
  if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) { where.push('r.rating = ?'); params.push(ratingFilter); }

  const offset = (page - 1) * limit;
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ratings r ${whereClause}`, params
  );
  const total = countRow.cnt;

  const [ratings] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.image_urls, r.created_at, r.buyer_id, r.product_id, r.seller_reply, r.seller_replied_at
     FROM ratings r ${whereClause}
     ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const buyerIds = [...new Set(ratings.map(r => r.buyer_id))].filter(Boolean);
  const productIdsForNames = [...new Set(ratings.map(r => r.product_id))].filter(Boolean);

  let buyerMap = {}, productMap = {};
  if (buyerIds.length > 0) {
    const ph = buyerIds.map(() => '?').join(',');
    const [buyers] = await pool.query(`SELECT id, name FROM users WHERE id IN (${ph})`, buyerIds);
    buyerMap = Object.fromEntries(buyers.map(b => [b.id, b.name]));
  }
  if (productIdsForNames.length > 0) {
    const ph = productIdsForNames.map(() => '?').join(',');
    const [prods] = await pool.query(`SELECT id, name FROM products WHERE id IN (${ph})`, productIdsForNames);
    productMap = Object.fromEntries(prods.map(p => [p.id, p.name]));
  }

  return {
    reviews: ratings.map(r => ({
      id: r.id, rating: r.rating, comment: r.comment,
      image_urls: typeof r.image_urls === 'string' ? JSON.parse(r.image_urls) : (r.image_urls || []),
      date: r.created_at, buyer_name: buyerMap[r.buyer_id] ?? 'Pembeli',
      product_name: productMap[r.product_id] ?? 'Produk', product_id: r.product_id,
      seller_reply: r.seller_reply ?? null, seller_replied_at: r.seller_replied_at ?? null,
    })),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
};

module.exports = { uploadReviewImage, submitRating, getProductRatings, checkRated, replyToRating, getSellerReviews };
