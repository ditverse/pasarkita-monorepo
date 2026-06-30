const express = require('express');
const multer = require('multer');
const sellerController = require('./seller.controller');
const { verifyToken, requireSeller } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateStoreProfileSchema } = require('./seller.schema');
const {
  discountSchema,
  updateDiscountSchema,
  sellerVoucherSchema,
  updateSellerVoucherSchema,
} = require('../promotions/promotion.schema');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const error = new Error('Format logo harus JPG, PNG, atau WebP');
      error.status = 400;
      error.code = 'INVALID_IMAGE_TYPE';
      return callback(error);
    }
    callback(null, true);
  },
});

router.use(verifyToken, requireSeller);
router.get('/analytics', sellerController.getAnalytics);
router.get('/reviews', sellerController.getReviews);
router.get('/promotions', sellerController.getPromotions);
router.post('/promotions/discounts', validate(discountSchema), sellerController.createDiscount);
router.patch('/promotions/discounts/:id', validate(updateDiscountSchema), sellerController.updateDiscount);
router.post('/promotions/vouchers', validate(sellerVoucherSchema), sellerController.createVoucher);
router.patch('/promotions/vouchers/:id', validate(updateSellerVoucherSchema), sellerController.updateVoucher);
router.get('/profile', sellerController.getProfile);
router.put('/profile', validate(updateStoreProfileSchema), sellerController.updateProfile);
router.post('/profile/logo', upload.single('logo'), sellerController.uploadLogo);
router.patch('/vacation', sellerController.setVacation);

// Seller Ads Routes
const adsController = require('../ads/ads.controller');
const { createAdSchema } = require('../ads/ads.schema');
router.get('/ads', adsController.getSellerAds);
router.post('/ads', validate(createAdSchema), adsController.createSellerAd);
router.post('/ads/:id/pay', adsController.paySellerAd);
router.patch('/ads/:id/pause', adsController.pauseSellerAd);

module.exports = router;
