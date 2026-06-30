const promotionService = require('./promotion.service');
const { successResponse } = require('../../utils/response');

const quote = async (req, res, next) => {
  try {
    const data = await promotionService.quotePromotions(req.body);
    return successResponse(res, 200, 'Quote promo berhasil', data);
  } catch (err) {
    next(err);
  }
};

const getAvailableVouchers = async (req, res, next) => {
  try {
    const data = await promotionService.getAvailableVouchers(req.user?.id);
    return successResponse(res, 200, 'Voucher tersedia', data);
  } catch (err) {
    next(err);
  }
};

module.exports = { quote, getAvailableVouchers };
