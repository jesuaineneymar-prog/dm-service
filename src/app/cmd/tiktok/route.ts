// ============================================================
//  Aura TIKTOK API — DMs via Zernio (grátis) + ManyChat (opcional)
//  Posting via Upload-Post, Trending via Sociavault, Comments via MCP
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { generateDMReply } from '@/lib/ai';
import {
  tiktokSendDM,
  tiktokGetConversations,
  tiktokSetWelcomeMessage,
  tiktokGetProfileInfo,
  tiktokTriggerFlow,
  getTikTokStatus,
  tiktokDMsViaZernio,
  tiktokSendDMViaZernio,
} from '@/lib/tiktok-engine';
import { ZERNIO_KEY, MANYCHAT_KEY } from '@/lib/config';
import {
  tikTokAutoCycle,
  getTikTokTrending,
  researchTikTokHashtags,
  scrapeTikTokProfile,
  monitorTikTokCompetitors,
} from '@/lib/tiktok-automation';

export var maxDuration = 60;

// === MONITOR TIKTOK DMs — ZERNIO (PRIMARY) + MANYCHAT (FALLBACK) ===
// Chamado pelo autonomous cycle e pelo cron tiktok
export async function monitorTikTokDMs() {
  var results = { newMessages: 0, autoReplied: 0, source: 'none' as string, errors: [] as string[] };

  // PRIMEIRO: Tentar Zernio (grátis, já conectado)
  if (ZERNIO_KEY) {
    try {
      var zernioRes = await tiktokDMsViaZernio();

      if (zernioRes.success && zernioRes.conversations && zernioRes.conversations.length > 0) {
        results.source = 'zernio';
        var accountId = zernioRes.accountId;

        for (var i = 0; i < zernioRes.conversations.length; i++) {
          var conv = zernioRes.conversations[i];
          var unreadCount = conv.unreadCount || 0;
          if (unreadCount === 0) continue;

          var convId = conv.id;
          var senderName = conv.participant?.username || conv.participant?.name || conv.name || 'unknown';

          // Buscar mensagens desta conversa (via Zernio TT)
          var { zernioTTGetMessages } = await import('@/lib/tiktok-engine');
          var msgRes = await zernioTTGetMessages(convId, 5);
          if (!msgRes.success) continue;

          var msgData = msgRes.data;
          var messages: any[] = [];
          if (Array.isArray(msgData)) messages = msgData;
          else if (msgData?.data) messages = Array.isArray(msgData.data) ? msgData.data : [];
          else if (msgData?.messages) messages = Array.isArray(msgData.messages) ? msgData.messages : [];

          // Processar última mensagem não lida
          for (var mi = messages.length - 1; mi >= 0; mi--) {
            var msg = messages[mi];
            var isFromMe = msg.sender?.platformAccountId === accountId || msg.direction === 'outgoing';
            if (isFromMe) continue;

            results.newMessages++;
            var messageText = msg.text || '';

            // Salvar no CRM
            var prospect = await db.prospect.findFirst({ where: { platform: 'tiktok', username: senderName } });
            if (!prospect && senderName !== 'unknown') {
              prospect = await db.prospect.create({
                data: { platform: 'tiktok', username: senderName, displayName: conv.participant?.name || null, status: 'new', externalId: convId },
              });
            }

            if (prospect) {
              await db.message.create({ data: { prospectId: prospect.id, direction: 'inbound', content: messageText || '(midia)', platform: 'tiktok' } });
              await db.prospect.update({ where: { id: prospect.id }, data: { lastRepliedAt: new Date(), lastContactedAt: new Date(), status: prospect.status === 'new' ? 'contacted' : 'responded' } });
            }

            // AI auto-reply via Zernio
            if (prospect && messageText.length > 0) {
              var aiReply = await generateDMReply(senderName, 'tiktok', messageText, prospect);
              var sendRes = await tiktokSendDMViaZernio(convId, accountId, aiReply);

              if (sendRes.success) {
                results.autoReplied++;
                await db.message.create({ data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform: 'tiktok' } });
                await db.automationLog.create({
                  data: { type: 'auto_reply', action: 'tiktok_dm_response', platform: 'tiktok', targetId: prospect.id, targetName: senderName, status: 'success', result: aiReply.slice(0, 200), completedAt: new Date() },
                });
              } else {
                await db.automationLog.create({
                  data: { type: 'auto_reply', action: 'tiktok_dm_response', platform: 'tiktok', targetId: prospect.id, targetName: senderName, status: 'failed', result: sendRes.error || 'falhou' },
                });
              }
            }
            break; // Só processar a última mensagem por conversa
          }
        }

        return results;
      } else if (zernioRes.success && (!zernioRes.conversations || zernioRes.conversations.length === 0)) {
        // Zernio não tem conta TikTok conectada — sem erro, só sem dados
        results.source = 'zernio_no_tiktok_account';
        results.errors.push('Zernio activo mas sem conta TikTok conectada. Conecta em zernio.com/dashboard');
      } else {
        results.errors.push('Zernio: ' + (zernioRes.error || 'falhou'));
      }
    } catch (e: any) {
      results.errors.push('Zernio TikTok: ' + e.message);
    }
  }

  // FALLBACK: ManyChat (se disponível)
  if (results.newMessages === 0 && MANYCHAT_KEY) {
    try {
      results.source = 'manychat';
      var convRes = await tiktokGetConversations(20);
      if (!convRes.success || !convRes.data) {
        results.errors.push('ManyChat: ' + (convRes.error || '?'));
        return results;
      }

      var conversations: any[] = [];
      if (Array.isArray(convRes.data)) conversations = convRes.data;
      else if (convRes.data?.conversations) conversations = convRes.data.conversations;
      else if (convRes.data?.data) conversations = Array.isArray(convRes.data.data) ? convRes.data.data : [];

      for (var i = 0; i < conversations.length; i++) {
        var conv = conversations[i];
        var unreadCount = conv.unreadCount || conv.unread || 0;
        if (unreadCount === 0) continue;

        var senderName = conv.participant?.username || conv.participant?.name || conv.name || 'unknown';
        var lastMessage = conv.lastMessage?.text || conv.lastMessage || '';
        if (!lastMessage) continue;

        results.newMessages++;

        var prospect = await db.prospect.findFirst({ where: { platform: 'tiktok', username: senderName } });
        if (!prospect && senderName !== 'unknown') {
          prospect = await db.prospect.create({
            data: { platform: 'tiktok', username: senderName, displayName: conv.participant?.name || null, status: 'new', externalId: conv.id },
          });
        }

        if (prospect) {
          await db.message.create({ data: { prospectId: prospect.id, direction: 'inbound', content: lastMessage, platform: 'tiktok' } });
        }

        var aiReply = await generateDMReply(senderName, 'tiktok', lastMessage, prospect);
        var dmResult = await tiktokSendDM({ recipientId: conv.participant?.id || conv.id, message: aiReply });
        if (dmResult.success) {
          results.autoReplied++;
          if (prospect) {
            await db.message.create({ data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform: 'tiktok' } });
            await db.prospect.update({ where: { id: prospect.id }, data: { lastContactedAt: new Date(), status: 'responded' } });
          }
          await db.automationLog.create({
            data: { type: 'auto_reply', action: 'tiktok_dm_response', platform: 'tiktok', targetId: prospect?.id, targetName: senderName, status: 'success', result: aiReply.slice(0, 200), completedAt: new Date() },
          });
        }
      }
    } catch (e: any) {
      results.errors.push('ManyChat TikTok: ' + e.message);
    }
  }

  // Se nenhum dos dois está disponível
  if (results.source === 'none') {
    results.errors.push('Sem Zernio nem ManyChat configurados para TikTok DMs');
  }

  return results;
}

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'get_status') {
      var status = getTikTokStatus();
      return NextResponse.json({ success: true, data: status });
    }

    if (action === 'send_dm') {
      if (!body.recipientId || !body.message) return NextResponse.json({ success: false, error: 'recipientId e message necessarios' });
      // Tentar Zernio primeiro
      if (ZERNIO_KEY && body.conversationId && body.accountId) {
        var zResult = await tiktokSendDMViaZernio(body.conversationId, body.accountId, body.message);
        if (zResult.success) return NextResponse.json({ ...zResult, via: 'zernio' });
      }
      // Fallback ManyChat
      var result = await tiktokSendDM({ recipientId: body.recipientId, message: body.message, buttonText: body.buttonText, buttonUrl: body.buttonUrl });
      return NextResponse.json(result);
    }

    if (action === 'get_conversations') {
      // Tentar Zernio primeiro
      if (ZERNIO_KEY) {
        var zernioRes = await tiktokDMsViaZernio();
        if (zernioRes.success) return NextResponse.json({ ...zernioRes, via: 'zernio' });
      }
      // Fallback ManyChat
      var convs = await tiktokGetConversations(body.limit || 50);
      return NextResponse.json(convs);
    }

    if (action === 'set_welcome') {
      if (!body.message) return NextResponse.json({ success: false, error: 'Mensagem necessaria' });
      var welcome = await tiktokSetWelcomeMessage(body.message);
      return NextResponse.json(welcome);
    }

    if (action === 'get_profile') {
      var profile = await tiktokGetProfileInfo();
      return NextResponse.json(profile);
    }

    if (action === 'trigger_flow') {
      if (!body.recipientId || !body.flowId) return NextResponse.json({ success: false, error: 'recipientId e flowId necessarios' });
      var flow = await tiktokTriggerFlow({ recipientId: body.recipientId, flowId: body.flowId });
      return NextResponse.json(flow);
    }

    if (action === 'monitor') {
      var monitorData = await monitorTikTokDMs();
      return NextResponse.json({ success: true, data: monitorData });
    }

    if (action === 'auto_cycle') {
      var cycleResult = await tikTokAutoCycle();
      return NextResponse.json({ success: true, data: cycleResult });
    }

    if (action === 'trending') {
      var trending = await getTikTokTrending();
      return NextResponse.json(trending);
    }

    if (action === 'research_hashtags') {
      if (!body.topic) return NextResponse.json({ success: false, error: 'Topico necessario' });
      var tags = await researchTikTokHashtags(body.topic);
      return NextResponse.json(tags);
    }

    if (action === 'scrape_profile') {
      if (!body.username) return NextResponse.json({ success: false, error: 'Username necessario' });
      var scrapeProfile = await scrapeTikTokProfile(body.username);
      return NextResponse.json(scrapeProfile);
    }

    if (action === 'monitor_competitors') {
      if (!body.competitors || !Array.isArray(body.competitors)) {
        return NextResponse.json({ success: false, error: 'Array de usernames necessario' });
      }
      var compData = await monitorTikTokCompetitors(body.competitors);
      return NextResponse.json(compData);
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
