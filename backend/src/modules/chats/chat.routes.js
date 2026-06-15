const express = require('express');
const { verifyToken } = require('../../middlewares/auth');
const {
  getOrderMessages,
  sendOrderMessage,
  getProductThreads,
  startProductChat,
  getProductThreadMessages,
  sendProductMessage,
} = require('./chat.controller');

const router = express.Router();

// Order-based chat
router.get('/orders/:orderId/messages', verifyToken, getOrderMessages);
router.post('/orders/:orderId/messages', verifyToken, sendOrderMessage);

// Product/listing chat
router.get('/products/threads', verifyToken, getProductThreads);
router.post('/products/:productId/start', verifyToken, startProductChat);
router.get('/products/threads/:threadId/messages', verifyToken, getProductThreadMessages);
router.post('/products/threads/:threadId/messages', verifyToken, sendProductMessage);

module.exports = router;

