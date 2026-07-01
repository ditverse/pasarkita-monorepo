const pool = require('../../config/mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

const register = async (payload) => {
  const { name, email, password, role } = payload;

  const [existing] = await pool.query(
    'SELECT id FROM users WHERE email = ?', [email]
  );
  if (existing.length > 0) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Email sudah terdaftar' };
  }

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const [result] = await pool.query(
    'INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (UUID(), ?, ?, ?, ?, 1)',
    [name, email, password_hash, role]
  );

  const [rows] = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
    [result.insertId]
  );
  return rows[0];
};

const login = async (payload) => {
  const { email, password } = payload;

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];

  if (!user) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Email atau password salah' };
  }

  if (!user.is_active) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akun telah dinonaktifkan' };
  }

  const isValidPass = await bcrypt.compare(password, user.password_hash);
  if (!isValidPass) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Email atau password salah' };
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
  const [rows] = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
    [userId]
  );
  const user = rows[0];
  if (!user) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  }
  return user;
};

const updateProfile = async (userId, payload) => {
  const normalizedEmail = payload.email.trim().toLowerCase();

  const [emailOwner] = await pool.query(
    'SELECT id FROM users WHERE email = ? AND id != ?',
    [normalizedEmail, userId]
  );
  if (emailOwner.length > 0) {
    throw { status: 409, code: 'EMAIL_ALREADY_USED', message: 'Email sudah digunakan akun lain' };
  }

  await pool.query(
    'UPDATE users SET name = ?, email = ? WHERE id = ?',
    [payload.name.trim(), normalizedEmail, userId]
  );

  const [rows] = await pool.query(
    'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?',
    [userId]
  );
  return rows[0];
};

const changePassword = async (userId, payload) => {
  const [rows] = await pool.query(
    'SELECT password_hash FROM users WHERE id = ?', [userId]
  );
  const user = rows[0];

  if (!user) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  }

  const isCurrentPasswordValid = await bcrypt.compare(payload.current_password, user.password_hash);
  if (!isCurrentPasswordValid) {
    throw { status: 400, code: 'INVALID_CURRENT_PASSWORD', message: 'Password saat ini tidak sesuai' };
  }

  const password_hash = await bcrypt.hash(payload.new_password, 10);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, userId]);
  return { changed: true };
};

module.exports = { register, login, getMe, updateProfile, changePassword };
