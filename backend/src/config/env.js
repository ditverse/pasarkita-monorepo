const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  // MySQL
  MYSQL_HOST: z.string().min(1, 'MYSQL_HOST is required'),
  MYSQL_PORT: z.string().transform(Number).default('3306'),
  MYSQL_USER: z.string().min(1, 'MYSQL_USER is required'),
  MYSQL_PASSWORD: z.string().min(1, 'MYSQL_PASSWORD is required'),
  MYSQL_DATABASE: z.string().min(1, 'MYSQL_DATABASE is required'),

  // JWT
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),

  // Integrations
  GATEWAY_BASE_URL: z.string().optional(),
  GATEWAY_API_KEY: z.string().optional(),
  SMARTBANK_URL: z.string().optional(),
  LOGISTIKITA_URL: z.string().optional(),

  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3001'),
});

const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('❌ Invalid environment variables:', envParsed.error.format());
  process.exit(1);
}

console.log('✅ Environment variables loaded. MySQL:', envParsed.data.MYSQL_HOST + ':' + envParsed.data.MYSQL_PORT + '/' + envParsed.data.MYSQL_DATABASE);

module.exports = envParsed.data;
