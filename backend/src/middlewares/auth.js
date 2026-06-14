const jwt = require('jsonwebtoken');
const env = require('../config/env');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Token tidak ditemukan', error: { code: 'UNAUTHORIZED' } });

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau sudah expired', error: { code: 'UNAUTHORIZED' } });
  }
};

const requireSuperadmin = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya superadmin yang dapat mengakses endpoint ini',
      error: { code: 'FORBIDDEN' }
    });
  }
  next();
};

const requireSeller = (req, res, next) => {
  if (req.user?.role !== 'seller' && req.user?.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Endpoint khusus penjual.',
      error: { code: 'FORBIDDEN' }
    });
  }
  next();
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (req.user?.role !== role && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Membutuhkan role: ${role}`,
        error: { code: 'FORBIDDEN' }
      });
    }
    next();
  };
};

module.exports = { verifyToken, requireAuth: verifyToken, requireSuperadmin, requireSeller, requireRole };
