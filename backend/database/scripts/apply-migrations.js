const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Resolve path to the .env file in the backend directory
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const config = {
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  multipleStatements: true
};

if (!config.host || !config.user || !config.database) {
  console.error("Error: MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE must be set in the environment variables (.env).");
  process.exit(1);
}

async function run() {
  console.log(`Connecting to MySQL database: ${config.database} on ${config.host}:${config.port}...`);
  let connection;
  try {
    // Connect without database first to ensure it exists or can be created
    const connectionConfig = { ...config };
    delete connectionConfig.database;
    connection = await mysql.createConnection(connectionConfig);
    console.log("Connected to MySQL server successfully.");

    console.log(`Ensuring database "${config.database}" exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    await connection.query(`USE \`${config.database}\``);
    console.log(`Using database "${config.database}".`);

    const schemaDir = path.join(__dirname, '../schema');
    
    // 1. Run 000_mysql_full_schema.sql (Multiple Statements allowed)
    console.log("\n1. Applying main schema tables...");
    const schemaSql = fs.readFileSync(path.join(schemaDir, '000_mysql_full_schema.sql'), 'utf8');
    await connection.query(schemaSql);
    console.log("✅ Main schema tables applied successfully.");

    // Function to run SQL with delimiters
    async function runSqlWithDelimiters(filename) {
      const filePath = path.join(schemaDir, filename);
      let sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Remove lines containing DELIMITER
      const lines = sqlContent.split('\n');
      const filteredLines = lines.filter(line => !line.trim().toUpperCase().startsWith('DELIMITER'));
      const cleanedSql = filteredLines.join('\n');
      
      // Split by $$ which is the custom delimiter used in these files
      const statements = cleanedSql.split('$$');
      
      let count = 0;
      for (let statement of statements) {
        statement = statement.trim();
        if (statement) {
          await connection.query(statement);
          count++;
        }
      }
      return count;
    }

    // 2. Run 001_mysql_stored_procedures.sql
    console.log("\n2. Applying stored procedures...");
    const spCount = await runSqlWithDelimiters('001_mysql_stored_procedures.sql');
    console.log(`✅ Stored procedures applied successfully (${spCount} procedures/statements).`);

    // 3. Run 002_mysql_triggers.sql
    console.log("\n3. Applying triggers...");
    const triggerCount = await runSqlWithDelimiters('002_mysql_triggers.sql');
    console.log(`✅ Triggers applied successfully (${triggerCount} triggers/statements).`);

    console.log("\n🎉 All migrations completed successfully!");
  } catch (err) {
    console.error("\n❌ Migration runner failed:", err.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
