import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null; dbInitialized: boolean };

function createPrismaClient(): PrismaClient {
  // Bracket notation evita que o Turbopack substitua por undefined no build
  var url = process.env['TURSO_URL'];
  if (!url) throw new Error('TURSO_URL nao configurada. Valor: ' + String(url) + '. Define no .env.local ou Vercel env.');
  var token = process.env['TURSO_AUTH_TOKEN'];
  if (!token) throw new Error('TURSO_AUTH_TOKEN nao configurada. Define no .env.local ou Vercel env.');

  var libsql = createClient({ url, authToken: token });
  var adapter = new PrismaLibSql(libsql);
  return new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development' ? ['query'] : [],
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

// Turso tem as tabelas criadas — sem necessidade de ensureDatabase local
export async function ensureDatabase(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;
  globalForPrisma.dbInitialized = true;
}
