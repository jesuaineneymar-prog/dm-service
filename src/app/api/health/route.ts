// ============================================================
//  JARVIS HEALTH CHECK
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  var dbOk = false;
  var dbError = '';
  try {
    await db.prospect.count();
    dbOk = true;
  } catch (e: any) {
    dbError = e.message;
  }

  return NextResponse.json({
    status: dbOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      database: dbOk ? 'ok' : 'error: ' + dbError,
      server: 'ok',
    },
  });
}
