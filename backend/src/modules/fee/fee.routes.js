const express = require('express');
const router = express.Router();
const { calculateFeeHandler } = require('./fee.controller');

// POST /api/fee/calculate — public, tidak perlu auth
router.post('/calculate', calculateFeeHandler);

module.exports = router;
