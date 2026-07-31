const globalForPrisma = globalThis as unknown as { prisma: any; libsql: any; adapter: any };

export function getDb(): any {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  var url = process.env['TURSO_URL'];
  var token = process.env['TURSO_AUTH_TOKEN'];
  if (!url || !token) throw new Error('TURSO_URL ou TURSO_AUTH_TOKEN em falta');

  // Carrega os pacotes dinamicamente para evitar optimizacao do Turbopack
  if (!globalForPrisma.libsql) {
    var libsqlMod = require('@libsql/client');
    globalForPrisma.libsql = libsqlMod.createClient({ url, authToken: token });
  }
  if (!globalForPrisma.adapter) {
    var adapterMod = require('@prisma/adapter-libsql');
    globalForPrisma.adapter = new adapterMod.PrismaLibSql(globalForPrisma.libsql);
  }
  if (!globalForPrisma.prisma) {
    var prismaMod = require('@prisma/client');
    // Define DATABASE_URL antes de criar o cliente
    (process.env as any)['DATABASE_URL'] = url;
    globalForPrisma.prisma = new prismaMod.PrismaClient({ adapter: globalForPrisma.adapter });
  }
  return globalForPrisma.prisma;
}

export const db: any = new Proxy({}, {
  get(_target, prop) {
    return (getDb() as any)[prop];
  },
});

export async function ensureDatabase(): Promise<void> {}
