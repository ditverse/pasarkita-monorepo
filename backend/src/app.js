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
const notificationRoutes = require('./modules/notifications/notification.routes');
const sellerRoutes = require('./modules/seller/seller.routes');
const profileRoutes = require('./modules/profile/profile.routes');
const complaintRoutes = require('./modules/complaints/complaint.routes');
const chatRoutes = require('./modules/chats/chat.routes');
const promotionRoutes = require('./modules/promotions/promotion.routes');
const adsRoutes = require('./modules/ads/ads.routes');

const app = express();


app.use(cors());
app.use(express.json());

// Healthcheck
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Backend API is running fine' });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/products', productRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fee', feeRoutes);
app.use('/api/smartbank', smartbankRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/ads', adsRoutes);

// Dev-only: list users untuk mock dashboard (hanya aktif di NODE_ENV=development)
if (process.env.NODE_ENV === 'development') {
  const supabase = require('./config/supabase');
  app.get('/api/dev/users', async (req, res) => {
    const secret = process.env.MOCK_DEV_SECRET || 'mock-dev-secret';
    if ((req.headers['x-mock-secret'] || req.query.secret) !== secret) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ success: false, message: error.message });
    return res.json({ success: true, data: data || [] });
  });
}

app.use((req, res, next) => {

  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

app.use(errorHandler);

module.exports = app;
