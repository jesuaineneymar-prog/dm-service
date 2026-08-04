// ============================================================
//  Aura ZERNIO API — DM & Inbox via Zernio
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
  zernioDeleteCommentAutomation,
  zernioCreateBroadcast,
  zernioGetConnectUrl,
  zernioGetAudience,
  zernioGetContacts,
  zernioCreatePost,
  zernioListPosts,
  zernioGetPost,
  zernioSchedulePost,
  zernioDeleteComment,
  zernioGetAnalytics,
  zernioGetPostAnalytics,
  zernioSendOutboundDM,
  zernioListUsers,
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
      profileId: body.profileId || '6a6a5130412ea007831275dd',
      trigger: body.trigger || 'comment',
      keywords: body.keywords,
      message: body.message || '',
      mediaUrl: body.mediaUrl,
      name: body.name,
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

  // ===== GET AUDIENCE/FOLLOWERS =====
  if (action === 'audience') {
    var audAccId = body.accountId || '';
    if (!audAccId) {
      // Try to find IG account automatically
      var accsResult = await zernioListAccounts();
      if (accsResult.success && accsResult.data?.accounts) {
        var igAcc = accsResult.data.accounts.find(function(a: any) { return a.platform === 'instagram'; });
        if (igAcc) audAccId = igAcc._id;
      }
    }
    if (!audAccId) return NextResponse.json({ success: false, error: 'accountId necessario' });
    var audResult = await zernioGetAudience(audAccId, { type: body.type || 'followers', limit: body.limit || 50 });
    if (!audResult.success) return NextResponse.json({ success: false, error: audResult.error });
    return NextResponse.json({ success: true, type: 'zernio_audience', data: audResult.data });
  }

  // ===== SEND OUTBOUND DM (new conversation) =====
  if (action === 'send_outbound_dm') {
    if (!body.accountId || !body.message || (!body.recipientId && !body.recipientUsername)) {
      return NextResponse.json({ success: false, error: 'accountId, message e recipientId/recipientUsername necessarios' });
    }
    var outResult = await zernioSendOutboundDM({
      accountId: body.accountId,
      recipientId: body.recipientId || '',
      message: body.message,
      platform: body.platform,
      recipientUsername: body.recipientUsername,
    });
    if (!outResult.success) return NextResponse.json({ success: false, error: outResult.error });
    return NextResponse.json({ success: true, type: 'zernio_outbound_dm_sent', data: outResult.data, method: outResult.method });
  }

  // ===== CREATE POST =====
  if (action === 'create_post') {
    if (!body.accountId) return NextResponse.json({ success: false, error: 'accountId necessario' });
    var postResult = await zernioCreatePost({
      accountId: body.accountId,
      caption: body.caption,
      mediaUrl: body.mediaUrl,
      platform: body.platform,
      scheduledAt: body.scheduledAt,
    });
    if (!postResult.success) return NextResponse.json({ success: false, error: postResult.error });
    return NextResponse.json({ success: true, type: 'zernio_post_created', data: postResult.data });
  }

  // ===== LIST POSTS =====
  if (action === 'list_posts') {
    var listPostResult = await zernioListPosts({ accountId: body.accountId, limit: body.limit, status: body.status });
    if (!listPostResult.success) return NextResponse.json({ success: false, error: listPostResult.error });
    return NextResponse.json({ success: true, type: 'zernio_posts', data: listPostResult.data });
  }

  // ===== GET POST =====
  if (action === 'get_post') {
    if (!body.postId) return NextResponse.json({ success: false, error: 'postId necessario' });
    var getPostResult = await zernioGetPost(body.postId);
    if (!getPostResult.success) return NextResponse.json({ success: false, error: getPostResult.error });
    return NextResponse.json({ success: true, type: 'zernio_post', data: getPostResult.data });
  }

  // ===== SCHEDULE POST =====
  if (action === 'schedule_post') {
    if (!body.postId || !body.scheduledAt) return NextResponse.json({ success: false, error: 'postId e scheduledAt necessarios' });
    var schedResult = await zernioSchedulePost(body.postId, body.scheduledAt);
    if (!schedResult.success) return NextResponse.json({ success: false, error: schedResult.error });
    return NextResponse.json({ success: true, type: 'zernio_post_scheduled', data: schedResult.data });
  }

  // ===== DELETE COMMENT =====
  if (action === 'delete_comment') {
    if (!body.commentId || !body.accountId) return NextResponse.json({ success: false, error: 'commentId e accountId necessarios' });
    var delCommentResult = await zernioDeleteComment(body.commentId, body.accountId);
    if (!delCommentResult.success) return NextResponse.json({ success: false, error: delCommentResult.error });
    return NextResponse.json({ success: true, type: 'zernio_comment_deleted', deleted: delCommentResult.deleted });
  }

  // ===== ANALYTICS =====
  if (action === 'analytics') {
    var analyticsResult = await zernioGetAnalytics({ accountId: body.accountId, period: body.period });
    if (!analyticsResult.success) return NextResponse.json({ success: false, error: analyticsResult.error });
    return NextResponse.json({ success: true, type: 'zernio_analytics', data: analyticsResult.data });
  }

  // ===== POST ANALYTICS =====
  if (action === 'post_analytics') {
    if (!body.postId) return NextResponse.json({ success: false, error: 'postId necessario' });
    var postAnalyticsResult = await zernioGetPostAnalytics(body.postId);
    if (!postAnalyticsResult.success) return NextResponse.json({ success: false, error: postAnalyticsResult.error });
    return NextResponse.json({ success: true, type: 'zernio_post_analytics', data: postAnalyticsResult.data });
  }

  // ===== LIST USERS =====
  if (action === 'list_users') {
    var usersResult = await zernioListUsers();
    if (!usersResult.success) return NextResponse.json({ success: false, error: usersResult.error });
    return NextResponse.json({ success: true, type: 'zernio_users', data: usersResult.data });
  }

  // ===== GET CONTACTS =====
  if (action === 'contacts') {
    var contResult = await zernioGetContacts({ accountId: body.accountId, limit: body.limit || 50 });
    if (!contResult.success) return NextResponse.json({ success: false, error: contResult.error });
    return NextResponse.json({ success: true, type: 'zernio_contacts', data: contResult.data });
  }

  // ===== DELETE AUTOMATION =====
  if (action === 'delete_automation') {
    var delId = body.automationId || '';
    if (!delId) return NextResponse.json({ success: false, error: 'automationId necessario' });
    var delResult = await zernioDeleteCommentAutomation(delId);
    if (!delResult.success) return NextResponse.json({ success: false, error: delResult.error });
    return NextResponse.json({ success: true, deleted: delId });
  }

  // ===== UPDATE AUTOMATIONS (delete old + create new) =====
  if (action === 'update_automations') {
    var igAccountId = body.igAccountId || '6a6a51f5df17280d93d8a106';
    var fbAccountId = body.fbAccountId || '6a6a51bcdf17280d93d89e06';
    var igMessage = body.igMessage || '';
    var fbMessage = body.fbMessage || '';
    var results: any = {};

    // Apagar automacoes existentes
    var existing = await zernioListCommentAutomations();
    if (existing.success && existing.data?.automations) {
      for (var auto of existing.data.automations) {
        await zernioDeleteCommentAutomation(auto.id).catch(function() {});
      }
    }

    // Criar novas
    var profileId = body.profileId || '6a6a5130412ea007831275dd';
    if (igMessage) {
      var igResult = await zernioCreateCommentAutomation({
        accountId: igAccountId,
        profileId: profileId,
        message: igMessage,
        name: 'Aura IG Auto-DM',
      });
      results.instagram = igResult;
    }
    if (fbMessage) {
      var fbResult = await zernioCreateCommentAutomation({
        accountId: fbAccountId,
        profileId: profileId,
        message: fbMessage,
        name: 'Aura FB Auto-DM',
      });
      results.facebook = fbResult;
    }
    return NextResponse.json({ success: true, results });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
