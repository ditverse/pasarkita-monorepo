const pool = require('../../config/mysql');
const { writeAuditLog } = require('../../utils/observability');
const { kmpSearch } = require('../../utils/kmp-search');
const { parsePositiveInt } = require('../../utils/shared');
const { AppError } = require('../../utils/app-error');

const VALID_USER_STATUSES = new Set(['active', 'inactive']);

const getModerationSellers = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = ["role = 'seller'"];
  let params = [];
  if (query.status && VALID_USER_STATUSES.has(query.status)) {
    where.push('is_active = ?');
    params.push(query.status === 'active' ? 1 : 0);
  }
  const [rawData] = await pool.query(
    `SELECT id, name, email, is_active, created_at FROM users WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 5000`,
    params
  );

  const term = query.search?.trim().replace(/[%_,]/g, '') || '';
  const sellers = term
    ? rawData.filter(s => kmpSearch(s.name || '', term) || kmpSearch(s.email || '', term))
    : rawData;
  const sellerIds = sellers.map(s => s.id);

  let productSummary = new Map();
  if (sellerIds.length > 0) {
    const [products] = await pool.query(
      `SELECT seller_id, is_active, stock FROM products WHERE seller_id IN (${sellerIds.map(() => '?').join(',')})`,
      sellerIds
    );
    products.forEach(p => {
      const cur = productSummary.get(p.seller_id) || { total_products: 0, active_products: 0, inactive_products: 0, low_stock_products: 0 };
      cur.total_products++;
      if (p.is_active) cur.active_products++; else cur.inactive_products++;
      if (p.is_active && p.stock <= 5) cur.low_stock_products++;
      productSummary.set(p.seller_id, cur);
    });
  }

  return {
    data: sellers.slice(offset, offset + limit).map(s => ({
      ...s,
      verification_status: 'not_configured',
      product_summary: productSummary.get(s.id) || { total_products: 0, active_products: 0, inactive_products: 0, low_stock_products: 0 }
    })),
    pagination: { page, limit, total: sellers.length, total_pages: Math.ceil(sellers.length / limit) }
  };
};

const getModerationProducts = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = [];
  let params = [];
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
     ${whereClause} ORDER BY p.created_at DESC LIMIT 5000`,
    params
  );

  const term = query.search?.trim().replace(/[%_,]/g, '') || '';
  const filtered = term ? rawData.filter(p => kmpSearch(p.name || '', term)) : rawData;
  return {
    data: filtered.slice(offset, offset + limit),
    pagination: { page, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) }
  };
};

const moderateProduct = async (actor, productId, payload) => {
  const [prodRows] = await pool.query('SELECT id, seller_id, name, is_active, stock FROM products WHERE id = ?', [productId]);
  const product = prodRows[0];
  if (!product) throw new AppError(404, 'NOT_FOUND', 'Produk tidak ditemukan');
  if (payload.is_active && product.stock <= 0) {
    throw new AppError(400, 'OUT_OF_STOCK', 'Produk dengan stok habis tidak dapat diaktifkan');
  }

  await pool.query('UPDATE products SET is_active = ? WHERE id = ?', [payload.is_active ? 1 : 0, productId]);
  await writeAuditLog({
    actorId: actor.id,
    action: payload.is_active ? 'product.activated' : 'product.deactivated',
    targetType: 'product',
    targetId: productId,
    reason: payload.reason,
    before: { is_active: product.is_active },
    after: { is_active: payload.is_active, moderation_rule: payload.rule, seller_id: product.seller_id }
  });

  const [rows] = await pool.query('SELECT id, seller_id, name, is_active, stock FROM products WHERE id = ?', [productId]);
  return rows[0];
};

module.exports = {
  getModerationSellers,
  getModerationProducts,
  moderateProduct,
};
