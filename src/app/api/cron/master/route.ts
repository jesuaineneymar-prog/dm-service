// ============================================================
//  Aura MASTER CRON — runs ALL autonomous cycles
//  Called by Vercel cron (daily backup) + external pinger (every 5 min)
//  This is the 24/7 heartbeat of Aura
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';
import { CRON_SECRET } from '@/lib/config';

export var maxDuration = 300; // 5 minutes max

// Self-contained DM monitor
async function cycleDMMonitor(): Promise<any> {
  var { zernioListAccounts, zernioListConversations, zernioGetConversationMessages, zernioSendDM } = await import('@/lib/zernio');
  var { generateDMReply } = await import('@/lib/ai');

  var results: any = { newMessages: 0, autoReplied: 0, errors: [] as string[] };

  try {
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) { results.errors.push('accounts: ' + (accountsRes.error || '')); return results; }

    var accountsData = accountsRes.data;
    var accounts: any[] = Array.isArray(accountsData) ? accountsData : (accountsData?.accounts || []);

    for (var pi = 0; pi < 2; pi++) {
      var platform = pi === 0 ? 'instagram' : 'facebook';
      try {
        var convRes = await zernioListConversations({ platform, limit: 20 });
        if (!convRes.success) { results.errors.push(platform + ': ' + (convRes.error || '')); continue; }

        var convData = convRes.data;
        var conversations: any[] = Array.isArray(convData) ? convData : (convData?.data || convData?.conversations || []);

        for (var ci = 0; ci < conversations.length; ci++) {
          var conv = conversations[ci];
          if ((conv.unreadCount || 0) === 0) continue;

          var convId = conv.id;
          var accountId = conv.accountId || accounts.find(function(a: any) { return a.platform === platform; })?.id || '';
          if (!accountId || !convId) continue;

          var msgRes = await zernioGetConversationMessages(convId, { limit: 5 });
          if (!msgRes.success) continue;

          var msgData = msgRes.data;
          var messages: any[] = Array.isArray(msgData) ? msgData : (msgData?.data || msgData?.messages || []);

          for (var mi = messages.length - 1; mi >= 0; mi--) {
            var msg = messages[mi];
            if (msg.sender?.platformAccountId === accountId || msg.direction === 'outgoing') continue;

            results.newMessages++;
            var senderName = msg.sender?.username || msg.sender?.name || 'unknown';
            var messageText = msg.text || '';

            var prospect = await db.prospect.findFirst({ where: { platform, username: senderName } });
            if (!prospect && senderName !== 'unknown') {
              prospect = await db.prospect.create({
                data: { platform, username: senderName, displayName: msg.sender?.name || null, status: 'new', externalId: convId },
              });
            }

            if (prospect) {
              await db.message.create({ data: { prospectId: prospect.id, direction: 'inbound', content: messageText || '(media)', platform } });
              await db.prospect.update({ where: { id: prospect.id }, data: { lastRepliedAt: new Date(), lastContactedAt: new Date(), status: prospect.status === 'new' ? 'contacted' : 'responded' } });
            }

            await db.notification.create({ data: { type: 'dm_reply', title: '@' + senderName + ' respondeu no ' + platform, message: messageText.slice(0, 120), platform, sourceId: convId } });

            if (prospect && messageText.length > 0) {
              var aiReply = await generateDMReply(senderName, platform, messageText, prospect);
              var sendRes = await zernioSendDM(convId, accountId, aiReply);
              if (sendRes.success) {
                results.autoReplied++;
                await db.message.create({ data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform } });
                await db.automationLog.create({ data: { type: 'master_cron', action: 'auto_reply_dm', platform, targetName: senderName, status: 'success', result: aiReply.slice(0, 200), completedAt: new Date() } });
              } else {
                await db.automationLog.create({ data: { type: 'master_cron', action: 'auto_reply_dm', platform, targetName: senderName, status: 'failed', result: sendRes.error || 'falhou' } });
              }
            }
            break;
          }
        }
      } catch (e: any) {
        results.errors.push(platform + ': ' + e.message);
      }
    }
  } catch (e: any) {
    results.errors.push('geral: ' + e.message);
  }

  return results;
}

// Self-contained publish cycle
async function cyclePublish(): Promise<any> {
  var UPLOADPOST_KEY = process.env.UPLOADPOST_KEY || '';
  var results: any = { checked: 0, published: 0, errors: [] as string[] };

  if (!UPLOADPOST_KEY) { results.errors.push('UPLOADPOST_KEY nao configurada'); return results; }

  var duePosts = await db.scheduledPost.findMany({
    where: { status: 'pending', scheduledFor: { lte: new Date() } },
    include: { contentPost: true },
    orderBy: { scheduledFor: 'asc' },
    take: 10,
  });

  results.checked = duePosts.length;

  for (var i = 0; i < duePosts.length; i++) {
    var sp = duePosts[i];
    var content = sp.contentPost;
    if (!content) { await db.scheduledPost.update({ where: { id: sp.id }, data: { status: 'failed' } }); continue; }

    try {
      var upUrl = 'https://api.upload-post.com/api/upload_text';
      var upBody = 'user=jarvis&title=' + encodeURIComponent(content.caption || '') + '&platform[]=' + sp.platforms;
      var res = await fetch(upUrl, { method: 'POST', headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: upBody });
      var json = await res.json();

      if (res.ok && (json.id || json.request_id)) {
        await db.scheduledPost.update({ where: { id: sp.id }, data: { status: 'published', uploadPostId: json.id || json.request_id } });
        await db.contentPost.update({ where: { id: content.id }, data: { publishedAt: new Date(), status: 'published' } });
        await db.analyticsEvent.create({ data: { platform: sp.platforms, eventType: 'post_published', metricValue: 1, metadata: JSON.stringify({ scheduledPostId: sp.id, uploadPostId: json.id || json.request_id }) } });
        await db.automationLog.create({ data: { type: 'master_cron', action: 'published_post', platform: sp.platforms, targetName: content.caption.slice(0, 50), status: 'success', result: 'UploadPost ID: ' + (json.id || json.request_id), completedAt: new Date() } });
        results.published++;
      } else {
        await db.scheduledPost.update({ where: { id: sp.id }, data: { status: 'failed' } });
        results.errors.push(sp.id + ': HTTP ' + res.status);
      }
    } catch (e: any) {
      await db.scheduledPost.update({ where: { id: sp.id }, data: { status: 'failed' } });
      results.errors.push(sp.id + ': ' + e.message);
    }
  }

  return results;
}

// Self-contained follow-up cycle
async function cycleFollowUps(): Promise<any> {
  var { zernioListAccounts, zernioListConversations, zernioSendDM } = await import('@/lib/zernio');
  var results: any = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) { results.errors.push('Zernio: ' + (accountsRes.error || '')); return results; }
    var accounts: any[] = Array.isArray(accountsRes.data) ? accountsRes.data : (accountsRes.data?.accounts || []);

    var dueFollowUps = await db.followUp.findMany({
      where: { status: 'pending', scheduledAt: { lte: new Date() } },
      include: { prospect: true },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    if (dueFollowUps.length === 0) return results;

    var allConvs: Record<string, any[]> = {};
    var platformsNeeded = [...new Set(dueFollowUps.map(function(fu: any) { return fu.prospect.platform || 'instagram'; }))];
    for (var pi = 0; pi < platformsNeeded.length; pi++) {
      var plat = platformsNeeded[pi];
      var convRes = await zernioListConversations({ platform: plat, limit: 100 });
      if (convRes.success) {
        var cd = convRes.data;
        allConvs[plat] = Array.isArray(cd) ? cd : (cd?.data || cd?.conversations || []);
      }
    }

    for (var i = 0; i < dueFollowUps.length; i++) {
      var fu = dueFollowUps[i];
      var prospect = fu.prospect;
      results.processed++;
      var platform = prospect.platform || 'instagram';
      var conversations = allConvs[platform] || [];
      var matchingConv = conversations.find(function(c: any) { var pName = c.participant?.name || c.participant?.username || ''; return pName.toLowerCase() === prospect.username.toLowerCase(); });

      if (!matchingConv) { await db.followUp.update({ where: { id: fu.id }, data: { status: 'failed', result: 'No conversation' } }); continue; }
      var accountId = matchingConv.accountId || accounts.find(function(a: any) { return a.platform === platform; })?.id || '';
      if (!accountId) { await db.followUp.update({ where: { id: fu.id }, data: { status: 'failed', result: 'No accountId' } }); continue; }

      var msg = fu.message || 'Ola ' + (prospect.displayName || '@' + prospect.username) + ', a Mwango Brain tem novidades!';
      var sendRes = await zernioSendDM(matchingConv.id, accountId, msg);

      if (sendRes.success) {
        results.sent++;
        await db.followUp.update({ where: { id: fu.id }, data: { status: 'sent', sentAt: new Date(), result: 'Sent' } });
        await db.message.create({ data: { prospectId: prospect.id, direction: 'outbound', content: msg, platform } });
        await db.prospect.update({ where: { id: prospect.id }, data: { lastContactedAt: new Date(), status: 'contacted' } });
        await db.automationLog.create({ data: { type: 'master_cron', action: 'follow_up_sent', platform, targetName: prospect.username, status: 'success', completedAt: new Date() } });
      } else {
        await db.followUp.update({ where: { id: fu.id }, data: { status: 'failed', result: sendRes.error || 'Send failed' } });
      }
    }
  } catch (e: any) {
    results.errors.push(e.message);
  }

  return results;
}

// Multi-touch follow-up sequence creator (1d, 3d, 7d escalating intervals)
async function createFollowUpSequence(prospectId: string, displayName: string, username: string): Promise<number> {
  var created = 0;
  var templates = [
    { days: 1, msg: 'Ola ' + (displayName || '@' + username) + ', ja pensou em como a Mwango Brain pode ajudar o teu negocio?' },
    { days: 3, msg: '@' + username + ', temos casos de sucesso em negocios como o teu. Podemos conversar 5 min?' },
    { days: 7, msg: 'Ultima tentativa — ' + (displayName || '@' + username) + ', se quiseres crescer a tua presenca digital, estamos aqui.' },
  ];
  for (var t of templates) {
    var existing = await db.followUp.findFirst({ where: { prospectId, status: 'pending' } });
    if (existing) break;
    var scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + t.days);
    await db.followUp.create({
      data: { prospectId, scheduledAt: scheduledDate, message: t.msg },
    });
    created++;
  }
  return created;
}

// Self-contained analytics snapshot + auto follow-up creation
async function cycleAnalytics(): Promise<any> {
  var results: any = { instagram: null, facebook: null, autoFollowUpsCreated: 0 };

  // TODO: replace HikerAPI snapshot with Zernio or ScrapingBee
  results.instagram = { error: 'HikerAPI removido' };


  // Auto-create follow-up sequences for cold prospects
  try {
    var threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    var coldProspects = await db.prospect.findMany({
      where: { status: { in: ['contacted', 'responded', 'new'] }, OR: [{ lastContactedAt: { lt: threeDaysAgo } }, { lastContactedAt: null }] },
      include: { followUps: true },
    });
    for (var i = 0; i < coldProspects.length; i++) {
      var p = coldProspects[i];
      var hasPending = p.followUps.some(function(fu: any) { return fu.status === 'pending'; });
      if (hasPending) continue;
      var seqCreated = await createFollowUpSequence(p.id, p.displayName || '', p.username);
      results.autoFollowUpsCreated += seqCreated;
    }
  } catch (e) { /* silent */ }

  return results;
}

// ============================================================
//  MASTER CRON HANDLER
// ============================================================

async function runMasterCycle(): Promise<any> {
  var startTime = Date.now();
  var results: any = { dmMonitor: null, publish: null, followUps: null, analytics: null, metaToken: null, totalDuration: 0 };

  // Meta token monitor (lightweight check)
  async function cycleMetaToken(): Promise<any> {
    try {
      var { debugMetaToken } = await import('@/lib/meta-token-manager');
      var pageToken = await db.systemSetting.findUnique({ where: { key: 'meta_page_token' } });
      if (!pageToken?.value) return { status: 'no_token' };
      var check = await debugMetaToken(pageToken.value);
      if (!check.isValid) {
        await db.systemSetting.upsert({ where: { key: 'meta_token_alert' }, update: { value: JSON.stringify({ timestamp: new Date().toISOString(), level: 'critical', message: 'Page token Meta invalido!' }) }, create: { key: 'meta_token_alert', value: JSON.stringify({ timestamp: new Date().toISOString(), level: 'critical', message: 'Page token Meta invalido!' }) } });
      } else {
        await db.systemSetting.upsert({ where: { key: 'meta_token_alert' }, update: { value: '' }, create: { key: 'meta_token_alert', value: '' } });
      }
      return { status: check.isValid ? 'valid' : 'invalid' };
    } catch(e: any) { return { status: 'error', error: e.message }; }
  }

  var [dmResult, publishResult, followUpResult, analyticsResult, metaTokenResult] = await Promise.allSettled([
    cycleDMMonitor(),
    cyclePublish(),
    cycleFollowUps(),
    cycleAnalytics(),
    cycleMetaToken(),
  ]);

  results.dmMonitor = dmResult.status === 'fulfilled' ? dmResult.value : { error: dmResult.reason?.message };
  results.publish = publishResult.status === 'fulfilled' ? publishResult.value : { error: publishResult.reason?.message };
  results.followUps = followUpResult.status === 'fulfilled' ? followUpResult.value : { error: followUpResult.reason?.message };
  results.analytics = analyticsResult.status === 'fulfilled' ? analyticsResult.value : { error: analyticsResult.reason?.message };
  results.metaToken = metaTokenResult.status === 'fulfilled' ? metaTokenResult.value : { error: metaTokenResult.reason?.message };
  results.totalDuration = Date.now() - startTime;

  try {
    await db.automationLog.create({
      data: { type: 'master_cron', action: 'full_cycle', platform: 'all', status: 'success', result: JSON.stringify({ dm: results.dmMonitor?.newMessages, published: results.publish?.published, followUps: results.followUps?.sent, duration: results.totalDuration + 'ms' }), completedAt: new Date() },
    });
  } catch (e) { /* silent */ }

  return results;
}

// GET — called by Vercel Cron + external pingers
export async function GET(request: Request) {
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  // Allow external pingers without full auth (just needs x-pinger header)
  var isPinger = request.headers.get('x-pinger') === 'aura-247';
  if (!isValid && !isPinger) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    var cycleResults = await runMasterCycle();
    return NextResponse.json({ success: true, cron: 'master', version: '4.1', timestamp: new Date().toISOString(), uptime: true, data: cycleResults });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST — manual trigger with secret
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  if (body.secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  var results = await runMasterCycle();
  return NextResponse.json({ success: true, cron: 'master', version: '4.1', data: results });
}
