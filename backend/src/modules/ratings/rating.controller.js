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

const replyToRating = async (req, res, next) => {
  try {
    const data = await ratingService.replyToRating(req.user.id, req.params.ratingId, req.body.reply);
    return successResponse(res, 200, 'Balasan berhasil dikirim', data);
  } catch (err) {
    next(err);
  }
};

const getSellerReviews = async (req, res, next) => {
  try {
    const { replied, rating, page, limit } = req.query;
    const options = {};
    if (replied !== undefined) options.replied = replied === 'true';
    if (rating) options.rating = Number(rating);
    if (page) options.page = Number(page);
    if (limit) options.limit = Number(limit);
    const data = await ratingService.getSellerReviews(req.user.id, options);
    return successResponse(res, 200, 'Ulasan produk toko', data);
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadReviewImage, submitRating, getProductRatings, checkRated, replyToRating, getSellerReviews };
