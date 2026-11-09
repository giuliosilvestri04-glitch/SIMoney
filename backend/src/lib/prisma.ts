import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * Istanza unica del client database.
 * In sviluppo viene riutilizzata tra i reload di `tsx watch` per non esaurire
 * le connessioni.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

if (!env.isProduction) globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
