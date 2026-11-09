import { PrismaClient } from '@prisma/client';

/**
 * Tek bir PrismaClient örneği. Geliştirmede "hot reload" her seferinde yeni bağlantı
 * açmasın diye örnek globalThis üzerinde tutulur.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
