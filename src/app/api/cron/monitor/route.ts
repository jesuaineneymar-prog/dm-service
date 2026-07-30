// ============================================================
//  JARVIS CRON — Monitorização de DMs (a cada 5 minutos)
//  - Verifica mensagens por ler no Zernio (IG + FB)
//  - Responde automaticamente com IA (Gemini)
//  - Cria/actualiza prospects no CRM
//  - Gera notificações de novas respostas
//  - Regista tudo no AutomationLog
//  Protegido por CRON_SECRET via Vercel Cron
// ============================================================

import { NextResponse } from 'next/server';
import { db, ensureDatabase } from '@/lib/db';
import {
  zernioListAccounts,
  zernioListConversations,
  zernioGetConversationMessages,
  zernioSendDM,
} from '@/lib/zernio';

import { CRON_SECRET, OR_KEY, OR_URL, OR_MODEL, OR_FALLBACK_MODEL } from '@/lib/config';

export var maxDuration = 120;

// Gerar resposta AI para um prospect
async function generateAIResponse(senderName: string, platform: string, messageText: string, prospectContext: any): Promise<string> {
  var systemPrompt = 'Es o assistente virtual da Mwango Brain, uma agencia criativa angolana. FALAS PORTUGUES DE ANGOLA. Responde de forma simpatica e profissional. Mantem respostas curtas (2-3 frases). Nunca digas que es IA. O teu nome e JARVIS. ';

  if (prospectContext) {
    systemPrompt += 'Contexto do prospect: ' + (prospectContext.username || senderName);
    if (prospectContext.notes) systemPrompt += '. Notas: ' + prospectContext.notes;
    if (prospectContext.category) systemPrompt += '. Categoria: ' + prospectContext.category;
    if (prospectContext.bio) systemPrompt += '. Bio: ' + prospectContext.bio.slice(0, 200);
  }

  var messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Mensagem recebida de @' + senderName + ' no ' + platform + ': "' + messageText + '"\n\nResponde de forma natural e simpatica.' },
  ];

  try {
    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OR_KEY,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jarvis-khaki-chi.vercel.app',
        'X-Title': 'JARVIS',
      },
      body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: 200, temperature: 0.7 }),
    });

    if (!res.ok) {
      // Fallback para modelo secundario
      var res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + OR_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://jarvis-khaki-chi.vercel.app',
          'X-Title': 'JARVIS',
        },
        body: JSON.stringify({ model: OR_FALLBACK_MODEL, messages, max_tokens: 200, temperature: 0.7 }),
      });
      var data2 = await res2.json();
      return data2.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || '';
    }

    var data = await res.json();
    return data.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || '';
  } catch (e: any) {
    return 'Obrigado pela mensagem! A Mwango Brain vai ver isso com atencao. Entraremos em contacto em breve.';
  }
}

// Verificar mensagens por ler e responder automaticamente
async function monitorAndRespond(): Promise<any> {
  var results: any = { newMessages: 0, autoReplied: 0, notifications: 0, prospectsCreated: 0, errors: [] as string[], platforms: [] as string[] };

  try {
    // Listar contas Zernio
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) {
      results.errors.push('Zernio accounts: ' + (accountsRes.error || 'falhou'));
      return results;
    }

    var accountsData = accountsRes.data;
    var accounts: any[] = [];
    if (Array.isArray(accountsData)) accounts = accountsData;
    else if (accountsData?.accounts) accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];

    // Monitorizar Instagram e Facebook em paralelo
    var platforms = ['instagram', 'facebook'];

    for (var pi = 0; pi < platforms.length; pi++) {
      var platform = platforms[pi];
      results.platforms.push(platform);

      try {
        var convRes = await zernioListConversations({ platform: platform, limit: 30 });
        if (!convRes.success) {
          results.errors.push(platform + ' conversations: ' + (convRes.error || 'falhou'));
          continue;
        }

        var convData = convRes.data;
        var conversations: any[] = [];
        if (Array.isArray(convData)) conversations = convData;
        else if (convData?.data) conversations = Array.isArray(convData.data) ? convData.data : [];
        else if (convData?.conversations) conversations = Array.isArray(convData.conversations) ? convData.conversations : [];

        var accountForPlatform = accounts.find(function(a: any) { return a.platform === platform; });

        for (var ci = 0; ci < conversations.length; ci++) {
          var conv = conversations[ci];
          var unreadCount = conv.unreadCount || 0;
          if (unreadCount === 0) continue;

          var convId = conv.id;
          var accountId = conv.accountId || accountForPlatform?.id || '';
          if (!accountId || !convId) continue;

          // Buscar mensagens recentes desta conversa
          var msgRes = await zernioGetConversationMessages(convId, { limit: 5 });
          if (!msgRes.success) continue;

          var msgData = msgRes.data;
          var messages: any[] = [];
          if (Array.isArray(msgData)) messages = msgData;
          else if (msgData?.data) messages = Array.isArray(msgData.data) ? msgData.data : [];
          else if (msgData?.messages) messages = Array.isArray(msgData.messages) ? msgData.messages : [];

          // Processar apenas a ultima mensagem nao lida (mais recente)
          for (var mi = messages.length - 1; mi >= 0; mi--) {
            var msg = messages[mi];
            var isFromMe = msg.sender?.platformAccountId === accountId || msg.direction === 'outgoing';
            if (isFromMe) continue;

            results.newMessages++;
            var senderName = msg.sender?.username || msg.sender?.name || 'unknown';
            var messageText = msg.text || '';

            // Verificar se prospect ja existe no CRM
            var prospect = await db.prospect.findFirst({
              where: { platform: platform, username: senderName },
            });

            // Criar prospect se nao existe
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
              results.prospectsCreated++;
            }

            // Guardar mensagem no CRM
            if (prospect) {
              await db.message.create({
                data: {
                  prospectId: prospect.id,
                  direction: 'inbound',
                  content: messageText || '(midia)',
                  platform: platform,
                },
              });

              // Actualizar timestamps e status do prospect
              await db.prospect.update({
                where: { id: prospect.id },
                data: {
                  lastRepliedAt: new Date(),
                  lastContactedAt: new Date(),
                  status: prospect.status === 'new' ? 'contacted' : 'responded',
                },
              });
            }

            // Criar notificacao
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

            // AUTO-REPLY com IA
            if (prospect && messageText.length > 0) {
              var aiReply = await generateAIResponse(senderName, platform, messageText, prospect);
              var sendRes = await zernioSendDM(convId, accountId, aiReply);

              if (sendRes.success) {
                results.autoReplied++;
                await db.message.create({
                  data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform: platform },
                });
                await db.automationLog.create({
                  data: {
                    type: 'cron_auto_reply',
                    action: 'dm_monitor_response',
                    platform: platform,
                    targetId: prospect.id,
                    targetName: senderName,
                    status: 'success',
                    result: aiReply.slice(0, 200),
                    completedAt: new Date(),
                  },
                });
              } else {
                await db.automationLog.create({
                  data: {
                    type: 'cron_auto_reply',
                    action: 'dm_monitor_response',
                    platform: platform,
                    targetId: prospect.id,
                    targetName: senderName,
                    status: 'failed',
                    result: sendRes.error || 'falhou ao enviar',
                  },
                });
              }
            }

            break; // Processar apenas a mensagem mais recente por conversa
          }
        }
      } catch (e: any) {
        results.errors.push(platform + ' erro: ' + e.message);
      }
    }
  } catch (e: any) {
    results.errors.push('Erro geral: ' + e.message);
  }

  return results;
}

// Vercel Cron chama esta rota automaticamente a cada 5 minutos
export async function GET(request: Request) {
  // Verificar autenticacao do cron (Vercel envia Authorization header)
  var authHeader = request.headers.get('authorization') || '';
  var urlSecret = new URL(request.url).searchParams.get('secret') || '';
  var isValid = authHeader === 'Bearer ' + CRON_SECRET || urlSecret === CRON_SECRET;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized — CRON_SECRET invalido' }, { status: 401 });
  }

  try {
    await ensureDatabase();
    var startTime = Date.now();
    var monitorResults = await monitorAndRespond();
    var duration = Date.now() - startTime;

    // Registar execucao do cron
    await db.automationLog.create({
      data: {
        type: 'cron_monitor',
        action: 'dm_monitoring_cycle',
        platform: 'all',
        status: monitorResults.errors.length === 0 ? 'success' : 'partial',
        result: JSON.stringify({
          newMessages: monitorResults.newMessages,
          autoReplied: monitorResults.autoReplied,
          notifications: monitorResults.notifications,
          prospectsCreated: monitorResults.prospectsCreated,
          duration: duration + 'ms',
        }),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      cron: 'dm_monitor',
      timestamp: new Date().toISOString(),
      duration: duration + 'ms',
      data: monitorResults,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// POST para acionar manualmente (com CRON_SECRET)
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var secret = body.secret || '';
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  var results = await monitorAndRespond();
  return NextResponse.json({ success: true, cron: 'dm_monitor', data: results });
}
