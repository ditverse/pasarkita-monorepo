const axios = require('axios');
const env = require('../config/env');

const triggerShipping = async ({ orderId, fromAddress, toAddress, itemsCount }) => {
  try {
    const response = await axios.post(
      `${env.GATEWAY_BASE_URL}/logistikita/shipping`,
      {
        order_id: orderId,
        from_address: fromAddress,
        to_address: toAddress,
        items_count: itemsCount
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
    console.error('LogistiKita integration error:', error.message);
    throw { status: 502, code: 'GATEWAY_ERROR', message: 'API Gateway timeout or unavailable' };
  }
};

module.exports = { triggerShipping };
