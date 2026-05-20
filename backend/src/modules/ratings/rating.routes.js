const express = require('express');
const router = express.Router();
const ratingController = require('./rating.controller');
const { verifyToken } = require('../../middlewares/auth');

// Submit rating — buyer only, setelah order delivered
router.post('/', verifyToken, ratingController.submitRating);

// Ambil semua rating produk — public
router.get('/product/:productId', ratingController.getProductRatings);

// Cek apakah sudah rating — buyer
router.get('/check/:orderId/:productId', verifyToken, ratingController.checkRated);

module.exports = router;
