// ============================================================
//  Aura CRON — TikTok Automation (a cada 30 minutos)
//  - Descobre tendencias TikTok
//  - Gera conteudo automatico com IA
//  - Agenda posts para horarios optimos
//  - Monitora metricas
//  Protegido por CRON_SECRET via Vercel Cron
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';
import { CRON_SECRET } from '@/lib/config';
import { tikTokAutoCycle, getTikTokTrending } from '@/lib/tiktok-automation';

export var maxDuration = 120;

export async function GET(request: Request) {
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    var startTime = Date.now();

    // Run TikTok auto-cycle
    var cycleResults = await tikTokAutoCycle();

    // Also fetch trending for dashboard
    var trendingResults = await getTikTokTrending();

    var duration = Date.now() - startTime;

    // Log execution
    await db.automationLog.create({
      data: {
        type: 'cron_tiktok',
        action: 'tiktok_auto_cycle',
        platform: 'tiktok',
        status: cycleResults.errors.length === 0 ? 'success' : 'partial',
        result: JSON.stringify({
          contentGenerated: !!cycleResults.contentGenerated,
          scheduled: cycleResults.scheduled,
          duration: duration + 'ms',
        }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cron: 'tiktok',
      timestamp: new Date().toISOString(),
      duration: duration + 'ms',
      data: cycleResults,
      trending: trendingResults.success ? trendingResults.data : null,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST for manual trigger
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var secret = body.secret || '';
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  var results = await tikTokAutoCycle();
  return NextResponse.json({ success: true, cron: 'tiktok', data: results });
}
