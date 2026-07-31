import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  var url = process.env['TURSO_URL'];
  var token = process.env['TURSO_AUTH_TOKEN'];
  if (!url || !token) throw new Error('TURSO_URL ou TURSO_AUTH_TOKEN em falta');

  // Prisma 7 pode tentar ler DATABASE_URL — define como fallback
  if (!process.env['DATABASE_URL']) {
    process.env['DATABASE_URL'] = url;
  }

  var libsql = createClient({ url, authToken: token });
  var adapter = new PrismaLibSql(libsql);
  globalForPrisma.prisma = new PrismaClient({ adapter });
  return globalForPrisma.prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function ensureDatabase(): Promise<void> {}
