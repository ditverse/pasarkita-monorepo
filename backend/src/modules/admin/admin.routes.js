const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { verifyToken, requireSuperadmin } = require('../../middlewares/auth');

router.use(verifyToken, requireSuperadmin);

router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.get('/analytics', adminController.getAnalytics);

module.exports = router;
