const notificationService = require('./notification.service');
const { successResponse } = require('../../utils/response');

const getNotifications = async (req, res, next) => {
  try {
    const data = await notificationService.getNotifications(req.user.id, req.query);
    return successResponse(res, 200, 'Daftar notifikasi', data);
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const data = await notificationService.markRead(req.user.id, req.params.id);
    return successResponse(res, 200, 'Notifikasi ditandai dibaca', data);
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const data = await notificationService.markAllRead(req.user.id);
    return successResponse(res, 200, 'Semua notifikasi ditandai dibaca', data);
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markRead, markAllRead };
