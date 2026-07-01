const bcrypt = require('bcrypt');
const pool = require('./src/config/mysql');

const DEMO_PASSWORD = 'password123';

const sellers = [
  { name: 'Nusantara Rasa', email: 'seller.rasa@pasarkita.demo' },
  { name: 'Kriya Lokal', email: 'seller.kriya@pasarkita.demo' },
  { name: 'Gaya UMKM', email: 'seller.gaya@pasarkita.demo' },
  { name: 'Rumah Cerdas', email: 'seller.cerdas@pasarkita.demo' },
];

const buyers = [
  { name: 'Alya Putri', email: 'alya.putri@pasarkita.demo' },
  { name: 'Bagas Pratama', email: 'bagas.pratama@pasarkita.demo' },
  { name: 'Citra Lestari', email: 'citra.lestari@pasarkita.demo' },
  { name: 'Dimas Saputra', email: 'dimas.saputra@pasarkita.demo' },
  { name: 'Farah Ramadhani', email: 'farah.ramadhani@pasarkita.demo' },
  { name: 'Galih Nugroho', email: 'galih.nugroho@pasarkita.demo' },
  { name: 'Intan Maharani', email: 'intan.maharani@pasarkita.demo' },
  { name: 'Yoga Kurniawan', email: 'yoga.kurniawan@pasarkita.demo' },
];

const products = [
  ['Nusantara Rasa', 'Kopi Arabika Gayo 250g', 'Makanan', 'Kopi arabika single origin dengan aroma cokelat dan citrus.', 78000, 42],
  ['Nusantara Rasa', 'Keripik Tempe Daun Jeruk', 'Makanan', 'Keripik tempe renyah dengan daun jeruk dan bumbu gurih.', 24000, 85],
  ['Nusantara Rasa', 'Sambal Roa Asap 150ml', 'Makanan', 'Sambal ikan roa asap khas Manado dengan tingkat pedas sedang.', 39000, 31],
  ['Nusantara Rasa', 'Madu Hutan Sumbawa 350ml', 'Makanan', 'Madu hutan alami dari peternak lokal Sumbawa.', 92000, 18],
  ['Nusantara Rasa', 'Teh Melati Premium 20 Sachet', 'Makanan', 'Teh wangi melati dalam kemasan praktis untuk seduhan harian.', 32000, 64],
  ['Nusantara Rasa', 'Rendang Suwir Siap Saji', 'Makanan', 'Rendang daging suwir tahan simpan untuk lauk praktis.', 67000, 22],
  ['Nusantara Rasa', 'Granola Pisang dan Kelapa', 'Makanan', 'Granola panggang dengan pisang, kelapa, dan gula aren.', 49000, 37],
  ['Nusantara Rasa', 'Sirup Markisa Makassar', 'Makanan', 'Sirup markisa pekat tanpa pewarna buatan.', 45000, 29],

  ['Kriya Lokal', 'Tas Anyaman Pandan Mini', 'Kerajinan', 'Tas tangan anyaman pandan dengan lapisan kain dan resleting.', 165000, 14],
  ['Kriya Lokal', 'Keranjang Rotan Serbaguna', 'Rumah', 'Keranjang rotan untuk penyimpanan ruang keluarga atau kamar.', 138000, 11],
  ['Kriya Lokal', 'Gelas Keramik Speckle', 'Rumah', 'Gelas keramik buatan tangan dengan glasir speckle.', 59000, 28],
  ['Kriya Lokal', 'Vas Tanah Liat Minimalis', 'Rumah', 'Vas dekorasi tanah liat dengan bentuk organik.', 87000, 16],
  ['Kriya Lokal', 'Notebook Sampul Batik A5', 'Buku', 'Notebook kertas premium dengan sampul kain batik.', 42000, 48],
  ['Kriya Lokal', 'Pouch Tenun Lombok', 'Kerajinan', 'Pouch tenun dengan resleting dan lapisan katun.', 76000, 25],
  ['Kriya Lokal', 'Hiasan Dinding Macrame', 'Kerajinan', 'Macrame katun buatan tangan untuk dekorasi rumah.', 119000, 9],
  ['Kriya Lokal', 'Set Tatakan Gelas Kayu', 'Rumah', 'Enam tatakan gelas kayu dengan finishing food grade.', 68000, 33],

  ['Gaya UMKM', 'Kemeja Batik Modern Pria', 'Fashion', 'Kemeja batik potongan modern dengan bahan katun adem.', 219000, 24],
  ['Gaya UMKM', 'Outer Tenun Wanita', 'Fashion', 'Outer ringan dengan aksen kain tenun lokal.', 245000, 17],
  ['Gaya UMKM', 'Kaos Katun Organik', 'Fashion', 'Kaos unisex katun organik dengan warna natural.', 125000, 51],
  ['Gaya UMKM', 'Sandal Kulit Handmade', 'Fashion', 'Sandal kulit buatan tangan dengan sol antiselip.', 189000, 20],
  ['Gaya UMKM', 'Tote Bag Kanvas Lokal', 'Fashion', 'Tote bag kanvas tebal dengan kantong dalam.', 89000, 44],
  ['Gaya UMKM', 'Hijab Voal Motif Flora', 'Fashion', 'Hijab voal ringan dengan motif flora eksklusif.', 74000, 63],
  ['Gaya UMKM', 'Dompet Kulit Slim', 'Fashion', 'Dompet kulit sapi model tipis dengan enam slot kartu.', 149000, 13],
  ['Gaya UMKM', 'Topi Bucket Batik', 'Fashion', 'Topi bucket reversible dengan kombinasi batik dan kanvas.', 97000, 27],

  ['Rumah Cerdas', 'Lampu Meja Bambu USB', 'Elektronik', 'Lampu meja bambu dengan tiga tingkat kecerahan.', 185000, 15],
  ['Rumah Cerdas', 'Speaker Bluetooth Kayu', 'Elektronik', 'Speaker portabel dengan casing kayu dan baterai isi ulang.', 275000, 8],
  ['Rumah Cerdas', 'Stand Laptop Kayu Lipat', 'Elektronik', 'Stand laptop ergonomis dari kayu solid dan mudah dibawa.', 159000, 19],
  ['Rumah Cerdas', 'Diffuser Aromaterapi Mini', 'Kecantikan', 'Diffuser USB berukuran ringkas untuk meja kerja.', 99000, 34],
  ['Rumah Cerdas', 'Sabun Kopi Eksfoliasi', 'Kecantikan', 'Sabun batang dengan bubuk kopi dan minyak kelapa.', 35000, 56],
  ['Rumah Cerdas', 'Body Butter Kakao 100g', 'Kecantikan', 'Pelembap tubuh berbahan cocoa butter dan shea butter.', 69000, 26],
  ['Rumah Cerdas', 'Resistance Band Set', 'Olahraga', 'Set lima resistance band untuk latihan di rumah.', 115000, 38],
  ['Rumah Cerdas', 'Matras Yoga Natural Rubber', 'Olahraga', 'Matras yoga antiselip dengan ketebalan 5 mm.', 295000, 12],
];

async function ensureDemoUser(user, role, passwordHash) {
  const [existing] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [user.email]);
  if (existing.length > 0) return existing[0];

  await pool.query(
    'INSERT INTO users (id, name, email, role, is_active, password_hash) VALUES (UUID(), ?, ?, ?, 1, ?)',
    [user.name, user.email, role, passwordHash]
  );
  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [user.email]);
  return rows[0];
}

async function seedDemoCatalog() {
  console.log('Menambahkan katalog demo PasarKita secara non-destruktif...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const sellerRows = [];
  const buyerRows = [];

  for (const seller of sellers) {
    const row = await ensureDemoUser(seller, 'seller', passwordHash);
    sellerRows.push(row);
    // Upsert seller_profile for each demo seller
    const [existingProfile] = await pool.query('SELECT seller_id FROM seller_profiles WHERE seller_id = ?', [row.id]);
    if (existingProfile.length === 0) {
      await pool.query(
        'INSERT INTO seller_profiles (seller_id, store_name, verification_status) VALUES (?, ?, ?)',
        [row.id, seller.name, 'demo_verified']
      );
    }
  }
  for (const buyer of buyers) {
    buyerRows.push(await ensureDemoUser(buyer, 'buyer', passwordHash));
  }

  const sellerByName = new Map(sellerRows.map((s) => [s.name, s.id]));
  const productNames = products.map((p) => p[1]);
  const [existingProducts] = await pool.query(
    `SELECT name FROM products WHERE name IN (${productNames.map(() => '?').join(',')})`,
    productNames
  );
  const existingNames = new Set(existingProducts.map((p) => p.name));

  const newProducts = products
    .filter((p) => !existingNames.has(p[1]))
    .map(([sellerName, name, category, description, price, stock]) => [
      sellerByName.get(sellerName),
      name,
      category,
      description,
      price,
      stock,
      stock > 0 ? 1 : 0,
    ]);

  for (const p of newProducts) {
    await pool.query(
      'INSERT INTO products (id, seller_id, name, category, description, price, stock, is_active) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)',
      p
    );
  }

  console.log(`Seller demo tersedia: ${sellerRows.length}`);
  console.log(`Pembeli demo tersedia: ${buyerRows.length}`);
  console.log(`Produk baru ditambahkan: ${newProducts.length}`);
  console.log(`Produk yang sudah ada dan dilewati: ${products.length - newProducts.length}`);
  console.log(`Login akun demo menggunakan password: ${DEMO_PASSWORD}`);
}

seedDemoCatalog()
  .then(() => pool.end())
  .catch((error) => {
    console.error('Seed demo gagal:', error.message);
    process.exitCode = 1;
  });
