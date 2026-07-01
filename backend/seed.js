const bcrypt = require('bcrypt');
const pool = require('./src/config/mysql');

async function seed() {
  try {
    console.log('Menjalankan database seeder...');

    // 1. Membersihkan data lama (test users & products)
    console.log('Membersihkan test mock data...');
    await pool.query('DELETE FROM products WHERE seller_id IN (SELECT id FROM users WHERE email IN (?, ?, ?))', [
      'admin@pasarkita.com',
      'seller@pasarkita.com',
      'buyer@pasarkita.com',
    ]);
    await pool.query('DELETE FROM users WHERE email IN (?, ?, ?)', [
      'admin@pasarkita.com',
      'seller@pasarkita.com',
      'buyer@pasarkita.com',
    ]);

    // 2. Hash passwords
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    // 3. Insert Users
    console.log('Seeding mock users...');
    const mockUsers = [
      { name: 'Super Admin', email: 'admin@pasarkita.com', role: 'superadmin', is_active: 1, password_hash: passwordHash },
      { name: 'Toko Sejahtera', email: 'seller@pasarkita.com', role: 'seller', is_active: 1, password_hash: passwordHash },
      { name: 'Budi Pembeli', email: 'buyer@pasarkita.com', role: 'buyer', is_active: 1, password_hash: passwordHash },
    ];

    const userIds = {};
    for (const u of mockUsers) {
      await pool.query(
        'INSERT INTO users (id, name, email, role, is_active, password_hash) VALUES (UUID(), ?, ?, ?, ?, ?)',
        [u.name, u.email, u.role, u.is_active, u.password_hash]
      );
      const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [u.email]);
      userIds[u.email] = rows[0].id;
    }

    const sellerId = userIds['seller@pasarkita.com'];

    // 3b. Create seller profile
    await pool.query(
      'INSERT INTO seller_profiles (seller_id, store_name, verification_status) VALUES (?, ?, ?)',
      [sellerId, 'Toko Sejahtera', 'demo_verified']
    );

    // 4. Insert Products
    console.log('Seeding mock products...');
    const mockProducts = [
      { name: 'Baju Koko Muslim Pria', category: 'fashion', description: 'Baju Koko terbaru dengan bahan adem.', price: 150000, stock: 25 },
      { name: 'Laptop Gaming Super', category: 'elektronik', description: 'Laptop dengan performa dewa.', price: 15000000, stock: 5 },
      { name: 'Sepatu Running Sporty', category: 'fashion', description: 'Sepatu lari yang nyaman dipakai jarak jauh.', price: 450000, stock: 10 },
      { name: 'Snack Keripik Kentang', category: 'makanan', description: 'Keripik gurih renyah tanpa pengawet tambahan.', price: 15000, stock: 100 },
    ];

    for (const p of mockProducts) {
      await pool.query(
        'INSERT INTO products (id, seller_id, name, category, description, price, stock, is_active) VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1)',
        [sellerId, p.name, p.category, p.description, p.price, p.stock]
      );
    }

    console.log('✅ Seeder berhasil!');
    console.log('Coba login dengan akun:');
    console.log('  Admin : admin@pasarkita.com | pass: password123');
    console.log('  Seller: seller@pasarkita.com | pass: password123');
    console.log('  Buyer : buyer@pasarkita.com  | pass: password123');
  } catch (err) {
    console.error('❌ Seeder Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
