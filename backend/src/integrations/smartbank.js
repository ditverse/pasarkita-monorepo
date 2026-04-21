const axios = require('axios');
const env = require('../config/env');

const sendPaymentRequest = async ({ orderId, fromUser, toUser, amount, feeMarketplace, items }) => {
  try {
    const response = await axios.post(
      `${env.GATEWAY_BASE_URL}/smartbank/payment`,
      {
        from_app: 'marketplace',
        from_user: fromUser,
        to_user: toUser,
        amount,
        fee_marketplace: feeMarketplace,
        metadata: { order_id: orderId, items }
      },
      {
        headers: {
          Authorization: `Bearer ${env.GATEWAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );
    return response.data;
  } catch (error) {
    if (error.response) {
      throw { status: error.response.status, code: 'PAYMENT_FAILED', details: error.response.data };
    }
    throw { status: 502, code: 'GATEWAY_ERROR', message: 'API Gateway timeout or unavailable' };
  }
};

module.exports = { sendPaymentRequest };
