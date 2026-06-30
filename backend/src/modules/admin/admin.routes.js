const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { verifyToken, requireSuperadmin } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateUserStatusSchema, moderateProductSchema } = require('./admin.schema');
const {
  marketplaceVoucherSchema,
  updateMarketplaceVoucherSchema,
} = require('../promotions/promotion.schema');

router.use(verifyToken, requireSuperadmin);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.get('/moderation/sellers', adminController.getModerationSellers);
router.get('/moderation/products', adminController.getModerationProducts);
router.get('/moderation/products/:id', adminController.getModerationProductById);
router.patch(
  '/moderation/products/:id/status',
  validate(moderateProductSchema),
  adminController.moderateProduct
);
router.get('/analytics', adminController.getAnalytics);
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/reports/preview', adminController.previewReport);
router.get('/reports/export', adminController.exportReport);
router.get('/fee-simulator', adminController.simulateFeeImpact);
router.get('/promotions/vouchers', adminController.getMarketplaceVouchers);
router.post('/promotions/vouchers', validate(marketplaceVoucherSchema), adminController.createMarketplaceVoucher);
router.patch('/promotions/vouchers/:id', validate(updateMarketplaceVoucherSchema), adminController.updateMarketplaceVoucher);

// Admin Ads & Banners Routes
const adsController = require('../ads/ads.controller');
const { moderateAdSchema, createBannerSchema, updateBannerSchema } = require('../ads/ads.schema');

router.get('/ads', adsController.getAdminAds);
router.patch('/ads/:id/status', validate(moderateAdSchema), adsController.moderateSellerAd);

router.get('/banners', adsController.getBanners);
router.post('/banners', validate(createBannerSchema), adsController.createBanner);
router.patch('/banners/:id', validate(updateBannerSchema), adsController.updateBanner);
router.delete('/banners/:id', adsController.deleteBanner);

module.exports = router;
