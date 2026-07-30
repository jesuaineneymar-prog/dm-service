import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; dbInitialized: boolean };

// Turso cloud (producao)
var TURSO_URL = 'libsql://jarvis-db-jesuaine.aws-eu-west-1.turso.io';
var TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODU0MzY1MDEsImlkIjoiMDE5ZmI0NGUtM2IwMS03YWFkLWJiNDMtYTUwNGNlMDA2MGZhIiwia2lkIjoiUVpuMTVCSEZHSC1hT3ZOeHE3eERoY1lDZmxsM192d3VzZ243WnVENUVUWSIsInJpZCI6ImJmZGEyM2RkLWFjYjktNDgzMy1iOTliLTFlZTg1MmI0YjM2YiJ9.bgTvz946Ezy7BQKJYcSmIxfXqSbXmzn8QjNK1ty5YYfd6MuDnYZHot2ixVI_qh3YK2wWZOk_kLCNKIr-d6FfCQ';

function createPrismaClient() {
  var dbUrl = process.env.DATABASE_URL || '';

  // Turso cloud (libsql://)
  var url = dbUrl.startsWith('libsql://') ? dbUrl : TURSO_URL;
  var libsql = createClient({ url, authToken: TURSO_TOKEN });
  var adapter = new PrismaLibSql(libsql);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });
}

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// Turso tem as tabelas criadas — sem necessidade de ensureDatabase local
// Mantemos a funcao para compatibilidade mas ela e no-op
export async function ensureDatabase(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;
  globalForPrisma.dbInitialized = true;
}
