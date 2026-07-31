import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  var url = process.env['TURSO_URL'];
  if (!url) throw new Error('TURSO_URL nao configurada.');
  var token = process.env['TURSO_AUTH_TOKEN'];
  if (!token) throw new Error('TURSO_AUTH_TOKEN nao configurada.');

  var libsql = createClient({ url, authToken: token });
  var adapter = new PrismaLibSql(libsql);
  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: process.env['NODE_ENV'] === 'development' ? ['query'] : [],
  });
  return globalForPrisma.prisma;
}

// Compatibilidade — db.prospect.count() ainda funciona via Proxy
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function ensureDatabase(): Promise<void> {}
