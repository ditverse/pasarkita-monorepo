const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  SUPABASE_URL: z.string().min(1, "SUPABASE_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  GATEWAY_BASE_URL: z.string().optional(),
  GATEWAY_API_KEY: z.string().optional(),
  SMARTBANK_URL: z.string().optional(),
  LOGISTIKITA_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform(Number).default("3001"),
});

const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error("❌ Invalid environment variables:", envParsed.error.format());
  process.exit(1);
}

console.log("✅ Environment variables loaded. Supabase URL:", envParsed.data.SUPABASE_URL);

module.exports = envParsed.data;
