const axios = require('axios');
const env = require('../config/env');

/**
 * Trigger pengiriman ke LogistiKita.
 * Mendukung dua mode:
 *   - LOGISTIKITA_URL set → langsung ke LogistiKita (mock atau real)
 *   - GATEWAY_BASE_URL set → lewat API Gateway
 */
const triggerShipping = async ({ orderId, fromAddress, toAddress, itemsCount }) => {
  const url = env.LOGISTIKITA_URL
    ? `${env.LOGISTIKITA_URL}/shipping`
    : `${env.GATEWAY_BASE_URL}/logistikita/shipping`;

  const apiKey = env.GATEWAY_API_KEY || 'mock-key';

  try {
    const response = await axios.post(
      url,
      {
        order_id: orderId,
        from_address: fromAddress ?? 'Gudang PasarKita',
        to_address: toAddress,
        items_count: itemsCount,
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
      const errData = error.response.data;
      throw {
        status: error.response.status,
        code: errData?.error?.code ?? 'LOGISTICS_ERROR',
        message: errData?.message ?? 'Pengiriman gagal dibuat',
        details: errData?.error?.details,
      };
    }
    // LogistiKita timeout tidak block order — order tetap paid
    console.error('[LogistiKita] Timeout atau tidak merespons:', error.message);
    throw { status: 502, code: 'GATEWAY_ERROR', message: 'LogistiKita tidak merespons (timeout)' };
  }
};

module.exports = { triggerShipping };
