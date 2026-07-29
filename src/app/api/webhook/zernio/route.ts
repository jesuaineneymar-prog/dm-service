// ============================================================
//  JARVIS ZERNIO WEBHOOK — recebe eventos de DM em tempo real
//  Events: message.received, message.sent, conversation.started
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export var maxDuration = 30;

var ZERNIO_WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET || 'jarvis_webhook_secret_mwango_2024';

// Verify HMAC-SHA256 signature from Zernio
function verifySignature(body: string, signature: string): boolean {
  // In production, use Node.js crypto to verify HMAC-SHA256
  // For now we accept all webhooks and verify via presence of signature header
  return !!signature;
}

// Create a notification when a new DM arrives
async function createNotification(eventType: string, platform: string, senderInfo: any, messageText: string, conversationId: string) {
  var title = '';
  var message = '';

  if (eventType === 'message.received') {
    var senderName = senderInfo?.name || senderInfo?.username || senderInfo?.contactId || 'Alguem';
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

  var notification = await db.notification.create({
    data: {
      type: eventType,
      title: title,
      message: message,
      platform: platform,
      sourceId: conversationId,
      metadata: senderInfo ? JSON.stringify(senderInfo) : null,
    },
  });

  return notification;
}

// Auto-detect if sender is a prospect and update CRM
async function updateProspectFromDM(platform: string, senderInfo: any) {
  var username = senderInfo?.username || senderInfo?.name || '';
  if (!username) return null;

  var prospect = await db.prospect.findFirst({
    where: { platform: platform, username: username },
  });

  if (prospect) {
    // Update last reply timestamp
    var updated = await db.prospect.update({
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
  var threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  var pendingProspects = await db.prospect.findMany({
    where: {
      status: { in: ['contacted', 'new', 'responded'] },
      OR: [
        { lastContactedAt: { lt: threeDaysAgo } },
        { lastContactedAt: null },
      ],
    },
    include: { followUps: true },
  });

  var created = 0;
  for (var i = 0; i < pendingProspects.length; i++) {
    var p = pendingProspects[i];
    // Check if already has a pending follow-up
    var hasPending = p.followUps.some(function(fu) { return fu.status === 'pending'; });
    if (hasPending) continue;

    // Create automatic follow-up 3 days from now
    var followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 1); // Follow up in 1 day since already 3+ days passed

    await db.followUp.create({
      data: {
        prospectId: p.id,
        scheduledAt: followUpDate,
        message: 'Seguimento automatico: Olá ' + (p.displayName || '@' + p.username) + ', estou a passar para saber se ainda tens interesse. A Mwango Brain tem novidades que podem interessar-te!',
      },
    });

    created++;
  }

  return created;
}

export async function POST(request: Request) {
  try {
    var body = await request.text();
    var signature = request.headers.get('x-zernio-signature') || '';

    // Verify webhook signature
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    var payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    var event = payload.event || 'unknown';
    var conversation = payload.conversation || {};
    var message = payload.message || {};
    var accountId = payload.accountId || '';

    // Create notification
    var notification = await createNotification(
      event,
      conversation.platform || 'unknown',
      message.sender || {},
      message.text || '',
      conversation.id || ''
    );

    // Update CRM prospect if someone replied
    if (event === 'message.received' && conversation.platform) {
      await updateProspectFromDM(conversation.platform, message.sender || {});

      // Log the message in the prospect's history
      var senderName = message.sender?.username || message.sender?.name || '';
      if (senderName) {
        var prospect = await db.prospect.findFirst({
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

      // Check for follow-ups needed
      await checkAndCreateFollowUps();
    }

    return NextResponse.json({
      success: true,
      notificationId: notification.id,
      event: event,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET endpoint to test webhook is alive
export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'JARVIS Zernio Webhook',
    events: ['message.received', 'message.sent', 'conversation.started'],
  });
}
