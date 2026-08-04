// ============================================================
//  Aura SCHEDULER API — agendamento inteligente baseado em dados
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UPLOADPOST_KEY } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

// ── helpers ────────────────────────────────────────────────

var WAT_OFFSET = 1; // Angola: WAT = UTC+1

// ── actions ────────────────────────────────────────────────

async function getOptimalTimes() {
  // TODO: replace with Zernio/ScrapingBee analytics
  var defaultSlots = [
    { day: 'Terca', dayIndex: 2, hour: 12, avgEngagement: 0, postCount: 0, recommended: true },
    { day: 'Quarta', dayIndex: 3, hour: 18, avgEngagement: 0, postCount: 0, recommended: true },
    { day: 'Quinta', dayIndex: 4, hour: 9, avgEngagement: 0, postCount: 0, recommended: true },
    { day: 'Sexta', dayIndex: 5, hour: 15, avgEngagement: 0, postCount: 0, recommended: false },
    { day: 'Sabado', dayIndex: 6, hour: 11, avgEngagement: 0, postCount: 0, recommended: false },
  ];

  return {
    instagram: defaultSlots,
    facebook: defaultSlots,
    tiktok: defaultSlots,
    hasData: false,
  };
}

function findNextOptimalTime(optimalTimes: any): Date {
  var slots = optimalTimes.instagram || [];
  var recommended = slots.filter(function (s: any) { return s.recommended; });
  if (recommended.length === 0) recommended = slots;
  if (recommended.length === 0) {
    var fallback = new Date();
    fallback.setDate(fallback.getDate() + 1);
    fallback.setUTCHours(12, 0, 0, 0);
    return fallback;
  }

  var now = new Date();
  var candidates: Date[] = [];

  // Gerar candidatos para as proximas 3 semanas
  for (var weekOffset = 0; weekOffset < 3; weekOffset++) {
    for (var i = 0; i < recommended.length; i++) {
      var slot = recommended[i];
      // Current Angola time
      var nowWAT = new Date(now.getTime() + (WAT_OFFSET * 3600000));
      var currentDay = nowWAT.getUTCDay();
      var targetDay = slot.dayIndex;
      var daysUntilTarget = (targetDay - currentDay + 7) % 7;
      // Se e hoje mas a hora ja passou, mandar para a proxima semana
      if (daysUntilTarget === 0 && nowWAT.getUTCHours() >= slot.hour) {
        daysUntilTarget = 7;
      }
      // Build candidate in Angola time, then convert to UTC
      var candidateWAT = new Date(nowWAT);
      candidateWAT.setUTCDate(candidateWAT.getUTCDate() + daysUntilTarget + (weekOffset * 7));
      candidateWAT.setUTCHours(slot.hour, 0, 0, 0);
      // Convert back to UTC
      var candidate = new Date(candidateWAT.getTime() - (WAT_OFFSET * 3600000));
      if (candidate > now) candidates.push(candidate);
    }
  }

  // Ordenar por data e retornar o mais proximo
  candidates.sort(function (a, b) { return a.getTime() - b.getTime(); });
  if (candidates.length > 0) return candidates[0];

  // Fallback final
  var fb2 = new Date();
  fb2.setDate(fb2.getDate() + 1);
  fb2.setUTCHours(12, 0, 0, 0);
  return fb2;
}

async function schedulePost(contentPostId: string, platforms: string[], scheduledFor: string) {
  var platformsList = platforms || ['instagram'];
  var targetDate = scheduledFor ? new Date(scheduledFor) : null;

  if (!targetDate || isNaN(targetDate.getTime())) {
    var optimal = await getOptimalTimes();
    targetDate = findNextOptimalTime(optimal);
  }

  var created: any[] = [];
  for (var i = 0; i < platformsList.length; i++) {
    var plat = platformsList[i];
    var scheduledPost = await db.scheduledPost.create({
      data: {
        contentPostId: contentPostId || '',
        platforms: plat,
        scheduledFor: targetDate,
        status: 'pending',
      },
    });

    // Call Upload-Post schedule API
    var upResult: any = null;
    try {
      if (UPLOADPOST_KEY) {
        var caption = '';
        if (contentPostId) {
          var cp = await db.contentPost.findUnique({ where: { id: contentPostId } });
          if (cp) caption = cp.caption;
        }

        var res = await fetch('https://api.upload-post.com/api/uploadposts/schedule', {
          method: 'POST',
          headers: {
            'Authorization': 'Apikey ' + UPLOADPOST_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user: 'jarvis',
            platform: plat,
            title: caption,
            scheduled_date: targetDate.toISOString(),
          }),
        });
        var json = await res.json();
        upResult = json;

        if (json.id || json.request_id) {
          await db.scheduledPost.update({
            where: { id: scheduledPost.id },
            data: { uploadPostId: json.id || json.request_id },
          });
        }
      }
    } catch (e: any) {
      console.error('UploadPost schedule erro:', e.message);
    }

    created.push({
      scheduledId: scheduledPost.id,
      platform: plat,
      scheduledFor: targetDate.toISOString(),
      uploadPostResult: upResult,
    });
  }

  return { success: true, scheduledFor: targetDate.toISOString(), platforms: platformsList, scheduled: created };
}

async function listScheduled() {
  var posts = await db.scheduledPost.findMany({
    where: { status: 'pending' },
    orderBy: { scheduledFor: 'asc' },
    include: { contentPost: true },
  });

  return posts.map(function (sp: any) {
    return {
      id: sp.id,
      platforms: sp.platforms,
      scheduledFor: sp.scheduledFor,
      status: sp.status,
      uploadPostId: sp.uploadPostId,
      content: sp.contentPost
        ? { id: sp.contentPost.id, caption: sp.contentPost.caption.slice(0, 100), platform: sp.contentPost.platform, mediaUrl: sp.contentPost.mediaUrl }
        : null,
    };
  });
}

async function cancelScheduled(id: string) {
  var sp = await db.scheduledPost.findUnique({ where: { id } });
  if (!sp) throw new Error('Post agendado nao encontrado');

  if (sp.uploadPostId && UPLOADPOST_KEY) {
    try {
      await fetch('https://api.upload-post.com/api/uploadposts/schedule/' + sp.uploadPostId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY },
      });
    } catch (e: any) {
      console.error('Erro ao cancelar no UploadPost:', e.message);
    }
  }

  var updated = await db.scheduledPost.update({ where: { id }, data: { status: 'cancelled' } });
  return { success: true, data: updated };
}

async function getCalendar(month: number, year: number) {
  var startDate = new Date(year, month - 1, 1);
  var endDate = new Date(year, month, 0, 23, 59, 59, 999);

  var posts = await db.scheduledPost.findMany({
    where: { scheduledFor: { gte: startDate, lte: endDate } },
    include: { contentPost: true },
    orderBy: { scheduledFor: 'asc' },
  });

  var dates: Record<string, any[]> = {};
  for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    var dateKey = p.scheduledFor.toISOString().slice(0, 10);
    if (!dates[dateKey]) dates[dateKey] = [];
    dates[dateKey].push({
      id: p.id,
      platforms: p.platforms,
      scheduledFor: p.scheduledFor.toISOString(),
      status: p.status,
      caption: p.contentPost ? p.contentPost.caption.slice(0, 80) : '',
      mediaUrl: p.contentPost ? p.contentPost.mediaUrl : null,
    });
  }

  return { dates };
}

async function getScheduleStats() {
  var now = new Date();
  var weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  var all = await db.scheduledPost.findMany();

  var byPlatform: Record<string, number> = {};
  var byStatus: Record<string, number> = {};
  var publishedThisWeek = 0;
  var publishedThisMonth = 0;

  for (var i = 0; i < all.length; i++) {
    var sp = all[i];
    byPlatform[sp.platforms] = (byPlatform[sp.platforms] || 0) + 1;
    byStatus[sp.status] = (byStatus[sp.status] || 0) + 1;
    if (sp.status === 'published') {
      if (sp.scheduledFor >= weekStart) publishedThisWeek++;
      if (sp.scheduledFor >= monthStart) publishedThisMonth++;
    }
  }

  return {
    total: all.length,
    byPlatform,
    byStatus,
    publishedThisWeek,
    publishedThisMonth,
    pending: byStatus['pending'] || 0,
  };
}

// ── main handler ───────────────────────────────────────────

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'get_optimal_times') {
      var times = await getOptimalTimes();
      return NextResponse.json({ success: true, data: times });
    }

    if (action === 'schedule_post') {
      var result = await schedulePost(
        body.contentPostId || '',
        body.platforms || ['instagram'],
        body.scheduledFor || '',
      );
      return NextResponse.json(result);
    }

    if (action === 'list_scheduled') {
      var scheduled = await listScheduled();
      return NextResponse.json({ success: true, data: scheduled });
    }

    if (action === 'cancel_scheduled') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      var cancelled = await cancelScheduled(body.id);
      return NextResponse.json(cancelled);
    }

    if (action === 'get_calendar') {
      var month = body.month || (new Date().getMonth() + 1);
      var year = body.year || new Date().getFullYear();
      var calendar = await getCalendar(month, year);
      return NextResponse.json({ success: true, data: calendar });
    }

    if (action === 'get_schedule_stats') {
      var stats = await getScheduleStats();
      return NextResponse.json({ success: true, data: stats });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
