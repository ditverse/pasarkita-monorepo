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
    // Pass user agar service bisa validasi role
    const data = await orderService.updateOrderStatus(
      req.user,
      req.params.id,
      req.body.status,
      req.body.reason
    );
    return successResponse(res, 200, 'Status order berhasil diperbarui', data);
  } catch (err) {
    next(err);
  }
};

const getTrackingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Ambil order dulu untuk dapat tracking_id
    const order = await orderService.getOrderById(req.user, id);
    if (!order.tracking_id) {
      return successResponse(res, 200, 'Tracking belum tersedia', { tracking_id: null, status: null });
    }

    const tracking = await orderService.getTrackingStatus(order.tracking_id);
    return successResponse(res, 200, 'Status tracking', tracking);
  } catch (err) {
    next(err);
  }
};

const confirmDelivered = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Hanya buyer pemilik order yang bisa konfirmasi
    const order = await orderService.getOrderById(req.user, id);
    if (order.buyer_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bukan order Anda', error: { code: 'FORBIDDEN' } });
    }
    if (order.status !== 'shipped') {
      return res.status(400).json({ success: false, message: 'Order harus berstatus "shipped" untuk dikonfirmasi', error: { code: 'INVALID_STATUS' } });
    }
    const data = await orderService.updateOrderStatus(req.user, id, 'delivered');
    return successResponse(res, 200, 'Pesanan dikonfirmasi selesai', data);
  } catch (err) {
    next(err);
  }
};

const startProcessing = async (req, res, next) => {
  try {
    const data = await orderService.startProcessing(req.user, req.params.id, req.body.pickup_address);
    return successResponse(res, 200, 'Pesanan mulai diproses', data);
  } catch (err) {
    next(err);
  }
};

const shipOrder = async (req, res, next) => {
  try {
    const data = await orderService.shipOrder(req.user, req.params.id);
    return successResponse(res, 200, 'Pesanan diserahkan ke pengiriman', data);
  } catch (err) {
    next(err);
  }
};

const retryShipping = async (req, res, next) => {
  try {
    const data = await orderService.retryShipping(req.user, req.params.id);
    return successResponse(res, 200, 'Sinkronisasi pengiriman berhasil', data);
  } catch (err) {
    next(err);
  }
};

const getPackingList = async (req, res, next) => {
  try {
    const data = await orderService.getPackingList(req.user, req.params.id);
    return successResponse(res, 200, 'Packing list', data);
  } catch (err) {
    next(err);
  }
};

const exportSellerOrders = async (req, res, next) => {
  try {
    const result = await orderService.exportOrdersBySeller(req.user.id, req.query);
    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="order-toko-${timestamp}.csv"`);
    if (result.truncated) {
      res.setHeader('X-Export-Truncated', 'true');
      res.setHeader('X-Export-Count', String(result.count));
    }
    return res.send('\uFEFF' + result.csv);
  } catch (err) {
    next(err);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ success: false, message: 'Hanya pembeli yang bisa membatalkan pesanan mandiri' });
    }
    const data = await orderService.cancelOrder(req.params.id, req.user.id);
    return successResponse(res, 200, 'Pesanan berhasil dibatalkan', data);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  getTrackingStatus,
  confirmDelivered,
  startProcessing,
  shipOrder,
  retryShipping,
  getPackingList,
  exportSellerOrders,
  cancelOrder,
};
