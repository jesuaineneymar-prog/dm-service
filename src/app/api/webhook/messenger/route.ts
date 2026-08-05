// ============================================================
//  Aura Messenger Webhook — Facebook Messenger Platform
//  Receives messages directly from FB (no Zernio dependency)
//  GET = verification, POST = incoming messages
// ============================================================

import { NextResponse } from 'next/server';
import { META_APP_SECRET, META_PAGE_TOKEN } from '@/lib/config';
import { db, ensureDatabase } from '@/lib/db';
import crypto from 'crypto';

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || 'aura_verify_token_2024';

// Verify webhook (Facebook requirement)
export async function GET(request: Request) {
  var url = new URL(request.url);
  var mode = url.searchParams.get('hub.mode');
  var token = url.searchParams.get('hub.verify_token');
  var challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Messenger] Webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// Helper: verify signature
function verifySignature(payload: string, signature: string): boolean {
  var appSecret = META_APP_SECRET;
  if (!appSecret) return true; // Skip verify if no secret configured
  var expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Handle incoming messages
export async function POST(request: Request) {
  try {
    var signature = request.headers.get('x-hub-signature-256') || '';
    var bodyText = await request.text();

    // Verify signature if app secret is configured
    if (META_APP_SECRET && signature && !verifySignature(bodyText, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    var body = JSON.parse(bodyText);
    if (body.object !== 'page') {
      return NextResponse.json({ received: true });
    }

    await ensureDatabase();

    var entries = body.entry || [];
    for (var ei = 0; ei < entries.length; ei++) {
      var entry = entries[ei];
      var messaging = entry.messaging || [];
      for (var mi = 0; mi < messaging.length; mi++) {
        var event = messaging[mi];

        // Skip events from our own page
        if (event.sender?.id === entry.id) continue;

        // Handle messages
        if (event.message) {
          await handleIncomingMessage(event, entry.id);
        }

        // Handle postbacks (button clicks)
        if (event.postback) {
          await handlePostback(event, entry.id);
        }
      }
    }

    return NextResponse.json({ received: true, status: 'ok' });
  } catch (e: any) {
    console.error('[Messenger Webhook] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Process incoming message
async function handleIncomingMessage(event: any, pageId: string) {
  var senderId = event.sender?.id;
  var messageText = event.message?.text || '';
  var attachments = event.message?.attachments || [];
  var mid = event.message?.mid;

  if (!senderId) return;

  console.log('[Messenger] Message from ' + senderId + ': ' + (messageText || '(media)').slice(0, 100));

  // Create/update prospect
  var prospect = await db.prospect.findFirst({ where: { platform: 'facebook', externalId: senderId } });
  if (!prospect) {
    var senderName = 'FB_' + senderId;
    try {
      // Fetch sender name from Graph API
      var fbRes = await fetch('https://graph.facebook.com/v21.0/' + senderId + '?fields=name&access_token=' + META_PAGE_TOKEN);
      var fbData = await fbRes.json();
      if (fbData.name) senderName = fbData.name;
    } catch(e) {}

    prospect = await db.prospect.create({
      data: { platform: 'facebook', username: senderName, displayName: senderName !== 'FB_' + senderId ? senderName : null, externalId: senderId, status: 'new' }
    });
  }

  // Save inbound message
  await db.message.create({
    data: { prospectId: prospect.id, direction: 'inbound', content: messageText || '(media)', platform: 'facebook' }
  });

  // Update prospect status
  await db.prospect.update({
    where: { id: prospect.id },
    data: { lastRepliedAt: new Date(), status: prospect.status === 'new' ? 'contacted' : 'responded' }
  });

  // Create notification
  await db.notification.create({
    data: { type: 'messenger_dm', title: 'FB DM de ' + (prospect.displayName || senderId), message: messageText.slice(0, 120), platform: 'facebook', sourceId: senderId }
  });

  // Log automation
  await db.automationLog.create({
    data: { type: 'messenger_webhook', action: 'received_dm', platform: 'facebook', targetId: senderId, targetName: prospect.displayName || senderId, status: 'success', completedAt: new Date() }
  });

  // Auto-reply with AI if message has text
  if (messageText.length > 0) {
    try {
      var { generateDMReply } = await import('@/lib/ai');
      var aiReply = await generateDMReply(prospect.displayName || senderId, 'facebook', messageText, prospect);

      // Send reply via Graph API
      var sendRes = await fetch('https://graph.facebook.com/v21.0/' + pageId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: senderId },
          message: { text: aiReply },
          access_token: META_PAGE_TOKEN
        })
      });
      var sendData = await sendRes.json();

      if (!sendData.error) {
        await db.message.create({
          data: { prospectId: prospect.id, direction: 'outbound', content: aiReply, platform: 'facebook' }
        });
        await db.automationLog.create({
          data: { type: 'messenger_webhook', action: 'auto_reply', platform: 'facebook', targetName: prospect.displayName || senderId, status: 'success', result: aiReply.slice(0, 200), completedAt: new Date() }
        });
      }
    } catch(e: any) {
      console.error('[Messenger] Auto-reply failed:', e.message);
    }
  }
}

// Handle postback (button clicks)
async function handlePostback(event: any, pageId: string) {
  var senderId = event.sender?.id;
  var payload = event.postback?.payload || '';

  if (!senderId) return;

  console.log('[Messenger] Postback from ' + senderId + ': ' + payload);

  // Create/update prospect
  var prospect = await db.prospect.findFirst({ where: { platform: 'facebook', externalId: senderId } });
  if (!prospect) {
    prospect = await db.prospect.create({
      data: { platform: 'facebook', username: 'FB_' + senderId, externalId: senderId, status: 'new' }
    });
  }

  await db.automationLog.create({
    data: { type: 'messenger_webhook', action: 'postback', platform: 'facebook', targetId: senderId, targetName: payload, status: 'success', completedAt: new Date() }
  });
}
