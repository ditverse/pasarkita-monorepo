const sellerService = require('./seller.service');
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

module.exports = { getAnalytics, getProfile, updateProfile, uploadLogo, setVacation };
