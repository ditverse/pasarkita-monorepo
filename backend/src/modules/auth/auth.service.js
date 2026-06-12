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

const updateProfile = async (userId, payload) => {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const { data: emailOwner, error: emailError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .neq('id', userId)
    .maybeSingle();

  if (emailError) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: emailError.message };
  }
  if (emailOwner) {
    throw { status: 409, code: 'EMAIL_ALREADY_USED', message: 'Email sudah digunakan akun lain' };
  }

  const { data, error } = await supabase
    .from('users')
    .update({ name: payload.name.trim(), email: normalizedEmail })
    .eq('id', userId)
    .select('id, name, email, role, is_active, created_at')
    .single();

  if (error || !data) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error?.message || 'Gagal memperbarui profil' };
  }
  return data;
};

const changePassword = async (userId, payload) => {
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single();

  if (findError || !user) {
    throw { status: 404, code: 'NOT_FOUND', message: 'User tidak ditemukan' };
  }

  const isCurrentPasswordValid = await bcrypt.compare(payload.current_password, user.password_hash);
  if (!isCurrentPasswordValid) {
    throw { status: 400, code: 'INVALID_CURRENT_PASSWORD', message: 'Password saat ini tidak sesuai' };
  }

  const password_hash = await bcrypt.hash(payload.new_password, 10);
  const { error } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', userId);

  if (error) {
    throw { status: 500, code: 'INTERNAL_ERROR', message: error.message };
  }
  return { changed: true };
};

module.exports = { register, login, getMe, updateProfile, changePassword };
