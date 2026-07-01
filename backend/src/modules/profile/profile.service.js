const pool = require('../../config/mysql');

const getProfile = async (userId) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, phone, avatar_url, role, created_at FROM users WHERE id = ?',
    [userId]
  );
  if (!rows[0]) throw { status: 500, code: 'INTERNAL_ERROR', message: 'Gagal mengambil profil' };
  return rows[0];
};

const updateProfile = async (userId, payload) => {
  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(payload)) {
    if (['name', 'phone', 'avatar_url', 'email'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tidak ada field yang diperbarui' };
  values.push(userId);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

  const [rows] = await pool.query(
    'SELECT id, name, email, phone, avatar_url, role FROM users WHERE id = ?', [userId]
  );
  return rows[0];
};

const getAddresses = async (userId) => {
  const [rows] = await pool.query(
    'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_primary DESC, created_at DESC',
    [userId]
  );
  return rows;
};

const addAddress = async (userId, payload) => {
  if (payload.is_primary) {
    await pool.query('UPDATE user_addresses SET is_primary = 0 WHERE user_id = ?', [userId]);
  } else {
    const [countResult] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM user_addresses WHERE user_id = ?', [userId]
    );
    if (countResult[0].cnt === 0) payload.is_primary = true;
  }

  const addrId = require('crypto').randomUUID();
  await pool.query(
    `INSERT INTO user_addresses (id, user_id, label, recipient_name, phone, full_address, is_primary)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [addrId, userId, payload.label, payload.recipient_name, payload.phone, payload.full_address, payload.is_primary ? 1 : 0]
  );
  const [rows] = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [addrId]);
  return rows[0];
};

const updateAddress = async (userId, addressId, payload) => {
  if (payload.is_primary) {
    await pool.query('UPDATE user_addresses SET is_primary = 0 WHERE user_id = ?', [userId]);
  }

  const fields = [];
  const values = [];
  for (const [key, value] of Object.entries(payload)) {
    if (['label', 'recipient_name', 'phone', 'full_address', 'is_primary'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'is_primary' ? (value ? 1 : 0) : value);
    }
  }
  if (fields.length === 0) throw { status: 400, code: 'VALIDATION_ERROR', message: 'Tidak ada field yang diperbarui' };
  values.push(addressId, userId);
  await pool.query(`UPDATE user_addresses SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);

  const [rows] = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [addressId]);
  return rows[0];
};

const deleteAddress = async (userId, addressId) => {
  const [addrRows] = await pool.query(
    'SELECT is_primary FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]
  );
  const address = addrRows[0];

  await pool.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]);

  if (address?.is_primary) {
    const [latest] = await pool.query(
      'SELECT id FROM user_addresses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [userId]
    );
    if (latest[0]) {
      await pool.query('UPDATE user_addresses SET is_primary = 1 WHERE id = ?', [latest[0].id]);
    }
  }
  return true;
};

const setPrimaryAddress = async (userId, addressId) => {
  await pool.query('UPDATE user_addresses SET is_primary = 0 WHERE user_id = ?', [userId]);
  await pool.query(
    'UPDATE user_addresses SET is_primary = 1 WHERE id = ? AND user_id = ?', [addressId, userId]
  );
  const [rows] = await pool.query('SELECT * FROM user_addresses WHERE id = ?', [addressId]);
  return rows[0];
};

module.exports = {
  getProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setPrimaryAddress,
};
