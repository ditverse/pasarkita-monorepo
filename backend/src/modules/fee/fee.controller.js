const supabase = require('../../config/supabase');
const { calculateFee } = require('../../utils/fee');
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

    // Ambil harga produk dari DB
    const productIds = items.map((i) => i.product_id);
    const { data: products, error } = await supabase
      .from('products')
      .select('id, price, stock, is_active')
      .in('id', productIds);

    if (error) {
      throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
    }

    // Validasi semua produk ditemukan
    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product || !product.is_active) {
        return res.status(404).json({
          success: false,
          message: `Produk tidak ditemukan: ${item.product_id}`,
          error: { code: 'NOT_FOUND' },
        });
      }
    }

    const subtotal = items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + product.price * item.qty;
    }, 0);

    const result = calculateFee(subtotal);

    return successResponse(res, 200, 'Kalkulasi fee berhasil', result);
  } catch (err) {
    next(err);
  }
};

module.exports = { calculateFeeHandler };
