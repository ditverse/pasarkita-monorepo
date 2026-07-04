const pool = require('../config/mysql');

const findByEmail = async (email) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
};

const findById = async (id) => {
  const [rows] = await pool.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [id]);
  return rows[0] || null;
};

const existsOtherWithEmail = async (email, excludeId) => {
  const [rows] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, excludeId]);
  return rows.length > 0;
};

const create = async (name, email, passwordHash, role) => {
  const [result] = await pool.query(
    'INSERT INTO users (id, name, email, password_hash, role, is_active) VALUES (UUID(), ?, ?, ?, ?, 1)',
    [name, email, passwordHash, role]
  );
  
  // Since MySQL INSERT doesn't return the UUID directly if insertId is 0 (due to UUID() primary key),
  // we fetch the user by email to get the newly created record.
  return findByEmail(email);
};

const updateProfile = async (id, name, email) => {
  await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, id]);
  return findById(id);
};

const updatePassword = async (id, passwordHash) => {
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
};

const updateStatus = async (id, isActive) => {
  await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
};

module.exports = {
  findByEmail,
  findById,
  existsOtherWithEmail,
  create,
  updateProfile,
  updatePassword,
  updateStatus,
};
