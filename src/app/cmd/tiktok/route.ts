// ============================================================
//  JARVIS TIKTOK API — DMs via ManyChat + analytics + posting
//  Deep search Jul 2026: ManyChat é parceiro oficial TikTok
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
} from '@/lib/tiktok-engine';
import { MANYCHAT_KEY } from '@/lib/config';

export var maxDuration = 60;

// Send a DM to TikTok user
async function sendTTDM(recipientId: string, message: string, buttonText?: string, buttonUrl?: string) {
  if (!MANYCHAT_KEY) throw new Error('MANYCHAT_API_KEY nao configurada');
  return await tiktokSendDM({ recipientId, message, buttonText, buttonUrl });
}

// Get TikTok inbox conversations
async function getTTConversations(limit?: number) {
  if (!MANYCHAT_KEY) throw new Error('MANYCHAT_API_KEY nao configurada');
  return await tiktokGetConversations(limit);
}

// Set TikTok welcome message
async function setTTWelcome(message: string) {
  if (!MANYCHAT_KEY) throw new Error('MANYCHAT_API_KEY nao configurada');
  return await tiktokSetWelcomeMessage(message);
}

// Get TikTok profile info
async function getTTProfile() {
  if (!MANYCHAT_KEY) throw new Error('MANYCHAT_API_KEY nao configurada');
  return await tiktokGetProfileInfo();
}

// Trigger a ManyChat flow
async function triggerTTFlow(recipientId: string, flowId: string) {
  if (!MANYCHAT_KEY) throw new Error('MANYCHAT_API_KEY nao configurada');
  return await tiktokTriggerFlow({ recipientId, flowId });
}

// Auto-reply to new TikTok DMs (called from autonomous cycle)
export async function monitorTikTokDMs() {
  if (!MANYCHAT_KEY) return { newMessages: 0, autoReplied: 0, errors: ['MANYCHAT_API_KEY nao configurada'] };

  var results = { newMessages: 0, autoReplied: 0, errors: [] as string[] };

  try {
    var convRes = await getTTConversations(20);
    if (!convRes.success || !convRes.data) {
      results.errors.push('Erro ao buscar conversas TikTok: ' + (convRes.error || '?'));
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

      // Save to DB
      var prospect = await db.prospect.findFirst({ where: { platform: 'tiktok', username: senderName } });
      if (!prospect && senderName !== 'unknown') {
        prospect = await db.prospect.create({
          data: { platform: 'tiktok', username: senderName, displayName: conv.participant?.name || null, status: 'new', externalId: conv.id },
        });
      }

      if (prospect) {
        await db.message.create({ data: { prospectId: prospect.id, direction: 'inbound', content: lastMessage, platform: 'tiktok' } });
      }

      // AI auto-reply
      var aiReply = await generateDMReply(senderName, 'tiktok', lastMessage, prospect);
      var dmResult = await sendTTDM(conv.participant?.id || conv.id, aiReply);
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
    results.errors.push(e.message);
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
      var result = await sendTTDM(body.recipientId, body.message, body.buttonText, body.buttonUrl);
      return NextResponse.json(result);
    }

    if (action === 'get_conversations') {
      var convs = await getTTConversations(body.limit || 50);
      return NextResponse.json(convs);
    }

    if (action === 'set_welcome') {
      if (!body.message) return NextResponse.json({ success: false, error: 'Mensagem necessaria' });
      var welcome = await setTTWelcome(body.message);
      return NextResponse.json(welcome);
    }

    if (action === 'get_profile') {
      var profile = await getTTProfile();
      return NextResponse.json(profile);
    }

    if (action === 'trigger_flow') {
      if (!body.recipientId || !body.flowId) return NextResponse.json({ success: false, error: 'recipientId e flowId necessarios' });
      var flow = await triggerTTFlow(body.recipientId, body.flowId);
      return NextResponse.json(flow);
    }

    if (action === 'monitor') {
      var monitorData = await monitorTikTokDMs();
      return NextResponse.json({ success: true, data: monitorData });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
