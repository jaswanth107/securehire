// Applies the Prisma schema to the *test* database named in .env.test.
// Kept as a script so credentials stay in the env file rather than package.json.
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const parsed = dotenv.config({ path: '.env.test' }).parsed ?? {};
if (!parsed.DATABASE_URL) {
  console.error('DATABASE_URL is missing from .env.test');
  process.exit(1);
}

const result = spawnSync(
  'node_modules/.bin/prisma',
  ['db', 'push', '--skip-generate', '--accept-data-loss'],
  { stdio: 'inherit', env: { ...process.env, DATABASE_URL: parsed.DATABASE_URL } },
);

process.exit(result.status ?? 1);
