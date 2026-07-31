// ============================================================
//  JARVIS AUTONOMOUS ENGINE — sistema 100% autonomo e onipresente
//  - Monitoriza DMs em tempo real (Zernio polling)
//  - Responde automaticamente com IA
//  - Follow-ups automaticos apos 3 dias
//  - Notificacoes de novas respostas
//  - Activo em IG + FB + TT simultaneamente
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  zernioListConversations,
  zernioGetConversationMessages,
  zernioSendDM,
  zernioListAccounts,
} from '@/lib/zernio';

import { requireAuth } from '@/lib/auth';
import { generateDMReply, generateContent } from '@/lib/ai';
import { getTikTokStatus } from '@/lib/tiktok-engine';
import { monitorTikTokDMs } from '@/app/cmd/tiktok/route';

export var maxDuration = 120;

// Check unread messages and auto-respond
async function monitorAndRespond(): Promise<any> {
  var results: any = { newMessages: 0, autoReplied: 0, notifications: 0, errors: [] as string[] };

  try {
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) {
      results.errors.push('Zernio accounts: ' + (accountsRes.error || 'falhou'));
      return results;
    }

    var accountsData = accountsRes.data;
    var accounts: any[] = [];
    if (Array.isArray(accountsData)) accounts = accountsData;
    else if (accountsData?.accounts) accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];

    var platforms = ['instagram', 'facebook'];
    for (var pi = 0; pi < platforms.length; pi++) {
      var platform = platforms[pi];

      var convRes = await zernioListConversations({ platform: platform, limit: 20 });
      if (!convRes.success) {
        results.errors.push(platform + ' conversations: ' + (convRes.error || 'falhou'));
        continue;
      }

      var convData = convRes.data;
      var conversations: any[] = [];
      if (Array.isArray(convData)) conversations = convData;
      else if (convData?.data) conversations = Array.isArray(convData.data) ? convData.data : [];
      else if (convData?.conversations) conversations = Array.isArray(convData.conversations) ? convData.conversations : [];

      for (var ci = 0; ci < conversations.length; ci++) {
        var conv = conversations[ci];
        var unreadCount = conv.unreadCount || 0;
        if (unreadCount === 0) continue;

        var convId = conv.id;
        var accountId = conv.accountId || accounts.find(function(a: any) { return a.platform === platform; })?.id || '';
        if (!accountId || !convId) continue;

        var msgRes = await zernioGetConversationMessages(convId, { limit: 5 });
        if (!msgRes.success) continue;

        var msgData = msgRes.data;
        var messages: any[] = [];
        if (Array.isArray(msgData)) messages = msgData;
        else if (msgData?.data) messages = Array.isArray(msgData.data) ? msgData.data : [];
        else if (msgData?.messages) messages = Array.isArray(msgData.messages) ? msgData.messages : [];

        for (var mi = messages.length - 1; mi >= 0; mi--) {
          var msg = messages[mi];
          var isFromMe = msg.sender?.platformAccountId === accountId || msg.direction === 'outgoing';
          if (isFromMe) continue;

          results.newMessages++;
          var senderName = msg.sender?.username || msg.sender?.name || 'unknown';
          var messageText = msg.text || '';

          var prospect = await db.prospect.findFirst({
            where: { platform: platform, username: senderName },
          });

          if (!prospect && senderName !== 'unknown') {
            prospect = await db.prospect.create({
              data: {
                platform: platform,
                username: senderName,
                displayName: msg.sender?.name || null,
                status: 'new',
                externalId: convId,
              },
            });
          }

          if (prospect) {
            await db.message.create({
              data: { prospectId: prospect.id, direction: 'inbound', content: messageText || '(midia)', platform: platform },
            });
            await db.prospect.update({
              where: { id: prospect.id },
              data: { lastRepliedAt: new Date(), lastContactedAt: new Date(), status: prospect.status === 'new' ? 'contacted' : 'responded' },
            });
          }

          await db.notification.create({
            data: {
              type: 'dm_reply',
              title: '@' + senderName + ' respondeu no ' + platform,
              message: messageText.slice(0, 120),
              platform: platform,
              sourceId: convId,
            },
          });
          results.notifications++;

          // AUTO-REPLY
          if (prospect && messageText.length > 0) {
            var aiReply = await generateDMReply(senderName, platform, messageText, prospect);
            var sendRes = await zernioSendDM(convId, accountId, aiReply);
            if (sendRes.success) {
              results.autoReplied++;
              await db.message.create({
                data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform: platform },
              });
              await db.automationLog.create({
                data: { type: 'auto_reply', action: 'dm_response', platform: platform, targetId: prospect.id, targetName: senderName, status: 'success', result: aiReply.slice(0, 200), completedAt: new Date() },
              });
            } else {
              await db.automationLog.create({
                data: { type: 'auto_reply', action: 'dm_response', platform: platform, targetId: prospect.id, targetName: senderName, status: 'failed', result: sendRes.error || 'falhou' },
              });
            }
          }
          break; // Only process latest unread per conversation
        }
      }
    }
  } catch (e: any) {
    results.errors.push(e.message);
  }

  return results;
}

// Process pending follow-ups (3+ days without contact)
async function processFollowUps(): Promise<any> {
  var results: any = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) { results.errors.push('Zernio: ' + (accountsRes.error || '')); return results; }

    var accountsData = accountsRes.data;
    var accounts: any[] = Array.isArray(accountsData) ? accountsData : (accountsData?.accounts || []);

    var dueFollowUps = await db.followUp.findMany({
      where: { status: 'pending', scheduledAt: { lte: new Date() } },
      include: { prospect: true },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    });

    if (dueFollowUps.length === 0) return results;

    // BATCH: Fetch all conversations for each platform ONCE (not per follow-up)
    var allConversations: Record<string, any[]> = {};
    var platformsNeeded = [...new Set(dueFollowUps.map(function(fu: any) { return fu.prospect.platform || 'instagram'; }))];
    for (var pi = 0; pi < platformsNeeded.length; pi++) {
      var plat = platformsNeeded[pi];
      var convRes = await zernioListConversations({ platform: plat, limit: 100 });
      if (convRes.success) {
        var convData = convRes.data;
        allConversations[plat] = Array.isArray(convData) ? convData : (convData?.data || convData?.conversations || []);
      } else {
        allConversations[plat] = [];
      }
    }

    for (var i = 0; i < dueFollowUps.length; i++) {
      var fu = dueFollowUps[i];
      var prospect = fu.prospect;
      results.processed++;

      var followUpMessage = fu.message || 'Ola ' + (prospect.displayName || '@' + prospect.username) + ', passei para saber se ainda tens interesse nos nossos servicos. A Mwango Brain tem novidades!';
      var platform = prospect.platform || 'instagram';

      // Use pre-fetched conversations (no API call per follow-up!)
      var conversations = allConversations[platform] || [];

      var matchingConv = conversations.find(function(c: any) {
        var pName = c.participant?.name || c.participant?.username || '';
        return pName.toLowerCase() === prospect.username.toLowerCase();
      });

      if (!matchingConv) {
        await db.followUp.update({ where: { id: fu.id }, data: { status: 'failed', result: 'No conversation found' } });
        continue;
      }

      var accountId = matchingConv.accountId || accounts.find(function(a: any) { return a.platform === platform; })?.id || '';
      if (!accountId) {
        await db.followUp.update({ where: { id: fu.id }, data: { status: 'failed', result: 'No account ID' } });
        continue;
      }

      var sendRes = await zernioSendDM(matchingConv.id, accountId, followUpMessage);
      if (sendRes.success) {
        results.sent++;
        await db.followUp.update({ where: { id: fu.id }, data: { status: 'sent', sentAt: new Date(), result: 'Sent via Zernio' } });
        await db.message.create({ data: { prospectId: prospect.id, direction: 'outbound', content: followUpMessage, platform: platform } });
        await db.prospect.update({ where: { id: prospect.id }, data: { lastContactedAt: new Date(), status: 'contacted' } });
        await db.automationLog.create({ data: { type: 'follow_up', action: 'auto_followup_3days', platform, targetId: prospect.id, targetName: prospect.username, status: 'success', result: 'Follow-up enviado', completedAt: new Date() } });

        // Schedule next follow-up ONLY if prospect is not converted/lost
        if (prospect.status !== 'converted' && prospect.status !== 'lost' && prospect.status !== 'not_interested') {
          var nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + 7);
          await db.followUp.create({
            data: { prospectId: prospect.id, scheduledAt: nextDate, message: 'Lembrete: @' + prospect.username + ', queremos mesmo trabalhar contigo!' },
          });
        }
      } else {
        await db.followUp.update({ where: { id: fu.id }, data: { status: 'failed', result: sendRes.error || 'Send failed' } });
      }
    }
  } catch (e: any) {
    results.errors.push(e.message);
  }

  return results;
}

// Auto-create follow-ups for prospects 3 days without contact
async function autoCreateFollowUps(): Promise<number> {
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  var prospects = await db.prospect.findMany({
    where: {
      status: { in: ['contacted', 'responded', 'new'] },
      NOT: { status: { in: ['converted', 'lost', 'not_interested'] } },
      OR: [{ lastContactedAt: { lt: threeDaysAgo } }, { lastContactedAt: null }],
    },
    include: { followUps: true },
  });

  var created = 0;
  for (var i = 0; i < prospects.length; i++) {
    var p = prospects[i];
    var hasPending = p.followUps.some(function(fu: any) { return fu.status === 'pending'; });
    if (hasPending) continue;

    var followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 1);

    await db.followUp.create({
      data: {
        prospectId: p.id,
        scheduledAt: followUpDate,
        message: 'Seguimento: Ola ' + (p.displayName || '@' + p.username) + ', a Mwango Brain tem solucoes criativas para ti. Continuamos interessados!',
      },
    });
    created++;
  }

  return created;
}

// Auto-generate weekly report if due
async function autoGenerateReport(): Promise<boolean> {
  try {
    // Check if there is a report this week already
    var weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    var existing = await db.clientReport.findFirst({
      where: { generatedAt: { gte: weekStart } },
    });
    if (existing) return false; // Already generated this week

    // Check settings for report frequency
    var freqSetting = await db.systemSetting.findUnique({ where: { key: 'report_frequency' } });
    var freq = freqSetting?.value || 'weekly';
    if (freq !== 'weekly') return false;

    var clientSetting = await db.systemSetting.findUnique({ where: { key: 'agency_name' } });
    var clientName = clientSetting?.value || 'Mwango Brain';

    var periodStart = new Date(Date.now() - 7 * 86400000).toISOString();
    var periodEnd = new Date().toISOString();

    // Gather metrics
    var postsPublished = await db.contentPost.count({ where: { publishedAt: { gte: new Date(periodStart) } } });
    var analyticsEvents = await db.analyticsEvent.findMany({ where: { recordedAt: { gte: new Date(periodStart) } } });
    var totalLikes = 0; var totalComments = 0;
    for (var i = 0; i < analyticsEvents.length; i++) {
      if (analyticsEvents[i].eventType === 'likes' || analyticsEvents[i].eventType === 'like') totalLikes += analyticsEvents[i].metricValue;
      if (analyticsEvents[i].eventType === 'comments' || analyticsEvents[i].eventType === 'comment') totalComments += analyticsEvents[i].metricValue;
    }
    var totalDMs = await db.message.count({ where: { sentAt: { gte: new Date(periodStart) }, direction: 'inbound' } });
    var newProspects = await db.prospect.count({ where: { createdAt: { gte: new Date(periodStart) } } });
    var conversions = await db.prospect.count({ where: { status: 'converted', updatedAt: { gte: new Date(periodStart) } } });

    var aiSummary = await generateContent(
      'Gera um sumario semanal profissional em portugues para a agencia "' + clientName + '". ' +
      'Metricas: ' + postsPublished + ' posts, ' + Math.round(totalLikes) + ' likes, ' + Math.round(totalComments) + ' comentarios, ' +
      totalDMs + ' DMs, ' + newProspects + ' novos prospects, ' + conversions + ' conversoes. ' +
      'Responde APENAS com 2-3 frases profissionais.'
    );

    await db.clientReport.create({
      data: { clientName, periodStart: new Date(periodStart), periodEnd: new Date(), postsPublished, totalLikes: Math.round(totalLikes), totalComments: Math.round(totalComments), totalDMs, newProspects, conversions, summary: aiSummary },
    });

    await db.notification.create({ data: { type: 'report', title: 'Relatorio semanal gerado', message: 'Relatorio automatico da semana criado com ' + postsPublished + ' posts analisados.', platform: 'system' } });

    return true;
  } catch (e) {
    return false;
  }
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function() { return {}; });
    var action = body.action || '';

    if (action === 'monitor') {
      var monitorResults = await monitorAndRespond();
      return NextResponse.json({ success: true, action: 'monitor', data: monitorResults });
    }

    if (action === 'process_followups') {
      var fuResults = await processFollowUps();
      return NextResponse.json({ success: true, action: 'process_followups', data: fuResults });
    }

    if (action === 'auto_followups') {
      var created = await autoCreateFollowUps();
      return NextResponse.json({ success: true, action: 'auto_followups', data: { created } });
    }

    if (action === 'get_notifications') {
      var notifications = await db.notification.findMany({
        where: body.unreadOnly === true ? { isRead: false } : {},
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ success: true, data: notifications });
    }

    if (action === 'mark_read') {
      if (!body.id) return NextResponse.json({ success: false, error: 'ID necessario' });
      await db.notification.update({ where: { id: body.id }, data: { isRead: true } });
      return NextResponse.json({ success: true });
    }

    if (action === 'mark_all_read') {
      await db.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
      return NextResponse.json({ success: true });
    }

    if (action === 'get_logs') {
      var logs = await db.automationLog.findMany({ orderBy: { triggeredAt: 'desc' }, take: body.limit || 50 });
      return NextResponse.json({ success: true, data: logs });
    }

    if (action === 'full_cycle') {
      var monitorData = await monitorAndRespond();
      var ttData = await monitorTikTokDMs();
      var followUpData = await processFollowUps();
      var autoCreated = await autoCreateFollowUps();
      var reportGenerated = await autoGenerateReport();
      return NextResponse.json({
        success: true, action: 'full_cycle',
        data: { monitor: monitorData, tiktok: ttData, followUps: followUpData, autoCreatedFollowUps: autoCreated, autoReportGenerated: reportGenerated, timestamp: new Date().toISOString() },
      });
    }

    if (action === 'get_stats') {
      var unread = await db.notification.count({ where: { isRead: false } });
      var total = await db.notification.count();
      var pendingFU = await db.followUp.count({ where: { status: 'pending' } });
      var autoTotal = await db.automationLog.count();
      var recent = await db.automationLog.findMany({ orderBy: { triggeredAt: 'desc' }, take: 5 });
      return NextResponse.json({
        success: true, data: {
          unreadNotifications: unread, totalNotifications: total,
          pendingFollowUps: pendingFU, totalAutomations: autoTotal,
          recentActivity: recent.map(function(l: any) { return { type: l.type, action: l.action, platform: l.platform, target: l.targetName, status: l.status, at: l.triggeredAt }; }),
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
