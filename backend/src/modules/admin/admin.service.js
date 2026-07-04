const { getUsers, getUserById, updateUserStatus } = require('./admin-user.service');
const { getModerationSellers, getModerationProducts, moderateProduct } = require('./admin-moderation.service');
const { getAnalytics } = require('./admin-analytics.service');
const { getAuditLogs, previewReport, exportReport, simulateFeeImpact } = require('./admin-report.service');

module.exports = {
  getUsers,
  getUserById,
  updateUserStatus,
  getModerationSellers,
  getModerationProducts,
  moderateProduct,
  getAnalytics,
  getAuditLogs,
  previewReport,
  exportReport,
  simulateFeeImpact,
};
