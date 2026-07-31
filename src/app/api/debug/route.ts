import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

export async function GET() {
  var results: any = {};

  // Test 1: Hardcoded URL
  try {
    var client1 = createClient({ 
      url: 'libsql://jarvis-db-jesuaine.aw0turso.app', 
      authToken: 'test'
    });
    results.hardcoded_client_created = true;
    await client1.close();
  } catch (e: any) {
    results.hardcoded_error = e.message.slice(0, 200);
  }

  // Test 2: Env var URL
  try {
    var envUrl = process.env['TURSO_URL'];
    results.env_url = envUrl ? envUrl.slice(0, 30) : 'MISSING';
    var client2 = createClient({ url: envUrl, authToken: process.env['TURSO_AUTH_TOKEN'] });
    results.envvar_client_created = true;
    await client2.close();
  } catch (e: any) {
    results.envvar_error = e.message.slice(0, 200);
  }

  // Test 3: Prisma with hardcoded adapter
  try {
    var libsql = createClient({ url: 'libsql://jarvis-db-jesuaine.aw0turso.app', authToken: process.env['TURSO_AUTH_TOKEN'] });
    var adapter = new PrismaLibSql(libsql);
    var prisma = new PrismaClient({ adapter });
    var count = await prisma.prospect.count();
    results.prisma_hardcoded_ok = true;
    results.prospect_count = count;
    await prisma.$disconnect();
  } catch (e: any) {
    results.prisma_hardcoded_error = e.message.slice(0, 300);
  }

  return NextResponse.json(results);
}
