import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load the env file matching NODE_ENV first, then fall back to `.env`.
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
const envPath = path.resolve(process.cwd(), envFile);
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isTest: process.env.NODE_ENV === 'test',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4100),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5175')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  seedPassword: process.env.SEED_PASSWORD ?? 'Password123!',
  disableRateLimit: process.env.DISABLE_RATE_LIMIT === 'true',
} as const;

// A weak secret in production is a deployment bug, not a runtime detail.
if (env.isProduction && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
