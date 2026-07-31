import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { TURSO_URL, TURSO_AUTH_TOKEN } from './config';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null; dbInitialized: boolean };

function createPrismaClient(): PrismaClient {
  var url = TURSO_URL;
  if (!url) throw new Error('TURSO_URL nao configurada. Define no .env.local ou Vercel env.');
  var token = TURSO_AUTH_TOKEN;
  if (!token) throw new Error('TURSO_AUTH_TOKEN nao configurada. Define no .env.local ou Vercel env.');

  var libsql = createClient({ url, authToken: token });
  var adapter = new PrismaLibSql(libsql);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });
}

// Lazy singleton — so conecta no primeiro acesso, nao na importacao
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return (globalForPrisma.prisma as any)[prop];
  },
});

if (process.env.NODE_ENV !== 'production') {
  // Em dev, mantem a instancia global para hot-reload
  if (!globalForPrisma.prisma) {
    // Nao cria aqui — deixa o proxy criar lazy
  }
}

// Turso tem as tabelas criadas — sem necessidade de ensureDatabase local
export async function ensureDatabase(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;
  globalForPrisma.dbInitialized = true;
}
