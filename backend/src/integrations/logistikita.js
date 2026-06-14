const axios = require('axios');
const env = require('../config/env');
const { writeIntegrationLog } = require('../utils/observability');
const { getIntegrationTarget } = require('./target');

/**
 * Trigger pengiriman ke LogistiKita.
 * Production/staging wajib melalui API Gateway.
 * LOGISTIKITA_URL hanya digunakan untuk mock development lokal.
 */
const triggerShipping = async ({ orderId, fromAddress, toAddress, itemsCount }) => {
  const target = getIntegrationTarget('logistikita', '/shipping');

  const apiKey = env.GATEWAY_API_KEY || 'mock-key';
  const startedAt = Date.now();

  try {
    const response = await axios.post(
      target.url,
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
    await writeIntegrationLog({
      service: target.logService,
      operation: 'shipping.create',
      success: true,
      durationMs: Date.now() - startedAt,
      orderId,
      statusCode: response.status,
    });
    return response.data;
  } catch (error) {
    await writeIntegrationLog({
      service: target.logService,
      operation: 'shipping.create',
      success: false,
      durationMs: Date.now() - startedAt,
      orderId,
      statusCode: error.response?.status ?? null,
      errorCode: error.response?.data?.error?.code ?? 'GATEWAY_ERROR',
    });
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
