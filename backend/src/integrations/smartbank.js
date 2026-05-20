const axios = require('axios');
const env = require('../config/env');

/**
 * Kirim payment request ke SmartBank.
 * Mendukung dua mode:
 *   - SMARTBANK_URL set → langsung ke SmartBank (mock atau real)
 *   - GATEWAY_BASE_URL set → lewat API Gateway
 */
const sendPaymentRequest = async ({ orderId, fromUser, amount, feeMarketplace, items }) => {
  const url = env.SMARTBANK_URL
    ? `${env.SMARTBANK_URL}/payment`
    : `${env.GATEWAY_BASE_URL}/smartbank/payment`;

  const apiKey = env.GATEWAY_API_KEY || 'mock-key';

  try {
    const response = await axios.post(
      url,
      {
        from_app: 'marketplace',
        from_user: fromUser,
        amount,
        fee_marketplace: feeMarketplace,
        metadata: { order_id: orderId, items },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      // Teruskan error dari SmartBank apa adanya
      const errData = error.response.data;
      throw {
        status: error.response.status,
        code: errData?.error?.code ?? 'PAYMENT_FAILED',
        message: errData?.message ?? 'Pembayaran gagal',
        details: errData?.error?.details,
        retry_after: errData?.error?.retry_after,
      };
    }
    throw { status: 502, code: 'GATEWAY_ERROR', message: 'SmartBank tidak merespons (timeout)' };
  }
};

module.exports = { sendPaymentRequest };
