// ============================================================
//  Aura CRON — Comment-to-DM + DM Auto-Reply
//  1. Verifica conversas sem resposta e responde com IA
//  2. Fallback caso webhook falhe
//  3. Comment-to-DM: Zernio automation envia DM estatico quando
//     alguem comenta. Este cron garante que todas as conversas
//     recebem resposta IA mesmo se o webhook falhar.
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';
import { CRON_SECRET } from '@/lib/config';
import { generateDMReply } from '@/lib/ai';
import { zernioListConversations, zernioGetConversationMessages, zernioSendDM, zernioListAccounts } from '@/lib/zernio';

export var maxDuration = 120;

// Cache de contas Zernio
var accountMapCache: Record<string, string> = {};
async function getAccountMap() {
  if (Object.keys(accountMapCache).length > 0) return accountMapCache;
  try {
    var result = await zernioListAccounts();
    if (result.success && result.data?.accounts) {
      for (var acc of result.data.accounts) {
        accountMapCache[acc.platform] = acc._id;
      }
    }
  } catch (e) { /* use cache */ }
  return accountMapCache;
}

async function runAutoReply(): Promise<any> {
  var stats = { conversationsChecked: 0, repliesSent: 0, errors: [] as string[] };

  try {
    await ensureDatabase();
    var accountMap = await getAccountMap();

    // Buscar conversas recentes de ambas plataformas
    for (var platform of ['instagram', 'facebook']) {
      try {
        var convResult = await zernioListConversations({ platform, limit: 20 });
        if (!convResult.success) { stats.errors.push(platform + ': ' + convResult.error); continue; }

        var conversations = convResult.data?.conversations || convResult.data || [];
        if (!Array.isArray(conversations)) conversations = [];

        for (var conv of conversations) {
          var convId = conv.id;
          if (!convId) continue;
          stats.conversationsChecked++;

          // Verificar ultima mensagem nossa
          var lastMessage = conv.lastMessage || conv.snippet || '';
          var lastMessageAt = conv.lastMessageAt || conv.updatedAt || '';
          var isFromUs = conv.lastMessageDirection === 'outgoing' || conv.lastMessageFromMe === true;

          // Se a ultima mensagem e nossa, skip
          if (isFromUs) continue;

          // Verificar se ja respondemos recentemente (5 min)
          if (lastMessageAt) {
            var msgTime = new Date(lastMessageAt).getTime();
            if (Date.now() - msgTime > 600000) continue; // mais de 10 min, ja passou
          }

          // Buscar mensagens da conversa para ter contexto
          var msgResult = await zernioGetConversationMessages(convId, { limit: 10 });
          if (!msgResult.success) continue;

          var messages = msgResult.data?.messages || msgResult.data || [];
          if (!Array.isArray(messages)) messages = [];

          // Encontrar a ultima mensagem recebida
          var lastInbound = '';
          var senderName = '';
          for (var i = messages.length - 1; i >= 0; i--) {
            var m = messages[i];
            if (m.direction === 'inbound' || m.fromMe === false) {
              lastInbound = m.text || m.content || '';
              senderName = m.sender?.username || m.sender?.name || conv.participantName || '';
              break;
            }
          }

          if (!lastInbound || lastInbound.length < 2) continue;

          // Verificar se ja temos resposta outbound recente no DB
          var recentOutbound = await db.message.findFirst({
            where: {
              direction: 'outbound',
              platform: platform,
            },
            orderBy: { sentAt: 'desc' },
          });
          if (recentOutbound && Date.now() - recentOutbound.sentAt.getTime() < 300000) continue;

          // Gerar resposta IA
          var aiReply = await generateDMReply(senderName, platform, lastInbound);
          if (!aiReply) continue;

          // Enviar
          var accountId = accountMap[platform];
          if (!accountId) continue;

          var sendResult = await zernioSendDM(convId, accountId, aiReply);
          if (sendResult.success) {
            stats.repliesSent++;
            // Log the reply (no prospectId needed for cron auto-replies)
            try {
              var autoProspect = await db.prospect.findFirst({ where: { platform, username: senderName } });
              if (autoProspect) {
                await db.message.create({
                  data: { prospectId: autoProspect.id, direction: 'outbound', content: aiReply, platform },
                });
              }
            } catch(logErr) {}
          } else {
            stats.errors.push('send: ' + (sendResult.error || '').slice(0, 100));
          }
        }
      } catch (e: any) {
        stats.errors.push(platform + ' loop: ' + e.message);
      }
    }
  } catch (e: any) {
    stats.errors.push('Geral: ' + e.message);
  }

  return stats;
}

// GET — Vercel/Railway Cron
export async function GET(request: Request) {
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    var startTime = Date.now();
    var stats = await runAutoReply();
    var duration = Date.now() - startTime;

    await db.automationLog.create({
      data: {
        type: 'cron_dm_auto_reply',
        action: 'auto_reply_cycle',
        platform: 'multi',
        status: stats.errors.length === 0 ? 'success' : 'partial',
        result: JSON.stringify({ ...stats, duration: duration + 'ms' }),
      },
    });

    return NextResponse.json({ success: true, cron: 'dm_auto_reply', timestamp: new Date().toISOString(), duration: duration + 'ms', data: stats });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST — acionar manualmente
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var secret = body.secret || '';
  if (secret !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  var stats = await runAutoReply();
  return NextResponse.json({ success: true, cron: 'dm_auto_reply', data: stats });
}