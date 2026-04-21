const orderService = require('./order.service');
const { successResponse } = require('../../utils/response');

const getOrders = async (req, res, next) => {
  try {
    const result = await orderService.getOrders(req.user, req.query);
    return successResponse(res, 200, 'Daftar order', result.data, result.pagination);
  } catch (err) {
    next(err);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const data = await orderService.getOrderById(req.user, req.params.id);
    return successResponse(res, 200, 'Detail order', data);
  } catch (err) {
    next(err);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const data = await orderService.updateOrderStatus(req.params.id, req.body.status);
    return successResponse(res, 200, 'Status order berhasil diperbarui', data);
  } catch (err) {
    next(err);
  }
};

module.exports = { getOrders, getOrderById, updateOrderStatus };
