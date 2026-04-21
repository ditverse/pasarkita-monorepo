const express = require('express');
const router = express.Router();
const checkoutController = require('./checkout.controller');
const { verifyToken } = require('../../middlewares/auth');

router.post('/', verifyToken, checkoutController.processCheckout);

module.exports = router;
