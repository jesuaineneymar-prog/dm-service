// ============================================================
//  Aura PUBLISH API — Publicacao directa IG + FB
//  Posts, Stories, Comments, Auto-Reply DMs
//  IG via instagrapi, FB via Graph API
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fbPublishPost, fbPublishStory, fbGetComments, fbReplyComment } from '@/lib/fb-publish';
import { igPublishPost, igPublishStory, igGetComments, igReplyComment, igGetInbox, igSendDM, igSendDMByUsername, igGetUserStats, igGetFollowers } from '@/lib/ig-publish';
import { metaSendDM, metaGetConversations } from '@/lib/meta-graph';
import { generateDMReply, generateCommentDM, generateAIResponse, getColdDMSystemPrompt } from '@/lib/ai';
import { db } from '@/lib/db';

export var maxDuration = 300;

// === PUBLISH POST ===
async function publishPost(body: any) {
  var platforms = body.platforms || [body.platform || 'instagram'];
  var results: any[] = [];

  for (var i = 0; i < platforms.length; i++) {
    var plat = platforms[i];
    var r: any;
    if (plat === 'facebook') {
      r = await fbPublishPost({ message: body.caption, imageUrl: body.imageUrl, link: body.link });
    } else if (plat === 'instagram') {
      r = await igPublishPost({ imageUrl: body.imageUrl, videoUrl: body.videoUrl, caption: body.caption, mediaData: body.mediaData, mediaType: body.mediaType });
    } else {
      r = { success: false, error: 'Plataforma nao suportada: ' + plat };
    }
    results.push({ platform: plat, ...r });
  }

  var succeeded = results.filter(function(r) { return r.success; }).length;
  return { success: succeeded > 0, results, published: succeeded, failed: results.length - succeeded };
}

// === PUBLISH STORY ===
async function publishStory(body: any) {
  var platforms = body.platforms || [body.platform || 'instagram'];
  var results: any[] = [];

  for (var i = 0; i < platforms.length; i++) {
    var plat = platforms[i];
    var r: any;
    if (plat === 'facebook') {
      r = await fbPublishStory({ imageUrl: body.imageUrl, caption: body.caption });
    } else if (plat === 'instagram') {
      r = await igPublishStory({ imageUrl: body.imageUrl, videoUrl: body.videoUrl, caption: body.caption, mediaData: body.mediaData, mediaType: body.mediaType });
    } else {
      r = { success: false, error: 'Plataforma nao suportada: ' + plat };
    }
    results.push({ platform: plat, ...r });
  }

  var succeeded = results.filter(function(r) { return r.success; }).length;
  return { success: succeeded > 0, results, published: succeeded, failed: results.length - succeeded };
}

// === GET COMMENTS ===
async function getComments(body: any) {
  var platform = body.platform || 'instagram';
  var results: any = {};

  if (platform === 'facebook' || platform === 'all') {
    results.facebook = await fbGetComments(body.postId);
  }
  if (platform === 'instagram' || platform === 'all') {
    if (!body.mediaId) {
      results.instagram = { success: false, error: 'mediaId necessario para Instagram' };
    } else {
      results.instagram = await igGetComments(body.mediaId, body.limit);
    }
  }

  var allComments: any[] = [];
  if (results.facebook?.comments) allComments = allComments.concat(results.facebook.comments);
  if (results.instagram?.comments) allComments = allComments.concat(results.instagram.comments);

  return { success: allComments.length > 0, comments: allComments, byPlatform: results, total: allComments.length };
}

// === REPLY TO COMMENTS ===
async function replyToComments(body: any) {
  var comments = body.comments || [];
  if (!comments.length) return { success: false, error: 'comments array vazio' };

  var results: any[] = [];
  var totalReplied = 0;

  for (var i = 0; i < comments.length; i++) {
    var c = comments[i];
    var replyMsg = c.replyText;
    if (!replyMsg && c.text && body.aiReply !== false) {
      replyMsg = await generateCommentDM(c.username, c.text, c.platform || 'instagram', body.postCaption);
    }
    if (!replyMsg) { results.push({ username: c.username, success: false, error: 'Mensagem vazia' }); continue; }

    var r: any;
    if (c.platform === 'facebook') {
      r = await fbReplyComment(c.id, replyMsg);
    } else if (c.platform === 'instagram') {
      r = await igReplyComment(c.postId || c.mediaId || '', c.id, replyMsg);
    } else {
      r = { success: false, error: 'Plataforma desconhecida' };
    }
    if (r.success) totalReplied++;
    results.push({ username: c.username, ...r, replySent: replyMsg });
  }

  return { success: totalReplied > 0, totalReplied, total: comments.length, results };
}

// === AUTO-REPLY DMs ===
async function autoReplyDMs(body: any) {
  var platform = body.platform || 'instagram';
  var results: any[] = [];
  var replied = 0;

  if (platform === 'instagram' || platform === 'all') {
    try {
      var inbox = await igGetInbox(body.limit || 10);
      if (inbox.success && inbox.threads) {
        for (var i = 0; i < inbox.threads.length; i++) {
          var thread = inbox.threads[i];
          if (thread.unread <= 0 && !body.replyAll) continue;
          var lastMsg = thread.lastMessage;
          if (!lastMsg) continue;
          var sender = thread.users[0];
          if (!sender) continue;

          var aiReply = await generateDMReply(sender.username, 'Instagram', lastMsg);
          var sendResult = await igSendDM(sender.userId, aiReply);
          if (sendResult.success) replied++;

          try {
            var prospect = await db.prospect.findFirst({ where: { platform: 'instagram', username: sender.username } });
            if (prospect) {
              await db.message.create({ data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform: 'instagram' } });
              await db.prospect.update({ where: { id: prospect.id }, data: { lastContactedAt: new Date() } });
            }
            await db.automationLog.create({ data: { type: 'auto_reply', action: 'dm_replied', platform: 'instagram', targetId: sender.userId, targetName: sender.username, status: sendResult.success ? 'completed' : 'failed', result: aiReply.slice(0, 200) } });
          } catch(e) {}

          results.push({ username: sender.username, userId: sender.userId, message: lastMsg, reply: aiReply, ...sendResult });
        }
      }
    } catch(e: any) {
      results.push({ platform: 'instagram', error: e.message });
    }
  }

  if (platform === 'facebook' || platform === 'all') {
    try {
      var convos = await metaGetConversations('facebook', body.limit || 10);
      if (convos.success && convos.data?.data) {
        for (var j = 0; j < convos.data.data.length; j++) {
          var convo = convos.data.data[j];
          if (!convo.snippet) continue;
          var participant = convo.participants?.data?.[0];
          if (!participant) continue;

          var aiReply2 = await generateDMReply(participant.name || 'user', 'Facebook', convo.snippet);
          var dmResult = await metaSendDM({ platform: 'facebook', recipientId: participant.id, message: aiReply2 });
          if (dmResult.success) replied++;

          results.push({ username: participant.name, userId: participant.id, message: convo.snippet, reply: aiReply2, ...dmResult });
        }
      }
    } catch(e: any) {
      results.push({ platform: 'facebook', error: e.message });
    }
  }

  return { success: replied > 0, replied, total: results.length, results };
}

// === COLD DM ===
async function coldDM(body: any) {
  var platform = body.platform || 'instagram';
  var targets = body.targets || (body.target ? [{ username: body.target, message: body.message }] : []);
  if (!targets.length) return { success: false, error: 'targets necessario (array de {username, message?}) ou target + message' };

  var results: any[] = [];
  var sent = 0;
  var failed = 0;

  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var msg = t.message || body.message || '';
    var r: any;

    if (!msg && body.aiGenerate !== false) {
      msg = await generateAIResponse('@' + t.username + ' — ' + (body.context || 'prospecto') + (body.objective ? '. Objectivo: ' + body.objective : ''), {
        systemPrompt: getColdDMSystemPrompt(),
        maxTokens: 150,
        temperature: 0.8,
        context: { platform, username: t.username, bio: t.bio, category: t.category },
      });
    }
    if (!msg) { results.push({ target: t.username, success: false, error: 'Mensagem vazia' }); failed++; continue; }

    if (platform === 'instagram') {
      r = await igSendDMByUsername(t.username, msg);
    } else if (platform === 'facebook') {
      if (t.userId) {
        r = await metaSendDM({ platform: 'facebook', recipientId: t.userId, message: msg });
      } else {
        r = { success: false, error: 'userId necessario para Facebook cold DM' };
      }
    } else {
      r = { success: false, error: 'Plataforma nao suportada' };
    }

    if (r.success) sent++; else failed++;
    results.push({ target: t.username, message: msg, ...r });

    try {
      await db.automationLog.create({ data: { type: 'cold_dm', action: r.success ? 'sent' : 'failed', platform, targetName: t.username, status: r.success ? 'completed' : 'failed', result: msg.slice(0, 200) } });
    } catch(e) {}

    if (i < targets.length - 1) {
      var delay = body.delay || 30000;
      var jitter = delay + Math.floor(Math.random() * 10000);
      console.log('[ColdDM] Pacing: ' + Math.round(jitter/1000) + 's...');
      await new Promise(function(resolve) { setTimeout(resolve, jitter); });
    }
  }

  return { success: sent > 0, sent, failed, total: targets.length, results };
}

// === MAIN HANDLER ===
export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  try {
    if (action === 'post') return NextResponse.json(await publishPost(body));
    if (action === 'story') return NextResponse.json(await publishStory(body));
    if (action === 'get_comments') return NextResponse.json(await getComments(body));
    if (action === 'reply_comments') return NextResponse.json(await replyToComments(body));
    if (action === 'auto_reply_dms') return NextResponse.json(await autoReplyDMs(body));
    if (action === 'cold_dm') return NextResponse.json(await coldDM(body));
    if (action === 'ig_stats') return NextResponse.json(await igGetUserStats());
    if (action === 'ig_followers') return NextResponse.json(await igGetFollowers(body));

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch(e: any) {
    console.error('[publish] Error:', e);
    return NextResponse.json({ success: false, error: e.message });
  }
}
