import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const DB_VERSION = 'v3'; // Incrementa para forcar nova instancia
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null; dbVersion: string };

export function getDb(): PrismaClient {
  // Se a versao mudou, recria o cliente
  if (globalForPrisma.dbVersion !== DB_VERSION) {
    globalForPrisma.prisma = null;
    globalForPrisma.dbVersion = DB_VERSION;
  }
  
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  
  var url = process.env['TURSO_URL'];
  var token = process.env['TURSO_AUTH_TOKEN'];

  if (!url) throw new Error('TURSO_URL missing. Keys: ' + 
    Object.keys(process.env).filter(function(k) { return k.indexOf('TURSO') >= 0; }).join(', '));
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
