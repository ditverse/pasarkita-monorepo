const axios = require('axios');
const env = require('../config/env');
const { writeIntegrationLog } = require('../utils/observability');
const { getIntegrationTarget } = require('./target');

/**
 * Kirim payment request ke SmartBank.
 * Production/staging wajib melalui API Gateway.
 * SMARTBANK_URL hanya digunakan untuk mock development lokal.
 */
const sendPaymentRequest = async ({ orderId, fromUser, amount, feeMarketplace, items }) => {
  const target = getIntegrationTarget('smartbank', '/payment');

  const apiKey = env.GATEWAY_API_KEY || 'mock-key';
  const startedAt = Date.now();

  try {
    const response = await axios.post(
      target.url,
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
          'Idempotency-Key': orderId,
        },
        timeout: 8000,
      }
    );
    await writeIntegrationLog({
      service: target.logService,
      operation: 'payment.create',
      success: true,
      durationMs: Date.now() - startedAt,
      orderId,
      statusCode: response.status,
    });
    return response.data;
  } catch (error) {
    await writeIntegrationLog({
      service: target.logService,
      operation: 'payment.create',
      success: false,
      durationMs: Date.now() - startedAt,
      orderId,
      statusCode: error.response?.status ?? null,
      errorCode: error.response?.data?.error?.code ?? 'GATEWAY_ERROR',
    });
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
