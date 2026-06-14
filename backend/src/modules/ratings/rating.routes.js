const express = require('express');
const multer = require('multer');
const router = express.Router();
const ratingController = require('./rating.controller');
const { verifyToken } = require('../../middlewares/auth');

// Multer untuk upload foto ulasan — max 5 MB per file, satu file per request
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      const err = new Error('Format gambar harus JPG, PNG, atau WebP');
      err.status = 400;
      err.code = 'INVALID_IMAGE_TYPE';
      return callback(err);
    }
    callback(null, true);
  },
});

// Upload foto ulasan — buyer only, satu file per request
router.post('/upload-image', verifyToken, upload.single('image'), ratingController.uploadReviewImage);

// Submit rating — buyer only, setelah order delivered
router.post('/', verifyToken, ratingController.submitRating);

// Ambil semua rating produk — public
router.get('/product/:productId', ratingController.getProductRatings);

// Cek apakah sudah rating — buyer
router.get('/check/:orderId/:productId', verifyToken, ratingController.checkRated);

module.exports = router;
