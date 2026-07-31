import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

export function getDb(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  // Forca leitura do process.env no runtime, evitando optimizacao do Turbopack
  var env = process.env;
  var url = env['TURSO_URL'];
  var token = env['TURSO_AUTH_TOKEN'];

  if (!url) throw new Error('TURSO_URL missing. Available TURSO keys: ' + 
    Object.keys(env).filter(function(k) { return k.indexOf('TURSO') >= 0; }).join(', '));
  if (!token) throw new Error('TURSO_AUTH_TOKEN missing.');

  var libsql = createClient({ url: url, authToken: token });
  var adapter = new PrismaLibSql(libsql);
  globalForPrisma.prisma = new PrismaClient({ adapter, log: false });
  return globalForPrisma.prisma;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function ensureDatabase(): Promise<void> {}
