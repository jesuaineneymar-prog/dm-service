// ============================================================
//  Aura MODERATION API — persisted via Prisma
//  Uses Groq LLM for toxicity analysis
//  Uses HikerAPI to fetch + Zernio to delete comments
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { groqToxicityAnalysis } from '@/lib/groq';
import { zernioDeleteComment } from '@/lib/zernio';

export var maxDuration = 60;

// Scan comments on a post for toxic content
async function scanPostComments(mediaId: string, platform: string) {
  // TODO: replace with Zernio or ScrapingBee for comment fetching
  return { error: 'HikerAPI removido. Usa Zernio ou ScrapingBee para buscar comentarios.' };
}

// Delete a comment via Zernio
async function deleteComment(commentId: string, accountId: string, platform: string) {
  var result = await zernioDeleteComment(commentId, accountId);

  // Log action
  await db.moderationLog.create({
    data: { platform, commentId, commentText: '(deleted)', action: result.success ? 'deleted' : 'delete_failed', reason: result.error || 'User requested' },
  });

  return result;
}

// Get moderation history from Prisma
async function getModerationHistory(options?: { limit?: number; platform?: string }) {
  var where: any = {};
  if (options?.platform) where.platform = options.platform;
  var logs = await db.moderationLog.findMany({
    where, orderBy: { createdAt: 'desc' }, take: options?.limit || 50,
  });
  return logs;
}

export async function POST(request: Request) {
  var authErr = requireAuth(request);
  if (authErr) return authErr;
  try {
    var body = await request.json().catch(function() { return {}; });
    var action = body.action || '';

    if (action === 'scan_post') {
      if (!body.mediaId) return NextResponse.json({ success: false, error: 'mediaId necessario' });
      var scanResult = await scanPostComments(body.mediaId, body.platform || 'instagram');
      return NextResponse.json({ success: true, data: scanResult });
    }

    if (action === 'delete_comment') {
      if (!body.commentId || !body.accountId) {
        return NextResponse.json({ success: false, error: 'commentId e accountId necessarios' });
      }
      var delResult = await deleteComment(body.commentId, body.accountId, body.platform || 'instagram');
      return NextResponse.json(delResult);
    }

    if (action === 'history') {
      var history = await getModerationHistory({ limit: body.limit, platform: body.platform });
      return NextResponse.json({ success: true, data: history });
    }

    if (action === 'analyze_text') {
      if (!body.text) return NextResponse.json({ success: false, error: 'Texto necessario' });
      var analysis = await groqToxicityAnalysis(body.text);
      return NextResponse.json({ success: true, data: analysis });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
