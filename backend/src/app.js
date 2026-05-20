require('dotenv').config();
const express = require('express');
const cors = require('cors');

const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./modules/auth/auth.routes');
const productRoutes = require('./modules/products/product.routes');
const checkoutRoutes = require('./modules/checkout/checkout.routes');
const orderRoutes = require('./modules/orders/order.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const feeRoutes = require('./modules/fee/fee.routes');
const smartbankRoutes = require('./modules/smartbank/smartbank.routes');
const ratingRoutes = require('./modules/ratings/rating.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend API is running fine' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fee', feeRoutes);
app.use('/api/smartbank', smartbankRoutes);
app.use('/api/ratings', ratingRoutes);

app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use(errorHandler);

module.exports = app;
