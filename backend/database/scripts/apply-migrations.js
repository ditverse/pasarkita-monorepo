const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Resolve path to the .env file in the backend directory
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL is not set in the environment variables.");
  process.exit(1);
}

async function run() {
  const isSupabase = dbUrl.includes('supabase.com') || dbUrl.includes('supabase.co');
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: isSupabase ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database successfully.");

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files in directory.`);

    for (const file of files) {
      console.log(`Running migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Use a single client query call to execute the migration transaction
      await client.query(sql);
      console.log(`Successfully completed migration: ${file}`);
    }

    console.log("All migrations executed successfully.");
  } catch (err) {
    console.error("Migration runner failed:", err.message);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore client closure error if connection failed
    }
  }
}

run();
