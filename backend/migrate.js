const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  console.log('========================================');
  console.log('MIGRASI DATABASE PASARKITA');
  console.log('========================================\n');

  // Koneksi ke MySQL
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
  });

  console.log('✅ Koneksi ke MySQL berhasil!');
  console.log(`   Database: ${process.env.MYSQL_DATABASE}`);
  console.log(`   Host: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}\n`);

  const schemaDir = path.join(__dirname, 'database', 'schema');
  const sqlFiles = [
    '000_mysql_full_schema.sql',
    '001_mysql_stored_procedures.sql',
    '002_mysql_triggers.sql',
  ];

  for (const sqlFile of sqlFiles) {
    const filePath = path.join(schemaDir, sqlFile);
    console.log(`📄 Menjalankan: ${sqlFile}...`);

    try {
      let sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Handle DELIMITER for stored procedures and triggers
      if (sqlFile.includes('stored_procedures') || sqlFile.includes('triggers')) {
        // Remove DELIMITER statements and split by $$
        sqlContent = sqlContent
          .replace(/DELIMITER\s+\$\$/gi, '')
          .replace(/DELIMITER\s+;/gi, '');
        
        // Split procedures/triggers by $$
        const statements = sqlContent
          .split('$$')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.match(/^--/));
        
        for (const stmt of statements) {
          if (stmt.trim().length > 0) {
            await connection.query(stmt);
          }
        }
      } else {
        await connection.query(sqlContent);
      }
      
      console.log(`   ✅ Berhasil!\n`);
    } catch (error) {
      console.error(`   ❌ Error pada ${sqlFile}:`);
      console.error(`   ${error.message}\n`);
      throw error;
    }
  }

  console.log('========================================');
  console.log('✅ MIGRASI SELESAI!');
  console.log('========================================\n');
  console.log('Langkah selanjutnya:');
  console.log('  npm run seed:demo');
  console.log('');

  await connection.end();
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ MIGRASI GAGAL:', error.message);
    process.exit(1);
  });
