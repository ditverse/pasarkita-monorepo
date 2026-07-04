const pool = require('../../config/mysql');
const { writeAuditLog } = require('../../utils/observability');
const { kmpSearch } = require('../../utils/kmp-search');
const { parsePositiveInt } = require('../../utils/shared');
const { AppError } = require('../../utils/app-error');

const VALID_ROLES = new Set(['buyer', 'seller', 'superadmin']);
const VALID_USER_STATUSES = new Set(['active', 'inactive']);
const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);

const getUsers = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = [];
  let params = [];
  if (query.role && VALID_ROLES.has(query.role)) {
    where.push('role = ?');
    params.push(query.role);
  }
  if (query.status && VALID_USER_STATUSES.has(query.status)) {
    where.push('is_active = ?');
    params.push(query.status === 'active' ? 1 : 0);
  }
  if (query.created_from) {
    where.push('created_at >= ?');
    params.push(new Date(`${query.created_from}T00:00:00+07:00`).toISOString());
  }
  if (query.created_to) {
    where.push('created_at <= ?');
    params.push(new Date(`${query.created_to}T23:59:59.999+07:00`).toISOString());
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const [rawData] = await pool.query(
    `SELECT id, name, email, role, is_active, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT 5000`,
    params
  );

  const term = query.search?.trim().replace(/[%_,]/g, '') || '';
  const filtered = term
    ? rawData.filter(u => kmpSearch(u.name || '', term) || kmpSearch(u.email || '', term))
    : rawData;
  const total = filtered.length;

  return {
    data: filtered.slice(offset, offset + limit),
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
  };
};

const getUserById = async (userId) => {
  const [userRows] = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [userId]);
  const user = userRows[0];
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User tidak ditemukan');

  const result = {
    user,
    stats: { total_orders: 0, paid_orders: 0, total_spent: 0, total_products: 0, active_products: 0 },
    recent_orders: [],
    recent_products: [],
    audit_history: { available: true, data: [] }
  };

  const [auditLogs] = await pool.query(
    `SELECT aal.*, au.name AS actor_name, au.email AS actor_email
     FROM admin_audit_logs aal LEFT JOIN users au ON au.id = aal.actor_id
     WHERE aal.target_type = 'user' AND aal.target_id = ?
     ORDER BY aal.created_at DESC LIMIT 20`,
    [userId]
  );
  result.audit_history.data = auditLogs.map(l => ({
    ...l,
    actor: l.actor_name ? { id: l.actor_id, name: l.actor_name, email: l.actor_email } : null
  }));

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

const updateUserStatus = async (actor, userId, payload) => {
  const { is_active, reason } = payload;
  if (actor.id === userId) {
    throw new AppError(403, 'FORBIDDEN', 'Admin tidak dapat mengubah status akunnya sendiri');
  }

  const [targetRows] = await pool.query('SELECT id, name, email, role, is_active FROM users WHERE id = ?', [userId]);
  const target = targetRows[0];
  if (!target) throw new AppError(404, 'NOT_FOUND', 'User tidak ditemukan');
  if (target.role === 'superadmin') {
    throw new AppError(403, 'FORBIDDEN', 'Tidak bisa mengubah status superadmin');
  }

  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, userId]);
  await writeAuditLog({
    actorId: actor.id,
    action: is_active ? 'user.activated' : 'user.banned',
    targetType: 'user',
    targetId: userId,
    reason,
    before: { is_active: target.is_active },
    after: { is_active }
  });

  return { id: userId, is_active: is_active ? 1 : 0 };
};

module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
};
