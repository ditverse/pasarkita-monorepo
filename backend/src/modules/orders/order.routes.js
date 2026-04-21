const express = require('express');
const router = express.Router();
const orderController = require('./order.controller');
const { verifyToken, requireSuperadmin } = require('../../middlewares/auth');

router.get('/', verifyToken, orderController.getOrders);
router.get('/:id', verifyToken, orderController.getOrderById);
router.patch('/:id/status', verifyToken, requireSuperadmin, orderController.updateOrderStatus);

module.exports = router;
