// ============================================================
//  Aura ZERNIO WEBHOOK — recebe eventos de DM em tempo real
//  Events: message.received, message.sent, conversation.started
//  Verificacao HMAC-SHA256 real
// ============================================================

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/db';

export var maxDuration = 30;

const WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET || '';

// Verificacao HMAC-SHA256 real
function verifySignature(body: string, signature: string): boolean {
  if (!signature || !body) return false;
  try {
    const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    // Compara timing-safe para evitar timing attacks
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

// Create a notification when a new DM arrives
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
  } else if (eventType === 'message.sent') {
    title = 'DM enviado com sucesso';
    message = messageText ? messageText.slice(0, 100) : 'Mensagem entregue';
  } else {
    title = 'Evento: ' + eventType;
    message = 'Evento recebido no ' + platform;
  }

  const notification = await db.notification.create({
    data: {
      type: eventType,
      title,
      message,
      platform,
      sourceId: conversationId,
      metadata: senderInfo ? JSON.stringify(senderInfo) : null,
    },
  });

  return notification;
}

// Auto-detect if sender is a prospect and update CRM
async function updateProspectFromDM(platform: string, senderInfo: any) {
  const username = senderInfo?.username || senderInfo?.name || '';
  if (!username) return null;

  const prospect = await db.prospect.findFirst({
    where: { platform, username },
  });

  if (prospect) {
    const updated = await db.prospect.update({
      where: { id: prospect.id },
      data: {
        lastRepliedAt: new Date(),
        lastContactedAt: new Date(),
        status: 'responded',
      },
    });
    return updated;
  }

  return null;
}

// Auto-check for follow-ups needed (prospects not contacted in 3+ days)
async function checkAndCreateFollowUps() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const pendingProspects = await db.prospect.findMany({
    where: {
      status: { in: ['contacted', 'new', 'responded'] },
      NOT: { status: { in: ['converted', 'lost', 'not_interested'] } },
      OR: [
        { lastContactedAt: { lt: threeDaysAgo } },
        { lastContactedAt: null },
      ],
    },
    include: { followUps: true },
  });

  let created = 0;
  for (const p of pendingProspects) {
    const hasPending = p.followUps.some(function(fu) { return fu.status === 'pending'; });
    if (hasPending) continue;

    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 1);

    await db.followUp.create({
      data: {
        prospectId: p.id,
        scheduledAt: followUpDate,
        message: 'Seguimento automatico: Ola ' + (p.displayName || '@' + p.username) + ', estou a passar para saber se ainda tens interesse. A Mwango Brain tem novidades que podem interessar-te!',
      },
    });

    created++;
  }

  return created;
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-zernio-signature') || '';

    // Verificacao HMAC-SHA256 real
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const event = payload.event || 'unknown';
    const conversation = payload.conversation || {};
    const message = payload.message || {};

    // Create notification
    const notification = await createNotification(
      event,
      conversation.platform || 'unknown',
      message.sender || {},
      message.text || '',
      conversation.id || ''
    );

    // Update CRM prospect if someone replied
    if (event === 'message.received' && conversation.platform) {
      await updateProspectFromDM(conversation.platform, message.sender || {});

      const senderName = message.sender?.username || message.sender?.name || '';
      if (senderName) {
        const prospect = await db.prospect.findFirst({
          where: { platform: conversation.platform, username: senderName },
        });
        if (prospect) {
          await db.message.create({
            data: {
              prospectId: prospect.id,
              direction: 'inbound',
              content: message.text || '(midia ou reacao)',
              platform: conversation.platform,
            },
          });
        }
      }

      await checkAndCreateFollowUps();
    }

    return NextResponse.json({
      success: true,
      notificationId: notification.id,
      event,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'Aura Zernio Webhook',
    events: ['message.received', 'message.sent', 'conversation.started'],
  });
}
