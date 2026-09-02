import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

// Logs are deliberately quiet: query logs would put candidate PII into stdout.
export const prisma = new PrismaClient({
  log: env.isProduction ? ['error'] : ['error', 'warn'],
});
