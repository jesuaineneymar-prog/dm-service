// ============================================================
//  Aura SETTINGS API — configuracoes do sistema
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'get_all') {
      var settings = await db.systemSetting.findMany();
      var map: Record<string, string> = {};
      for (var i = 0; i < settings.length; i++) {
        map[settings[i].key] = settings[i].value;
      }
      return NextResponse.json({ success: true, data: map });
    }

    if (action === 'get') {
      if (!body.key) return NextResponse.json({ success: false, error: 'Key necessaria' });
      var setting = await db.systemSetting.findUnique({ where: { key: body.key } });
      return NextResponse.json({ success: true, data: setting?.value || null });
    }

    if (action === 'set') {
      if (!body.key) return NextResponse.json({ success: false, error: 'Key necessaria' });
      var value = body.value !== undefined ? String(body.value) : '';
      var upserted = await db.systemSetting.upsert({
        where: { key: body.key },
        update: { value },
        create: { key: body.key, value },
      });
      return NextResponse.json({ success: true, data: upserted });
    }

    if (action === 'set_many') {
      var pairs = body.settings || {};
      var results: Record<string, string> = {};
      var keys = Object.keys(pairs);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        await db.systemSetting.upsert({
          where: { key: k },
          update: { value: String(pairs[k]) },
          create: { key: k, value: String(pairs[k]) },
        });
        results[k] = 'OK';
      }
      return NextResponse.json({ success: true, data: results });
    }

    if (action === 'delete') {
      if (!body.key) return NextResponse.json({ success: false, error: 'Key necessaria' });
      await db.systemSetting.deleteMany({ where: { key: body.key } });
      return NextResponse.json({ success: true });
    }

    if (action === 'get_system_info') {
      var envInfo = {
        hasTursoUrl: !!(process.env.TURSO_URL),
        hasUploadPostKey: !!(process.env.UPLOADPOST_KEY || process.env.UPLOAD_POST_API_KEY),
        hasZernioKey: !!(process.env.ZERNIO_KEY),
        hasOrKey: !!(process.env.OR_KEY),
        hasCronSecret: !!(process.env.CRON_SECRET),
        nodeEnv: process.env.NODE_ENV || 'unknown',
        region: process.env.VERCEL_REGION || 'local',
      };
      var totalProspects = await db.prospect.count();
      var totalPosts = await db.contentPost.count();
      var totalScheduled = await db.scheduledPost.count({ where: { status: 'pending' } });
      var totalNotifs = await db.notification.count({ where: { isRead: false } });
      return NextResponse.json({
        success: true,
        data: {
          ...envInfo,
          dbStats: { prospects: totalProspects, posts: totalPosts, scheduled: totalScheduled, unreadNotifs: totalNotifs },
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
