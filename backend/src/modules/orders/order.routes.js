const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { verifyToken, requireSuperadmin } = require('../../middlewares/auth');

router.get('/', verifyToken, orderController.getOrders);
router.get('/:id', verifyToken, orderController.getOrderById);
router.get('/:id/tracking', verifyToken, orderController.getTrackingStatus);
// Seller bisa update status ke 'shipped', superadmin bisa semua status
router.patch('/:id/status', verifyToken, orderController.updateOrderStatus);
// Buyer konfirmasi pesanan diterima → status delivered
router.post('/:id/confirm', verifyToken, orderController.confirmDelivered);

module.exports = router;
