// ============================================================
//  JARVIS ZERNIO API — DM & Inbox via Zernio
//  Instagram + Facebook DMs with REST API
// ============================================================

import { NextResponse } from 'next/server';
import {
  zernioListAccounts,
  zernioListConversations,
  zernioGetConversationMessages,
  zernioSendDM,
  zernioSendTyping,
  zernioMarkRead,
  zernioCreateCommentAutomation,
  zernioListCommentAutomations,
  zernioCreateBroadcast,
  zernioGetConnectUrl,
} from '@/lib/zernio';

import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== LIST CONNECTED ACCOUNTS =====
  if (action === 'list_accounts') {
    var result = await zernioListAccounts();
    if (!result.success) return NextResponse.json({ success: false, error: result.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_accounts',
      accounts: result.data,
    });
  }

  // ===== LIST INBOX CONVERSATIONS =====
  if (action === 'list_conversations') {
    var convResult = await zernioListConversations({
      platform: body.platform,
      limit: body.limit || 20,
      cursor: body.cursor,
    });
    if (!convResult.success) return NextResponse.json({ success: false, error: convResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_conversations',
      conversations: convResult.data,
    });
  }

  // ===== GET CONVERSATION MESSAGES =====
  if (action === 'get_messages') {
    var convId = body.conversationId || '';
    if (!convId) return NextResponse.json({ success: false, error: 'conversationId necessario' });
    var msgResult = await zernioGetConversationMessages(convId, {
      limit: body.limit || 30,
      before: body.before,
    });
    if (!msgResult.success) return NextResponse.json({ success: false, error: msgResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_messages',
      messages: msgResult.data,
    });
  }

  // ===== SEND DM =====
  if (action === 'send_dm') {
    var sendConvId = body.conversationId || '';
    var accountId = body.accountId || '';
    var message = body.message || '';
    if (!sendConvId || !accountId || !message) {
      return NextResponse.json({ success: false, error: 'conversationId, accountId e message sao necessarios' });
    }
    var sendResult = await zernioSendDM(sendConvId, accountId, message);
    if (!sendResult.success) return NextResponse.json({ success: false, error: sendResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_dm_sent',
      data: sendResult.data,
    });
  }

  // ===== SEND TYPING INDICATOR =====
  if (action === 'typing') {
    var typeConvId = body.conversationId || '';
    if (!typeConvId) return NextResponse.json({ success: false, error: 'conversationId necessario' });
    var typeResult = await zernioSendTyping(typeConvId);
    return NextResponse.json(typeResult);
  }

  // ===== MARK CONVERSATION AS READ =====
  if (action === 'mark_read') {
    var readConvId = body.conversationId || '';
    if (!readConvId) return NextResponse.json({ success: false, error: 'conversationId necessario' });
    var readResult = await zernioMarkRead(readConvId);
    return NextResponse.json(readResult);
  }

  // ===== CREATE COMMENT-TO-DM AUTOMATION =====
  if (action === 'create_comment_automation') {
    var autoResult = await zernioCreateCommentAutomation({
      accountId: body.accountId || '',
      trigger: body.trigger || 'comment',
      keywords: body.keywords,
      message: body.message || '',
      mediaUrl: body.mediaUrl,
    });
    if (!autoResult.success) return NextResponse.json({ success: false, error: autoResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_automation_created',
      data: autoResult.data,
    });
  }

  // ===== LIST COMMENT AUTOMATIONS =====
  if (action === 'list_automations') {
    var listAutoResult = await zernioListCommentAutomations();
    if (!listAutoResult.success) return NextResponse.json({ success: false, error: listAutoResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_automations',
      automations: listAutoResult.data,
    });
  }

  // ===== CREATE BROADCAST =====
  if (action === 'create_broadcast') {
    var bcastResult = await zernioCreateBroadcast({
      accountId: body.accountId || '',
      message: body.message || '',
      contactIds: body.contactIds,
      phones: body.phones,
      mediaUrl: body.mediaUrl,
    });
    if (!bcastResult.success) return NextResponse.json({ success: false, error: bcastResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_broadcast_created',
      data: bcastResult.data,
    });
  }

  // ===== GET CONNECT URL =====
  if (action === 'connect') {
    var platform = body.platform || '';
    if (!platform) return NextResponse.json({ success: false, error: 'Plataforma necessaria' });
    var connResult = await zernioGetConnectUrl(platform);
    if (!connResult.success) return NextResponse.json({ success: false, error: connResult.error });
    return NextResponse.json({
      success: true,
      type: 'zernio_connect',
      authUrl: connResult.data,
      instructions: 'Abre o link no navegador e autoriza o ' + platform + '. Depois a conta fica disponivel via API.',
    });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
