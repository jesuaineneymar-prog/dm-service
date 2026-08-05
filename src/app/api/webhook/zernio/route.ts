// ============================================================
//  Aura ZERNIO WEBHOOK — recebe eventos + auto-responde com IA
//  Events: message.received, message.sent, conversation.started
//  Quando alguem manda DM, a Aura responde automaticamente
//  Tom: Grok — directo, inteligente, sem papo
// ============================================================

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db, ensureDatabase } from '@/lib/db';
import { generateDMReply } from '@/lib/ai';
import { zernioSendDM, zernioListAccounts } from '@/lib/zernio';

export var maxDuration = 30;

const WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET || '';

// Contas Zernio (cache simples)
var accountCache: any = null;
var accountCacheTime = 0;
async function getAccountMap(): Promise<Record<string, string>> {
  if (accountCache && Date.now() - accountCacheTime < 300000) return accountCache;
  try {
    var result = await zernioListAccounts();
    if (result.success && result.data?.accounts) {
      var map: Record<string, string> = {};
      for (var acc of result.data.accounts) {
        map[acc.platform] = acc._id;
      }
      accountCache = map;
      accountCacheTime = Date.now();
      return map;
    }
  } catch (e) { /* use cache */ }
  return accountCache || {};
}

// Verificacao HMAC-SHA256
function verifySignature(body: string, signature: string): boolean {
  if (!signature || !body) return false;
  try {
    const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    if (signature.length !== expected.length) return false;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

// Criar notificacao no DB
async function createNotification(eventType: string, platform: string, senderInfo: any, messageText: string, conversationId: string) {
  let title = '';
  let message = '';

  if (eventType === 'message.received') {
    const senderName = senderInfo?.name || senderInfo?.username || senderInfo?.contactId || 'Alguem';
    title = 'Nova mensagem de ' + senderName;
    message = messageText ? messageText.slice(0, 150) : '(sem texto)';
  } else if (eventType === 'conversation.started') {
    title = 'Nova conversa iniciada';
    message = 'Alguem iniciou uma conversa no ' + platform;
  } else {
    title = 'Evento: ' + eventType;
    message = 'Evento no ' + platform;
  }

  const notification = await db.notification.create({
    data: { type: eventType, title, message, platform, metadata: JSON.stringify({ conversationId, senderInfo }) },
  });
  return notification;
}

// Auto-responder DM com IA (Grok style)
async function autoReplyWithAI(platform: string, conversationId: string, senderInfo: any, messageText: string) {
  if (!messageText || messageText.length < 2) return null;

  var senderName = senderInfo?.username || senderInfo?.name || 'utilizador';

  // Verificar se ja respondemos recentemente (evitar loop)
  var recentReply = await db.message.findFirst({
    where: {
      direction: 'outbound',
      platform: platform,
    },
    orderBy: { sentAt: 'desc' },
  });
  if (recentReply && Date.now() - recentReply.sentAt.getTime() < 60000) return null;

  try {
    // Gerar resposta IA
    var aiReply = await generateDMReply(senderName, platform, messageText);
    if (!aiReply) return null;

    // Enviar DM via Zernio
    var accountMap = await getAccountMap();
    var accountId = accountMap[platform];
    if (!accountId) return null;

    var sendResult = await zernioSendDM(conversationId, accountId, aiReply);

    if (sendResult.success) {
      // Actualizar prospect no CRM
      var prospect = await db.prospect.findFirst({ where: { platform, username: senderName } });
      if (prospect) {
        await db.prospect.update({
          where: { id: prospect.id },
          data: { lastContactedAt: new Date(), status: 'responded' },
        });
      } else {
        await db.prospect.create({
          data: {
            platform, username: senderName,
            displayName: senderInfo?.name || senderName,
            status: 'responded',
            lastContactedAt: new Date(),
          },
        });
      }

      return aiReply;
    }
  } catch (e: any) {
    console.error('Auto-reply AI error:', e.message);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-zernio-signature') || '';

    // Verificacao HMAC
    if (WEBHOOK_SECRET && !verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try { payload = JSON.parse(body); } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const event = payload.event || 'unknown';
    const conversation = payload.conversation || {};
    const message = payload.message || {};
    const platform = conversation.platform || 'unknown';
    const conversationId = conversation.id || '';
    const senderInfo = message.sender || {};
    const messageText = message.text || '';

    // Criar notificacao
    await createNotification(event, platform, senderInfo, messageText, conversationId);

    // AUTO-REPLY: quando recebe mensagem, responde com IA
    if (event === 'message.received' && conversationId && messageText) {
      // Guardar mensagem inbound no DB
      var senderName = senderInfo?.username || senderInfo?.name || '';
      if (senderName) {
        var prospect = await db.prospect.findFirst({ where: { platform, username: senderName } });
        if (prospect) {
          await db.message.create({
            data: {
              prospectId: prospect.id,
              direction: 'inbound',
              content: messageText,
              platform,
            },
          });
        }
      }

      // Responder com IA (async, nao bloqueia a resposta do webhook)
      autoReplyWithAI(platform, conversationId, senderInfo, messageText).catch(function() {});
    }

    return NextResponse.json({ success: true, event, platform });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Aura Zernio Webhook + AI Auto-Reply',
    features: ['message.received -> AI auto-reply', 'conversation tracking', 'CRM sync'],
  });
}
