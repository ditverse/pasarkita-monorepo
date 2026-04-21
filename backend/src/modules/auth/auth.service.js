const supabase = require('../../config/supabase');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');

const register = async (payload) => {
  const { name, email, password, role } = payload;

  // Cek email ganda
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw { status: 400, code: 'VALIDATION_ERROR', message: 'Email sudah terdaftar' };
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // Insert ke db
  const { data: newUser, error } = await supabase
    .from('users')
    .insert([
      { name, email, password_hash, role, is_active: true }
    ])
    .select('id, name, email, role, is_active, created_at')
    .single();

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }

  return newUser;
};

const login = async (payload) => {
  const { email, password } = payload;

  // Cek email
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Email atau password salah' };
  }

  // Cek active
  if (!user.is_active) {
    throw { status: 403, code: 'FORBIDDEN', message: 'Akun telah dinonaktifkan' };
  }

  // Cek password
  const isValidPass = await bcrypt.compare(password, user.password_hash);
  if (!isValidPass) {
    throw { status: 401, code: 'UNAUTHORIZED', message: 'Email atau password salah' };
  }

  // Generate Token
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
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, role, is_active, created_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  }

  return user;
};

module.exports = { register, login, getMe };
