const express = require('express');
const router = express.Router();
const checkoutController = require('./checkout.controller');
const { verifyToken } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { checkoutSchema } = require('./checkout.schema');

router.post('/', verifyToken, validate(checkoutSchema), checkoutController.processCheckout);

module.exports = router;
