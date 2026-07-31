// ============================================================
//  JARVIS SCHEDULER API — agendamento inteligente baseado em dados
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HIKERAPI_KEY, UPLOADPOST_KEY, IG_USERNAME } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

// ── helpers ────────────────────────────────────────────────

async function hikerFetch(path: string) {
  var res = await fetch('https://api.hikerapi.com' + path, {
    headers: { 'x-access-key': HIKERAPI_KEY, 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error('HikerAPI erro ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

var WAT_OFFSET = 1; // Angola: WAT = UTC+1
var DAY_NAMES = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

// ── actions ────────────────────────────────────────────────

async function getOptimalTimes() {
  // Fetch real post engagement data from HikerAPI
  var user: any = await hikerFetch('/v1/user/by/username?username=' + IG_USERNAME);
  var userId = user.pk || user.id;

  var postsRes: any = await hikerFetch('/v1/user/posts?user_id=' + userId + '&amount=60');
  var items = postsRes.items || postsRes.data || postsRes || [];

  // Group engagement by hour of day and day of week
  var timeSlots: any[][] = [];
  for (var d = 0; d < 7; d++) {
    timeSlots[d] = [];
    for (var h = 0; h < 24; h++) {
      timeSlots[d][h] = { totalEngagement: 0, count: 0 };
    }
  }

  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    var likes = p.like_count || 0;
    var comments = p.comment_count || 0;
    var engagement = likes + comments;
    var timestamp = p.taken_at || p.timestamp;
    if (!timestamp) continue;

    var date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
    if (isNaN(date.getTime())) continue;

    // Convert to Angola time (WAT = UTC+1)
    var watMs = date.getTime() + (WAT_OFFSET * 3600000);
    var watDate = new Date(watMs);
    var day = watDate.getUTCDay();
    var hour = watDate.getUTCHours();

    timeSlots[day][hour].totalEngagement += engagement;
    timeSlots[day][hour].count += 1;
  }

  // Build result for instagram
  var igSlots: any[] = [];
  for (var d2 = 0; d2 < 7; d2++) {
    for (var h2 = 0; h2 < 24; h2++) {
      var slot = timeSlots[d2][h2];
      if (slot.count === 0) continue;
      igSlots.push({
        day: DAY_NAMES[d2],
        dayIndex: d2,
        hour: h2,
        avgEngagement: parseFloat((slot.totalEngagement / slot.count).toFixed(2)),
        postCount: slot.count,
        recommended: false,
      });
    }
  }

  // Sort by avgEngagement descending
  igSlots.sort(function (a, b) { return b.avgEngagement - a.avgEngagement; });

  // Mark top 3 as recommended
  for (var r = 0; r < Math.min(3, igSlots.length); r++) {
    igSlots[r].recommended = true;
  }

  // For FB/TT, derive from same data (HikerAPI is IG-only)
  var fbSlots = igSlots.map(function (s: any) { return { ...s, platform: 'facebook' }; });
  var ttSlots = igSlots.map(function (s: any) { return { ...s, platform: 'tiktok' }; });

  // Default slots if no data
  var hasData = igSlots.length > 0;
  var defaultSlots = [
    { day: 'Terca', dayIndex: 2, hour: 12, avgEngagement: 0, postCount: 0, recommended: true },
    { day: 'Quarta', dayIndex: 3, hour: 18, avgEngagement: 0, postCount: 0, recommended: true },
    { day: 'Quinta', dayIndex: 4, hour: 9, avgEngagement: 0, postCount: 0, recommended: true },
    { day: 'Sexta', dayIndex: 5, hour: 15, avgEngagement: 0, postCount: 0, recommended: false },
    { day: 'Sabado', dayIndex: 6, hour: 11, avgEngagement: 0, postCount: 0, recommended: false },
  ];

  return {
    instagram: hasData ? igSlots : defaultSlots,
    facebook: hasData ? fbSlots : defaultSlots,
    tiktok: hasData ? ttSlots : defaultSlots,
    hasData,
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
<<<<<<< HEAD
=======
            'Authorization': 'Apikey ' + UPLOADPOST_KEY,
>>>>>>> 789c38943ef5c4d1541a53ec8f56b213ff07a530
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
