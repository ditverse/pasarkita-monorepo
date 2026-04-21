const checkoutService = require('./checkout.service');
const { successResponse } = require('../../utils/response');

const processCheckout = async (req, res, next) => {
  try {
    const data = await checkoutService.processCheckout(req.user.id, req.body);
    return successResponse(res, 201, 'Checkout berhasil', data);
  } catch (err) {
    next(err);
  }
};

module.exports = { processCheckout };
