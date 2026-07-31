// ============================================================
//  JARVIS CRON — Analytics Snapshot (diario)
//  Tira snapshot de seguidores/engagement para historico
//  Protegido por CRON_SECRET
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';
import { CRON_SECRET } from '@/lib/config';
import { HIKERAPI_KEY } from '@/lib/config';
import { IG_USERNAME } from '@/lib/config';

export var maxDuration = 60;

async function snapshotInstagram() {
  if (!HIKERAPI_KEY || !IG_USERNAME) return { platform: 'instagram', error: 'Sem HIKERAPI_KEY ou IG_USERNAME' };

  try {
    const res = await fetch('https://hikerapi.com/v2/user/info?username=' + IG_USERNAME + '&fields=follower_count,following_count,media_count,engagement_rate', {
      headers: { 'Authorization': 'Bearer ' + HIKERAPI_KEY },
    });
    const data = await res.json();
    const user = data?.data?.user || data?.user || data;

    const followers = user.follower_count || user.followers || 0;
    const following = user.following_count || user.following || 0;
    const posts = user.media_count || user.posts || 0;
    const eng = user.engagement_rate || 0;

    // Guardar evento de analytics
    await db.analyticsEvent.create({
      data: {
        platform: 'instagram',
        eventType: 'daily_snapshot',
        metricValue: followers,
        metadata: JSON.stringify({ followers, following, posts, engagement_rate: eng }),
      },
    });

    return { platform: 'instagram', followers, following, posts, engagement_rate: eng };
  } catch (e: any) {
    return { platform: 'instagram', error: e.message };
  }
}

async function snapshotFacebook() {
  // Facebook analytics via Zernio (se disponivel) — por agora snapshot basico
  const count = await db.automationLog.count({
    where: { platform: 'facebook', status: 'success' },
  });
  await db.analyticsEvent.create({
    data: {
      platform: 'facebook',
      eventType: 'daily_snapshot',
      metricValue: count,
      metadata: JSON.stringify({ automation_events: count }),
    },
  });
  return { platform: 'facebook', automation_events: count };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || '';
  const urlSecret = new URL(request.url).searchParams.get('secret') || '';
  const isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    const startTime = Date.now();

    const [igResult, fbResult] = await Promise.all([snapshotInstagram(), snapshotFacebook()]);

    const duration = Date.now() - startTime;

    await db.automationLog.create({
      data: {
        type: 'cron_analytics',
        action: 'daily_snapshot',
        platform: 'all',
        status: 'success',
        result: JSON.stringify({ instagram: igResult, facebook: fbResult, duration: duration + 'ms' }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cron: 'analytics_snapshot',
      timestamp: new Date().toISOString(),
      duration: duration + 'ms',
      data: { instagram: igResult, facebook: fbResult },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(function() { return {}; });
  const secret = body.secret || '';
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [igResult, fbResult] = await Promise.all([snapshotInstagram(), snapshotFacebook()]);
  return NextResponse.json({ success: true, cron: 'analytics_snapshot', data: { instagram: igResult, facebook: fbResult } });
}
