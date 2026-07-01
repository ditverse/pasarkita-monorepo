const pool = require('../config/mysql');

const warnOnce = new Set();

const logUnavailableOnce = (table, error) => {
  const key = `${table}:${error?.code || error?.message || 'unknown'}`;
  if (warnOnce.has(key)) return;
  warnOnce.add(key);
  console.warn(`[Observability] ${table} tidak tersedia:`, error?.message || error);
};

const writeAuditLog = async ({
  actorId,
  action,
  targetType,
  targetId,
  reason = null,
  before = null,
  after = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO admin_audit_logs (id, actor_id, action, target_type, target_id, reason, before_data, after_data)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
      [actorId, action, targetType, targetId, reason,
       before ? JSON.stringify(before) : null,
       after ? JSON.stringify(after) : null]
    );
  } catch (error) {
    logUnavailableOnce('admin_audit_logs', error);
  }
};

const writeIntegrationLog = async ({
  service,
  operation,
  success,
  durationMs,
  orderId = null,
  statusCode = null,
  errorCode = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO integration_logs (id, service, operation, success, duration_ms, order_id, status_code, error_code)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)`,
      [service, operation, success, durationMs, orderId, statusCode, errorCode]
    );
  } catch (error) {
    logUnavailableOnce('integration_logs', error);
  }
};

module.exports = { writeAuditLog, writeIntegrationLog };
