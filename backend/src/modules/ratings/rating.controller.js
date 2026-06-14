const ratingService = require('./rating.service');
const { successResponse } = require('../../utils/response');

const uploadReviewImage = async (req, res, next) => {
  try {
    const data = await ratingService.uploadReviewImage(req.user.id, req.file);
    return successResponse(res, 200, 'Foto berhasil diunggah', data);
  } catch (err) {
    next(err);
  }
};

const submitRating = async (req, res, next) => {
  try {
    const data = await ratingService.submitRating(req.user.id, req.body);
    return successResponse(res, 201, 'Ulasan berhasil dikirim', data);
  } catch (err) {
    next(err);
  }
};

const getProductRatings = async (req, res, next) => {
  try {
    const data = await ratingService.getProductRatings(req.params.productId);
    return successResponse(res, 200, 'Rating produk', data);
  } catch (err) {
    next(err);
  }
};

const checkRated = async (req, res, next) => {
  try {
    const { orderId, productId } = req.params;
    const rated = await ratingService.checkRated(req.user.id, orderId, productId);
    return successResponse(res, 200, 'Status rating', { rated });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadReviewImage, submitRating, getProductRatings, checkRated };
