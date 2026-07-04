const pool = require('../../config/mysql');
const { writeAuditLog } = require('../../utils/observability');
const { parsePositiveInt } = require('../../utils/shared');
const { AppError } = require('../../utils/app-error');

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_ROLES = new Set(['buyer', 'seller', 'superadmin']);
const PAID_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);
const REPORT_TYPES = new Set(['orders', 'users', 'sellers', 'products', 'analytics']);

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
  return { start, end };
};

const getAuditLogs = async (query) => {
  const page = parsePositiveInt(query.page, 1, 100000);
  const limit = parsePositiveInt(query.limit, 20, 100);
  const offset = (page - 1) * limit;

  let where = [];
  let params = [];
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

  return {
    data: data.map(l => ({
      ...l,
      actor: l.actor_name ? { id: l.actor_id, name: l.actor_name, email: l.actor_email } : null
    })),
    pagination: { page, limit, total: countRow.cnt, total_pages: Math.ceil(countRow.cnt / limit) }
  };
};

const buildReport = async (query) => {
  const type = query.type;
  if (!REPORT_TYPES.has(type)) throw new AppError(400, 'VALIDATION_ERROR', 'Jenis laporan tidak valid');

  const reportDateIso = (value, endOfDay = false) => {
    if (!value) return null;
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00'}+07:00`);
    if (Number.isNaN(date.getTime())) throw new AppError(400, 'VALIDATION_ERROR', 'Filter tanggal tidak valid');
    return date.toISOString();
  };

  if (type === 'orders') {
    let where = [];
    let params = [];
    if (query.status) { where.push('o.status = ?'); params.push(query.status); }
    if (query.start) { where.push('o.created_at >= ?'); params.push(reportDateIso(query.start)); }
    if (query.end) { where.push('o.created_at <= ?'); params.push(reportDateIso(query.end, true)); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [data] = await pool.query(`SELECT o.id, o.buyer_id, o.status, o.subtotal, o.fee_marketplace, o.total, o.transaction_id, o.tracking_id, o.created_at, o.updated_at, b.name AS buyer_name, b.email AS buyer_email FROM orders o LEFT JOIN users b ON b.id = o.buyer_id ${whereClause} ORDER BY o.created_at DESC LIMIT 5000`, params);
    const term = query.search?.trim().toLowerCase();
    const filtered = term ? data.filter(o => o.id.toLowerCase().includes(term) || o.transaction_id?.toLowerCase().includes(term) || o.buyer_name?.toLowerCase().includes(term)) : data;
    return {
      type,
      columns: [{ key: 'order_id', label: 'Order ID' }, { key: 'buyer', label: 'Buyer' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total' }, { key: 'created_at', label: 'Dibuat' }],
      rows: filtered.map(o => ({ order_id: o.id, buyer: o.buyer_name || '', status: o.status, total: o.total, created_at: o.created_at }))
    };
  }

  if (type === 'users' || type === 'sellers') {
    let where = [];
    let params = [];
    if (type === 'sellers') { where.push("role = 'seller'"); }
    if (query.role && VALID_ROLES.has(query.role)) { where.push('role = ?'); params.push(query.role); }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [data] = await pool.query(`SELECT id, name, email, role, is_active, created_at FROM users ${whereClause} ORDER BY created_at DESC LIMIT 5000`, params);
    return {
      type,
      columns: [{ key: 'user_id', label: 'User ID' }, { key: 'name', label: 'Nama' }, { key: 'role', label: 'Role' }, { key: 'created_at', label: 'Tanggal Daftar' }],
      rows: data.map(u => ({ user_id: u.id, name: u.name, role: u.role, created_at: u.created_at }))
    };
  }

  // Products
  const [data] = await pool.query(`SELECT p.id, p.name, p.category, p.price, p.stock, p.is_active, p.created_at, u.name AS seller_name FROM products p LEFT JOIN users u ON u.id = p.seller_id ORDER BY p.created_at DESC LIMIT 5000`);
  return {
    type,
    columns: [{ key: 'product_id', label: 'Product ID' }, { key: 'name', label: 'Produk' }, { key: 'seller', label: 'Seller' }, { key: 'price', label: 'Harga' }, { key: 'created_at', label: 'Dibuat' }],
    rows: data.map(p => ({ product_id: p.id, name: p.name, seller: p.seller_name || '', price: p.price, created_at: p.created_at }))
  };
};

const previewReport = async (query) => {
  const report = await buildReport(query);
  return {
    type: report.type,
    row_count: report.rows.length,
    columns: report.columns.map(c => c.label),
    sample: report.rows.slice(0, 3),
    truncated: report.rows.length >= 5000
  };
};

const exportReport = async (actor, query) => {
  const escapeCsv = (v) => {
    if (v === null || v === undefined) return '';
    let s = String(v).replace(/\r?\n/g, ' ');
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rowsToCsv = (columns, rows) => {
    const header = columns.map(c => escapeCsv(c.label)).join(',');
    const body = rows.map(r => columns.map(c => escapeCsv(r[c.key])).join(','));
    return `\uFEFF${[header, ...body].join('\n')}`;
  };

  const report = await buildReport(query);
  await writeAuditLog({
    actorId: actor.id,
    action: 'report.exported',
    targetType: 'report',
    targetId: null,
    reason: `Export CSV ${report.type}`,
    after: { report_type: report.type, row_count: report.rows.length }
  });
  const date = new Date().toISOString().slice(0, 10);
  return { filename: `pasarkita-${report.type}-${date}.csv`, csv: rowsToCsv(report.columns, report.rows) };
};

const simulateFeeImpact = async (query) => {
  const period = parsePeriod({
    ...query,
    start: query.start ? new Date(`${query.start}T00:00:00+07:00`).toISOString() : undefined,
    end: query.end ? new Date(`${query.end}T23:59:59.999+07:00`).toISOString() : undefined
  });
  const customRate = Number(query.rate ?? 2);
  if (!Number.isFinite(customRate) || customRate < 0 || customRate > 10) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Fee simulasi harus 0-10%');
  }

  const [data] = await pool.query(
    `SELECT id, subtotal, fee_marketplace, total, status, created_at FROM orders WHERE status IN (${PAID_STATUSES.values().toArray().map(() => '?').join(',')}) AND created_at >= ? AND created_at <= ? LIMIT 5000`,
    [...PAID_STATUSES, toIso(period.start), toIso(period.end)]
  );

  const orders = data || [];
  const subtotal = orders.reduce((s, o) => s + Number(o.subtotal || 0), 0);
  const actualRevenue = orders.reduce((s, o) => s + Number(o.fee_marketplace || 0), 0);
  const buildScenario = (rate) => {
    const simulatedRevenue = orders.reduce((s, o) => s + Math.round(Number(o.subtotal || 0) * (rate / 100)), 0);
    return {
      rate,
      revenue: simulatedRevenue,
      revenue_difference: simulatedRevenue - actualRevenue,
      average_fee_per_order: orders.length ? Math.round(simulatedRevenue / orders.length) : 0
    };
  };
  const rates = [...new Set([0, 1, 2, 3, 5, customRate])].sort((a, b) => a - b);
  return {
    period: { start: toIso(period.start), end: toIso(period.end) },
    baseline: { production_fee_rate: 2, paid_orders: orders.length, subtotal, actual_revenue: actualRevenue },
    selected_rate: customRate,
    selected_scenario: buildScenario(customRate),
    scenarios: rates.map(buildScenario)
  };
};

module.exports = {
  getAuditLogs,
  previewReport,
  exportReport,
  simulateFeeImpact,
};
