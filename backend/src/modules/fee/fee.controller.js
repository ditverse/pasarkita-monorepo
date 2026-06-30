const { quotePromotions } = require('../promotions/promotion.service');
const { successResponse } = require('../../utils/response');

/**
 * POST /api/fee/calculate
 * Body: { items: [{ product_id, qty }] }
 */
const calculateFeeHandler = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items tidak boleh kosong',
        error: { code: 'VALIDATION_ERROR' },
      });
    }

    const quote = await quotePromotions({ items });
    const result = {
      subtotal: quote.subtotal_after_product_discount,
      fee_marketplace: quote.fee_marketplace,
      fee_percentage: 2,
      total: quote.total,
      subtotal_original: quote.subtotal_original,
      product_discount_total: quote.product_discount_total,
      fee_marketplace_base: quote.fee_marketplace_base,
      fee_discount: quote.fee_discount,
      voucher_discount_total: quote.voucher_discount_total,
      discount_total: quote.discount_total,
      items: quote.items,
    };

    return successResponse(res, 200, 'Kalkulasi fee berhasil', result);
  } catch (err) {
    next(err);
  }
};

module.exports = { calculateFeeHandler };
