const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { verifyToken, requireSuperadmin } = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { updateUserStatusSchema } = require('./admin.schema');

router.use(verifyToken, requireSuperadmin);

router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/status', validate(updateUserStatusSchema), adminController.updateUserStatus);
router.get('/analytics', adminController.getAnalytics);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
