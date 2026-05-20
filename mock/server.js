const express = require('express');
const cors = require('cors');
const smartbankRoutes = require('./smartbank/routes');
const logistiKitaRoutes = require('./logistikita/routes');

// Mock SmartBank — port 4001
const smartbank = express();
smartbank.use(cors());
smartbank.use(express.json());
smartbank.use('/smartbank', smartbankRoutes);
smartbank.listen(4001, () => {
  console.log('[Mock] SmartBank running on :4001');
  console.log('[Mock]   POST /smartbank/payment');
  console.log('[Mock]   GET  /smartbank/balance/:userId');
  console.log('[Mock]   POST /smartbank/debug/reset');
  console.log('[Mock]   POST /smartbank/debug/reset-all');
});

// Mock LogistiKita — port 4002
const logistikita = express();
logistikita.use(cors());
logistikita.use(express.json());
logistikita.use('/logistikita', logistiKitaRoutes);
logistikita.listen(4002, () => {
  console.log('[Mock] LogistiKita running on :4002');
  console.log('[Mock]   POST  /logistikita/shipping');
  console.log('[Mock]   PATCH /logistikita/shipping/:trackingId');
  console.log('[Mock]   GET   /logistikita/shipping/:trackingId');
  console.log('[Mock]   POST  /logistikita/debug/reset');
});
