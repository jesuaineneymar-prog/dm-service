import { NextResponse } from 'next/server';
import { TURSO_URL, TURSO_AUTH_TOKEN } from '@/lib/config';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

export async function GET() {
  var results: any = {
    config_url: TURSO_URL ? TURSO_URL.slice(0, 30) + '...' : 'MISSING',
    process_env_url: process.env['TURSO_URL'] ? process.env['TURSO_URL'].slice(0, 30) + '...' : 'MISSING',
  };

  // Test direct connection here
  try {
    var url = process.env['TURSO_URL'];
    var token = process.env['TURSO_AUTH_TOKEN'];
    results.db_url_at_call_time = url ? url.slice(0, 30) + '...' : 'UNDEFINED';
    
    var libsql = createClient({ url: url, authToken: token });
    var adapter = new PrismaLibSql(libsql);
    var prisma = new PrismaClient({ adapter, log: false });
    var count = await prisma.prospect.count();
    results.direct_db_ok = true;
    results.prospect_count = count;
    await prisma.$disconnect();
  } catch (e: any) {
    results.direct_db_error = e.message.slice(0, 200);
  }

  // Test via db module
  try {
    var { db } = await import('@/lib/db');
    var count2 = await db.prospect.count();
    results.module_db_ok = true;
    results.module_prospect_count = count2;
  } catch (e: any) {
    results.module_db_error = e.message.slice(0, 200);
  }

  return NextResponse.json(results);
}
