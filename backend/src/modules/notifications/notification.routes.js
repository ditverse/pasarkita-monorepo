const express = require('express');
const notificationController = require('./notification.controller');
const { verifyToken } = require('../../middlewares/auth');

const router = express.Router();

router.use(verifyToken);
router.get('/', notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationController.markRead);

module.exports = router;
