const express = require('express');
const router = express.Router();
const axios = require('axios');
const env = require('../../config/env');
const { getIntegrationTarget } = require('../../integrations/target');
const { verifyToken } = require('../../middlewares/auth');
const { successResponse } = require('../../utils/response');

/**
 * GET /api/smartbank/balance
 * Ambil saldo SmartBank untuk user yang sedang login
 */
router.get('/balance', verifyToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const target = getIntegrationTarget('smartbank', `/balance/${userId}`);

    const response = await axios.get(target.url, {
      headers: { Authorization: `Bearer ${env.GATEWAY_API_KEY || 'mock-key'}` },
      timeout: 5000,
    });

    return successResponse(res, 200, 'Saldo SmartBank', response.data?.data ?? { balance: 0 });
  } catch (err) {
    // Jika SmartBank tidak tersedia, return 0 agar tidak block UI
    console.error('[SmartBank] Gagal ambil saldo:', err.message);
    return successResponse(res, 200, 'Saldo SmartBank tidak tersedia', { balance: 0 });
  }
});

module.exports = router;
