const supabase = require('../config/supabase');

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
  const { error } = await supabase.from('admin_audit_logs').insert([{
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    reason,
    before_data: before,
    after_data: after,
  }]);

  if (error) logUnavailableOnce('admin_audit_logs', error);
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
  const { error } = await supabase.from('integration_logs').insert([{
    service,
    operation,
    success,
    duration_ms: durationMs,
    order_id: orderId,
    status_code: statusCode,
    error_code: errorCode,
  }]);

  if (error) logUnavailableOnce('integration_logs', error);
};

module.exports = { writeAuditLog, writeIntegrationLog };
