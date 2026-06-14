const checkoutService = require('./checkout.service');
const { successResponse } = require('../../utils/response');

const processCheckout = async (req, res, next) => {
  try {
    const data = await checkoutService.processCheckout(req.user.id, req.body);
    return successResponse(
      res,
      data.idempotent_replay ? 200 : 201,
      data.idempotent_replay ? 'Checkout sebelumnya ditemukan' : 'Checkout berhasil',
      data
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { processCheckout };
