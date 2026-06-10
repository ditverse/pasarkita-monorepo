const adminService = require('./admin.service');
const { successResponse } = require('../../utils/response');

const getUsers = async (req, res, next) => {
  try {
    const result = await adminService.getUsers(req.query);
    return successResponse(res, 200, 'Daftar user', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const data = await adminService.getUserById(req.params.id);
    return successResponse(res, 200, 'Detail user', data);
  } catch (err) {
    next(err);
  }
};

const getModerationSellers = async (req, res, next) => {
  try {
    const result = await adminService.getModerationSellers(req.query);
    return successResponse(res, 200, 'Daftar seller untuk moderasi', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const getModerationProducts = async (req, res, next) => {
  try {
    const result = await adminService.getModerationProducts(req.query);
    return successResponse(res, 200, 'Daftar produk untuk moderasi', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const getModerationProductById = async (req, res, next) => {
  try {
    const data = await adminService.getModerationProductById(req.params.id);
    return successResponse(res, 200, 'Detail produk admin', data);
  } catch (err) {
    next(err);
  }
};

const moderateProduct = async (req, res, next) => {
  try {
    const data = await adminService.moderateProduct(req.user, req.params.id, req.body);
    return successResponse(res, 200, 'Status listing berhasil diperbarui', data);
  } catch (err) {
    next(err);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const data = await adminService.updateUserStatus(req.user, req.params.id, req.body);
    return successResponse(res, 200, 'Status user berhasil diperbarui', data);
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const data = await adminService.getAnalytics(req.query);
    return successResponse(res, 200, 'Data analytics', data);
  } catch (err) {
    next(err);
  }
};

const getAuditLogs = async (req, res, next) => {
  try {
    const result = await adminService.getAuditLogs(req.query);
    return successResponse(res, 200, 'Audit log admin', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const previewReport = async (req, res, next) => {
  try {
    const data = await adminService.previewReport(req.query);
    return successResponse(res, 200, 'Preview laporan', data);
  } catch (err) {
    next(err);
  }
};

const exportReport = async (req, res, next) => {
  try {
    const result = await adminService.exportReport(req.user, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csv);
  } catch (err) {
    next(err);
  }
};

const simulateFeeImpact = async (req, res, next) => {
  try {
    const data = await adminService.simulateFeeImpact(req.query);
    return successResponse(res, 200, 'Simulasi dampak fee', data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  getModerationSellers,
  getModerationProducts,
  getModerationProductById,
  moderateProduct,
  updateUserStatus,
  getAnalytics,
  getAuditLogs,
  previewReport,
  exportReport,
  simulateFeeImpact,
};
