const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE config. Make sure .env is setup properly.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  try {
    console.log("Menjalankan database seeder...");

    // 1. Membersihkan data lama (Hanya membersihkan test users)
    console.log("Membersihkan test mock data...");
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all products safely
    await supabase.from('users').delete().in('email', ['admin@pasarkita.com', 'seller@pasarkita.com', 'buyer@pasarkita.com']);

    // 2. Hash passwords
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("password123", salt);

    // 3. Insert Users
    console.log("Seeding mock users...");
    const mockUsers = [
      { name: "Super Admin", email: "admin@pasarkita.com", role: "superadmin", is_active: true, password_hash: passwordHash },
      { name: "Toko Sejahtera", email: "seller@pasarkita.com", role: "seller", is_active: true, password_hash: passwordHash },
      { name: "Budi Pembeli", email: "buyer@pasarkita.com", role: "buyer", is_active: true, password_hash: passwordHash }
    ];

    const { data: users, error: userErr } = await supabase
      .from('users')
      .insert(mockUsers)
      .select();

    if (userErr) throw new Error("Gagal seeding users: " + userErr.message);

    const sellerId = users.find(u => u.role === 'seller').id;

    // 4. Insert Products
    console.log("Seeding mock products...");
    const mockProducts = [
      { seller_id: sellerId, name: "Baju Koko Muslim Pria", category: "fashion", description: "Baju Koko terbaru dengan bahan adem.", price: 150000, stock: 25, is_active: true },
      { seller_id: sellerId, name: "Laptop Gaming Super", category: "elektronik", description: "Laptop dengan performa dewa.", price: 15000000, stock: 5, is_active: true },
      { seller_id: sellerId, name: "Sepatu Running Sporty", category: "fashion", description: "Sepatu lari yang nyaman dipakai jarak jauh.", price: 450000, stock: 10, is_active: true },
      { seller_id: sellerId, name: "Snack Keripik Kentang", category: "makanan", description: "Keripik gurih renyah tanpa pengawet tambahan.", price: 15000, stock: 100, is_active: true },
    ];

    const { error: prodErr } = await supabase
      .from('products')
      .insert(mockProducts);

    if (prodErr) {
      if (prodErr.message.includes('relation "products" does not exist')) {
        console.warn("⚠️ Tabel products sepertinya belum terbuat di Supabase Anda.");
      }
      throw new Error("Gagal seeding produk: " + prodErr.message);
    }

    console.log("✅ Sedding berhasil!");
    console.log("Coba login dengan akun: ");
    console.log("  Seller: seller@pasarkita.com | pass: password123");
    console.log("  Buyer : buyer@pasarkita.com  | pass: password123");

  } catch (err) {
    console.error("❌ Seeder Error:", err.message);
  }
}

seed();
