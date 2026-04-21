const authService = require('./auth.service');
const { successResponse } = require('../../utils/response');

const register = async (req, res, next) => {
  try {
    const data = await authService.register(req.body);
    return successResponse(res, 201, 'Registrasi berhasil', data);
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    return successResponse(res, 200, 'Login berhasil', data);
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const data = await authService.getMe(req.user.id);
    return successResponse(res, 200, 'Berhasil', data);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };
