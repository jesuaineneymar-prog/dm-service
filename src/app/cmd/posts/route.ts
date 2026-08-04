// ============================================================
//  Aura POSTS API — Create, schedule, publish via Zernio + Upload-Post
//  All posts persisted in Prisma (PostHistory, ZernioPost, ContentPost)
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ZERNIO_KEY, UPLOADPOST_KEY } from '@/lib/config';
import { requireAuth } from '@/lib/auth';
import { generateContent } from '@/lib/ai';
import { groqGenerateContent } from '@/lib/groq';
import {
  zernioListAccounts, zernioCreatePost, zernioListPosts, zernioGetPost,
  zernioSchedulePost, zernioGetAnalytics, zernioGetPostAnalytics, zernioDeleteComment,
} from '@/lib/zernio';
import {
  upPublishText, upPublishFromURL, upGetHistory, upGetSchedule,
  upCancelScheduled, upGetStatus, upGetAnalytics,
} from '@/lib/platform-engine';

export var maxDuration = 120;

// Create post via Zernio
async function createViaZernio(options: any) {
  var accountsRes = await zernioListAccounts();
  if (!accountsRes.success) return { success: false, error: 'Zernio accounts: ' + accountsRes.error };

  var accounts = accountsRes.data;
  var accList = Array.isArray(accounts) ? accounts : (accounts?.accounts || []);
  var accountId = options.accountId || accList.find(function(a: any) { return a.platform === (options.platform || 'instagram'); })?._id || accList[0]?._id || '';
  if (!accountId) return { success: false, error: 'Nenhuma conta Zernio encontrada' };

  var result = await zernioCreatePost({
    accountId: accountId,
    caption: options.caption,
    mediaUrl: options.mediaUrl,
    platform: options.platform,
    scheduledAt: options.scheduledAt,
  });

  if (result.success) {
    // Persist to Prisma
    await db.zernioPost.create({
      data: {
        zernioId: result.data?.id || result.data?._id,
        platform: options.platform || 'instagram',
        caption: options.caption,
        status: options.scheduledAt ? 'scheduled' : 'published',
        scheduledAt: options.scheduledAt ? new Date(options.scheduledAt) : null,
        publishedAt: options.scheduledAt ? null : new Date(),
      },
    });
  }

  return result;
}

// Create post via Upload-Post
async function createViaUploadPost(options: any) {
  if (!UPLOADPOST_KEY) return { success: false, error: 'UPLOADPOST_KEY nao configurada' };

  var platforms = options.platforms || [options.platform || 'instagram'];
  var result: any;

  if (options.mediaUrl) {
    result = await upPublishFromURL(options.mediaUrl, options.caption || '', platforms, {
      scheduled_date: options.scheduledAt,
      first_comment: options.firstComment,
    });
  } else {
    result = await upPublishText(options.caption || '', platforms, {
      scheduled_date: options.scheduledAt,
      description: options.description,
    });
  }

  if (result?.request_id || result?.id) {
    await db.postHistory.create({
      data: {
        platform: platforms.join(','),
        externalPostId: result.request_id || result.id,
        caption: options.caption,
        mediaUrl: options.mediaUrl,
        status: options.scheduledAt ? 'scheduled' : 'published',
        source: 'uploadpost',
        publishedAt: options.scheduledAt ? null : new Date(),
      },
    });
  }

  return { success: !!result, data: result };
}

export async function POST(request: Request) {
  var authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    var body = await request.json().catch(function() { return {}; });
    var action = body.action || '';

    // === CREATE POST ===
    if (action === 'create') {
      var engine = body.engine || body.provider || 'zernio'; // 'zernio' or 'uploadpost'
      var result: any;

      if (engine === 'uploadpost' || engine === 'up') {
        result = await createViaUploadPost(body);
      } else {
        result = await createViaZernio(body);
      }

      return NextResponse.json(result);
    }

    // === LIST POSTS (Zernio) ===
    if (action === 'list_zernio') {
      var listResult = await zernioListPosts({ accountId: body.accountId, limit: body.limit || 20, status: body.status });
      return NextResponse.json(listResult);
    }

    // === GET POST (Zernio) ===
    if (action === 'get_post') {
      if (!body.postId) return NextResponse.json({ success: false, error: 'postId necessario' });
      var getResult = await zernioGetPost(body.postId);
      return NextResponse.json(getResult);
    }

    // === SCHEDULE POST (Zernio) ===
    if (action === 'schedule') {
      if (!body.postId || !body.scheduledAt) {
        return NextResponse.json({ success: false, error: 'postId e scheduledAt necessarios' });
      }
      var schedResult = await zernioSchedulePost(body.postId, body.scheduledAt);
      if (schedResult.success) {
        await db.zernioPost.updateMany({
          where: { zernioId: body.postId },
          data: { status: 'scheduled', scheduledAt: new Date(body.scheduledAt) },
        });
      }
      return NextResponse.json(schedResult);
    }

    // === DELETE COMMENT (Zernio) ===
    if (action === 'delete_comment') {
      if (!body.commentId || !body.accountId) {
        return NextResponse.json({ success: false, error: 'commentId e accountId necessarios' });
      }
      var delResult = await zernioDeleteComment(body.commentId, body.accountId);
      if (delResult.success) {
        await db.moderationLog.create({
          data: { platform: body.platform || 'instagram', commentId: body.commentId, commentText: '(deleted via posts API)', action: 'deleted', reason: 'User requested via posts API' },
        });
      }
      return NextResponse.json(delResult);
    }

    // === ANALYTICS (Zernio) ===
    if (action === 'analytics') {
      var analyticsResult = await zernioGetAnalytics({ accountId: body.accountId, period: body.period });
      return NextResponse.json(analyticsResult);
    }

    // === POST ANALYTICS (Zernio) ===
    if (action === 'post_analytics') {
      if (!body.postId) return NextResponse.json({ success: false, error: 'postId necessario' });
      var paResult = await zernioGetPostAnalytics(body.postId);
      return NextResponse.json(paResult);
    }

    // === UPLOAD-POST HISTORY ===
    if (action === 'up_history') {
      if (!UPLOADPOST_KEY) return NextResponse.json({ success: false, error: 'UPLOADPOST_KEY nao configurada' });
      var history = await upGetHistory();
      return NextResponse.json({ success: true, data: history });
    }

    // === UPLOAD-POST SCHEDULE ===
    if (action === 'up_schedule') {
      if (!UPLOADPOST_KEY) return NextResponse.json({ success: false, error: 'UPLOADPOST_KEY nao configurada' });
      var schedule = await upGetSchedule();
      return NextResponse.json({ success: true, data: schedule });
    }

    // === UPLOAD-POST CANCEL SCHEDULED ===
    if (action === 'up_cancel') {
      if (!body.jobId) return NextResponse.json({ success: false, error: 'jobId necessario' });
      var cancelResult = await upCancelScheduled(body.jobId);
      return NextResponse.json({ success: true, data: cancelResult });
    }

    // === UPLOAD-POST STATUS ===
    if (action === 'up_status') {
      if (!body.requestId) return NextResponse.json({ success: false, error: 'requestId necessario' });
      var statusResult = await upGetStatus(body.requestId);
      return NextResponse.json({ success: true, data: statusResult });
    }

    // === AI GENERATE CAPTION (Groq) ===
    if (action === 'ai_caption') {
      var prompt = body.prompt || 'Cria uma legenda criativa para a Mwango Brain sobre branding digital.';
      var caption = await groqGenerateContent(prompt, body.maxTokens || 300);
      return NextResponse.json({ success: true, data: { caption } });
    }

    // === LIST POST HISTORY (from Prisma) ===
    if (action === 'history') {
      var postHistory = await db.postHistory.findMany({ orderBy: { createdAt: 'desc' }, take: body.limit || 50 });
      var zernioPosts = await db.zernioPost.findMany({ orderBy: { createdAt: 'desc' }, take: body.limit || 50 });
      return NextResponse.json({ success: true, data: { uploadPost: postHistory, zernio: zernioPosts } });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
