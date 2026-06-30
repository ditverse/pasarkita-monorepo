const sellerService = require('./seller.service');
const ratingService = require('../ratings/rating.service');
const promotionService = require('../promotions/promotion.service');
const { successResponse } = require('../../utils/response');

const getAnalytics = async (req, res, next) => {
  try {
    const data = await sellerService.getSellerAnalytics(req.user.id, req.query);
    return successResponse(res, 200, 'Analytics seller', data);
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const data = await sellerService.getStoreProfile(req.user.id);
    return successResponse(res, 200, 'Profil toko', data);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const data = await sellerService.updateStoreProfile(req.user.id, req.body);
    return successResponse(res, 200, 'Profil toko berhasil diperbarui', data);
  } catch (error) {
    next(error);
  }
};

const uploadLogo = async (req, res, next) => {
  try {
    const data = await sellerService.uploadStoreLogo(req.user.id, req.file);
    return successResponse(res, 201, 'Logo toko berhasil diunggah', data);
  } catch (error) {
    next(error);
  }
};

const setVacation = async (req, res, next) => {
  try {
    const data = await sellerService.setVacationMode(req.user.id, req.body);
    return successResponse(res, 200, 'Mode libur toko diperbarui', data);
  } catch (error) {
    next(error);
  }
};

const getReviews = async (req, res, next) => {
  try {
    const { replied, rating, page, limit } = req.query;
    const options = {};
    if (replied !== undefined) options.replied = replied === 'true';
    if (rating) options.rating = Number(rating);
    if (page) options.page = Number(page);
    if (limit) options.limit = Number(limit);
    const data = await ratingService.getSellerReviews(req.user.id, options);
    return successResponse(res, 200, 'Ulasan produk toko', data);
  } catch (error) {
    next(error);
  }
};

const getPromotions = async (req, res, next) => {
  try {
    const data = await promotionService.listSellerPromotions(req.user.id);
    return successResponse(res, 200, 'Promosi seller', data);
  } catch (error) {
    next(error);
  }
};

const createDiscount = async (req, res, next) => {
  try {
    const data = await promotionService.createSellerDiscount(req.user.id, req.body);
    return successResponse(res, 201, 'Diskon produk berhasil dibuat', data);
  } catch (error) {
    next(error);
  }
};

const updateDiscount = async (req, res, next) => {
  try {
    const data = await promotionService.updateSellerDiscount(req.user.id, req.params.id, req.body);
    return successResponse(res, 200, 'Diskon produk berhasil diperbarui', data);
  } catch (error) {
    next(error);
  }
};

const createVoucher = async (req, res, next) => {
  try {
    const data = await promotionService.createSellerVoucher(req.user.id, req.body);
    return successResponse(res, 201, 'Voucher toko berhasil dibuat', data);
  } catch (error) {
    next(error);
  }
};

const updateVoucher = async (req, res, next) => {
  try {
    const data = await promotionService.updateSellerVoucher(req.user.id, req.params.id, req.body);
    return successResponse(res, 200, 'Voucher toko berhasil diperbarui', data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics,
  getProfile,
  updateProfile,
  uploadLogo,
  setVacation,
  getReviews,
  getPromotions,
  createDiscount,
  updateDiscount,
  createVoucher,
  updateVoucher,
};
