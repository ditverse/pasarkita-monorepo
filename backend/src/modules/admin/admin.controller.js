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

module.exports = { getUsers, getUserById, updateUserStatus, getAnalytics, getAuditLogs };
