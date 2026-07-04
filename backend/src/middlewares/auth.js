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

const requireRole = (role, customMessage) => {
  return (req, res, next) => {
    if (req.user?.role !== role && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: customMessage || `Akses ditolak. Membutuhkan role: ${role}`,
        error: { code: 'FORBIDDEN' }
      });
    }
    next();
  };
};

const requireSuperadmin = requireRole('superadmin', 'Akses ditolak. Hanya superadmin yang dapat mengakses endpoint ini');
const requireSeller = requireRole('seller', 'Akses ditolak. Endpoint khusus penjual.');

module.exports = { verifyToken, requireAuth: verifyToken, requireSuperadmin, requireSeller, requireRole };

