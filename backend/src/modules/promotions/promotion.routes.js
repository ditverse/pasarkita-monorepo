const express = require('express');
const promotionController = require('./promotion.controller');
const validate = require('../../middlewares/validate');
const { verifyToken } = require('../../middlewares/auth');
const { quoteSchema } = require('./promotion.schema');

const router = express.Router();

router.post('/quote', validate(quoteSchema), promotionController.quote);
router.get('/vouchers/available', verifyToken, promotionController.getAvailableVouchers);

module.exports = router;
