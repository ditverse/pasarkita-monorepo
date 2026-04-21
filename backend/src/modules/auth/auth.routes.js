const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const validate = require('../../middlewares/validate');
const { registerSchema, loginSchema } = require('./auth.schema');
const { verifyToken } = require('../../middlewares/auth');

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', verifyToken, authController.getMe);

module.exports = router;
