import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { TURSO_URL, TURSO_AUTH_TOKEN } from './config';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  // Usa valores vindos do config.ts que consegue ler as env vars
  var url = TURSO_URL;
  var token = TURSO_AUTH_TOKEN;
  console.log('[Aura DB] TURSO_URL from config:', url ? url.slice(0, 25) + '...' : 'MISSING');
  console.log('[Aura DB] TURSO_AUTH_TOKEN from config:', token ? 'SET (' + token.length + ' chars)' : 'MISSING');

  if (!url) throw new Error('TURSO_URL nao configurada (config returned empty).');
  if (!token) throw new Error('TURSO_AUTH_TOKEN nao configurada (config returned empty).');

  var libsql = createClient({ url, authToken: token });
  var adapter = new PrismaLibSql(libsql);
  globalForPrisma.prisma = new PrismaClient({
    adapter,
    log: false,
  });
  return globalForPrisma.prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function ensureDatabase(): Promise<void> {}
