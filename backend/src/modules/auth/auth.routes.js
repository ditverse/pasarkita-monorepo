const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate');
const {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require('./auth.schema');
const { verifyToken } = require('../../middlewares/auth');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', verifyToken, authController.getMe);
router.patch('/me', verifyToken, validate(updateProfileSchema), authController.updateProfile);
router.patch('/password', verifyToken, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
