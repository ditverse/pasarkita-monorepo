const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { verifyToken, requireSeller } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateOrderStatusSchema, processOrderSchema } = require('./order.schema');

router.get('/', verifyToken, orderController.getOrders);
router.get('/seller-export', verifyToken, requireSeller, orderController.exportSellerOrders);
router.get('/:id/packing-list', verifyToken, requireSeller, orderController.getPackingList);
router.get('/:id', verifyToken, orderController.getOrderById);
router.get('/:id/tracking', verifyToken, orderController.getTrackingStatus);
router.patch('/:id/status', verifyToken, validate(updateOrderStatusSchema), orderController.updateOrderStatus);
router.post('/:id/process', verifyToken, requireSeller, validate(processOrderSchema), orderController.startProcessing);
router.post('/:id/ship', verifyToken, requireSeller, orderController.shipOrder);
router.post('/:id/shipping/retry', verifyToken, requireSeller, orderController.retryShipping);
// Buyer konfirmasi pesanan diterima → status delivered
router.post('/:id/confirm', verifyToken, orderController.confirmDelivered);
// Buyer membatalkan pesanan mandiri
router.post('/:id/cancel', verifyToken, orderController.cancelOrder);

module.exports = router;
