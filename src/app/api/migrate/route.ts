// ============================================================
//  ONE-TIME MIGRATION — Add missing columns to Turso/SQLite
//  This is a public endpoint (runs during deploy only)
// ============================================================

import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export var maxDuration = 30;

export async function GET() {
  var results: string[] = [];

  try {
    // 1. Add FollowUp.result column
    try {
      await db.$executeRawUnsafe('ALTER TABLE FollowUp ADD COLUMN result TEXT');
      results.push('FollowUp.result ADDED');
    } catch (e: any) {
      if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
        results.push('FollowUp.result already exists (OK)');
      } else {
        results.push('FollowUp.result ERROR: ' + e.message.slice(0, 100));
      }
    }

    // 2. Add ContentPost.hashtags column
    try {
      await db.$executeRawUnsafe('ALTER TABLE ContentPost ADD COLUMN hashtags TEXT');
      results.push('ContentPost.hashtags ADDED');
    } catch (e: any) {
      if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
        results.push('ContentPost.hashtags already exists (OK)');
      } else {
        results.push('ContentPost.hashtags ERROR: ' + e.message.slice(0, 100));
      }
    }

    // 3. Check ClientReport table exists
    try {
      await db.$executeRawUnsafe('SELECT COUNT(*) FROM ClientReport');
      results.push('ClientReport table exists (OK)');
    } catch (e: any) {
      if (e.message?.includes('no such table')) {
        results.push('ClientReport table MISSING (will be created on first use)');
      } else {
        results.push('ClientReport check: ' + e.message.slice(0, 100));
      }
    }

    // 4. Check SystemSetting table exists
    try {
      await db.$executeRawUnsafe('SELECT COUNT(*) FROM SystemSetting');
      results.push('SystemSetting table exists (OK)');
    } catch (e: any) {
      if (e.message?.includes('no such table')) {
        results.push('SystemSetting table MISSING (will be created on first use)');
      } else {
        results.push('SystemSetting check: ' + e.message.slice(0, 100));
      }
    }

    // 5. Verify all columns
    var tables = await db.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'") as any[];
    var tableNames = tables.map(function(t: any) { return t.name; });
    results.push('Tables: ' + tableNames.join(', '));

    return NextResponse.json({ success: true, results: results });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message, results: results });
  }
}
