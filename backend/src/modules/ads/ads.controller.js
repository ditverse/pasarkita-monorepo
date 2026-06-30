const adsService = require('./ads.service');
const { successResponse } = require('../../utils/response');

const getHomeCarousel = async (req, res, next) => {
  try {
    const data = await adsService.getHomeCarousel();
    return successResponse(res, 200, 'Berhasil mendapatkan banner dan iklan aktif', data);
  } catch (err) {
    next(err);
  }
};

const recordView = async (req, res, next) => {
  try {
    const result = await adsService.recordView(req.params.id);
    return successResponse(res, 200, 'Tampilan iklan berhasil dicatat', result);
  } catch (err) {
    next(err);
  }
};

const recordClick = async (req, res, next) => {
  try {
    const result = await adsService.recordClick(req.params.id);
    return successResponse(res, 200, 'Klik iklan berhasil dicatat', result);
  } catch (err) {
    next(err);
  }
};

const getSellerAds = async (req, res, next) => {
  try {
    const data = await adsService.getSellerAds(req.user.id);
    return successResponse(res, 200, 'Daftar iklan seller', data);
  } catch (err) {
    next(err);
  }
};

const createSellerAd = async (req, res, next) => {
  try {
    const data = await adsService.createSellerAd(req.user.id, req.body);
    return successResponse(res, 201, 'Iklan berhasil dibuat (menunggu pembayaran)', data);
  } catch (err) {
    next(err);
  }
};

const paySellerAd = async (req, res, next) => {
  try {
    const data = await adsService.paySellerAd(req.user.id, req.params.id);
    return successResponse(res, 200, 'Pembayaran iklan berhasil', data);
  } catch (err) {
    next(err);
  }
};

const pauseSellerAd = async (req, res, next) => {
  try {
    const data = await adsService.pauseSellerAd(req.user.id, req.params.id);
    return successResponse(res, 200, 'Iklan berhasil dijeda', data);
  } catch (err) {
    next(err);
  }
};

const getAdminAds = async (req, res, next) => {
  try {
    const data = await adsService.getAdminAds();
    return successResponse(res, 200, 'Daftar iklan seller untuk admin', data);
  } catch (err) {
    next(err);
  }
};

const moderateSellerAd = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const data = await adsService.moderateSellerAd(req.user.id, req.params.id, status, reason);
    return successResponse(res, 200, `Iklan berhasil diubah menjadi ${status}`, data);
  } catch (err) {
    next(err);
  }
};

const getBanners = async (req, res, next) => {
  try {
    const data = await adsService.getBanners();
    return successResponse(res, 200, 'Daftar banner', data);
  } catch (err) {
    next(err);
  }
};

const createBanner = async (req, res, next) => {
  try {
    const data = await adsService.createBanner(req.user.id, req.body);
    return successResponse(res, 201, 'Banner berhasil dibuat', data);
  } catch (err) {
    next(err);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const data = await adsService.updateBanner(req.user.id, req.params.id, req.body);
    return successResponse(res, 200, 'Banner berhasil diperbarui', data);
  } catch (err) {
    next(err);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    const result = await adsService.deleteBanner(req.user.id, req.params.id);
    return successResponse(res, 200, 'Banner berhasil dihapus', result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getHomeCarousel,
  recordView,
  recordClick,
  getSellerAds,
  createSellerAd,
  paySellerAd,
  pauseSellerAd,
  getAdminAds,
  moderateSellerAd,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
};
