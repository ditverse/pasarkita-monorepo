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

const updateUserStatus = async (req, res, next) => {
  try {
    const data = await adminService.updateUserStatus(req.params.id, req.body);
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

module.exports = { getUsers, updateUserStatus, getAnalytics };
