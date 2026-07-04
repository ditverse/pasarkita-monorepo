const userRepository = require('../../repositories/user.repository');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const { AppError } = require('../../utils/app-error');

const register = async (payload) => {
  const { name, email, password, role } = payload;

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Email sudah terdaftar');
  }

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const newUser = await userRepository.create(name, email, password_hash, role);
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    is_active: newUser.is_active,
    created_at: newUser.created_at
  };
};

const login = async (payload) => {
  const { email, password } = payload;

  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Email atau password salah');
  }

  if (!user.is_active) {
    throw new AppError(403, 'FORBIDDEN', 'Akun telah dinonaktifkan');
  }

  const isValidPass = await bcrypt.compare(password, user.password_hash);
  if (!isValidPass) {
    throw new AppError(401, 'UNAUTHORIZED', 'Email atau password salah');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
};

const getMe = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User tidak ditemukan');
  }
  return user;
};

const updateProfile = async (userId, payload) => {
  const normalizedEmail = payload.email.trim().toLowerCase();

  const isEmailUsed = await userRepository.existsOtherWithEmail(normalizedEmail, userId);
  if (isEmailUsed) {
    throw new AppError(409, 'EMAIL_ALREADY_USED', 'Email sudah digunakan akun lain');
  }

  return userRepository.updateProfile(userId, payload.name.trim(), normalizedEmail);
};

const changePassword = async (userId, payload) => {
  const user = await userRepository.findByEmail((await userRepository.findById(userId)).email);
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User tidak ditemukan');
  }

  const isCurrentPasswordValid = await bcrypt.compare(payload.current_password, user.password_hash);
  if (!isCurrentPasswordValid) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Password saat ini tidak sesuai');
  }

  const password_hash = await bcrypt.hash(payload.new_password, 10);
  await userRepository.updatePassword(userId, password_hash);
  return { changed: true };
};

module.exports = { register, login, getMe, updateProfile, changePassword };
