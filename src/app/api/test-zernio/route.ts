// ============================================================
//  Aura TEST ZERNIO — Tests ALL Zernio endpoints live
//  Temporary route for validation — remove after testing
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
  zernioUploadMedia,
} from '@/lib/zernio';

export var maxDuration = 120;

export async function GET() {
  var results: any = {
    timestamp: new Date().toISOString(),
    tests: [] as any[],
    summary: { total: 0, passed: 0, failed: 0 },
  };

  var IG_ACCOUNT_ID = '';
  var FB_ACCOUNT_ID = '';

  // ===== TEST 1: List Accounts =====
  try {
    var t1 = { name: '1. List Accounts (GET /accounts)', status: 'running', detail: '' };
    var r1 = await zernioListAccounts();
    if (r1.success) {
      var accs = r1.data?.accounts || (Array.isArray(r1.data) ? r1.data : []);
      for (var i = 0; i < accs.length; i++) {
        if (accs[i].platform === 'instagram') IG_ACCOUNT_ID = accs[i]._id || accs[i].id || '';
        if (accs[i].platform === 'facebook') FB_ACCOUNT_ID = accs[i]._id || accs[i].id || '';
      }
      t1.status = 'PASS';
      t1.detail = accs.length + ' accounts: ' + accs.map(function(a: any) { return a.platform + '(' + (a.username || a._id || '?') + ')'; }).join(', ');
    } else {
      t1.status = 'FAIL'; t1.detail = r1.error || '';
    }
    results.tests.push(t1);
  } catch (e: any) { results.tests.push({ name: '1. List Accounts', status: 'FAIL', detail: e.message }); }

  // ===== TEST 2: List Users =====
  try {
    var t2 = { name: '2. List Users (GET /users)', status: 'running', detail: '' };
    var r2 = await zernioListUsers();
    if (r2.success) { t2.status = 'PASS'; t2.detail = 'OK'; } else { t2.status = 'FAIL'; t2.detail = r2.error || ''; }
    results.tests.push(t2);
  } catch (e: any) { results.tests.push({ name: '2. List Users', status: 'FAIL', detail: e.message }); }

  // ===== TEST 3: List Conversations (Instagram) =====
  try {
    var t3 = { name: '3. List IG Conversations (GET /inbox/conversations?platform=instagram)', status: 'running', detail: '' };
    var r3 = await zernioListConversations({ platform: 'instagram', limit: 5 });
    if (r3.success) {
      var convs = r3.data?.data || r3.data?.conversations || (Array.isArray(r3.data) ? r3.data : []);
      t3.status = 'PASS'; t3.detail = convs.length + ' conversations';
    } else { t3.status = 'FAIL'; t3.detail = r3.error || ''; }
    results.tests.push(t3);
  } catch (e: any) { results.tests.push({ name: '3. List IG Conversations', status: 'FAIL', detail: e.message }); }

  // ===== TEST 4: List Conversations (Facebook) =====
  try {
    var t4 = { name: '4. List FB Conversations (GET /inbox/conversations?platform=facebook)', status: 'running', detail: '' };
    var r4 = await zernioListConversations({ platform: 'facebook', limit: 5 });
    if (r4.success) {
      var convs4 = r4.data?.data || r4.data?.conversations || (Array.isArray(r4.data) ? r4.data : []);
      t4.status = 'PASS'; t4.detail = convs4.length + ' conversations';
    } else { t4.status = 'FAIL'; t4.detail = r4.error || ''; }
    results.tests.push(t4);
  } catch (e: any) { results.tests.push({ name: '4. List FB Conversations', status: 'FAIL', detail: e.message }); }

  // ===== TEST 5: List Posts =====
  try {
    var t5 = { name: '5. List Posts (GET /posts)', status: 'running', detail: '' };
    var r5 = await zernioListPosts({ limit: 5 });
    if (r5.success) {
      var posts = r5.data?.data || r5.data?.posts || (Array.isArray(r5.data) ? r5.data : []);
      t5.status = 'PASS'; t5.detail = posts.length + ' posts';
    } else { t5.status = 'FAIL'; t5.detail = r5.error || ''; }
    results.tests.push(t5);
  } catch (e: any) { results.tests.push({ name: '5. List Posts', status: 'FAIL', detail: e.message }); }

  // ===== TEST 6: Analytics =====
  try {
    var t6 = { name: '6. Analytics (GET /analytics)', status: 'running', detail: '' };
    var r6 = await zernioGetAnalytics();
    if (r6.success) { t6.status = 'PASS'; t6.detail = 'OK'; } else { t6.status = 'FAIL'; t6.detail = r6.error || ''; }
    results.tests.push(t6);
  } catch (e: any) { results.tests.push({ name: '6. Analytics', status: 'FAIL', detail: e.message }); }

  // ===== TEST 7: Contacts =====
  try {
    var t7 = { name: '7. Contacts (GET /contacts)', status: 'running', detail: '' };
    var r7 = await zernioGetContacts({ limit: 5 });
    if (r7.success) { t7.status = 'PASS'; t7.detail = 'OK'; } else { t7.status = 'FAIL'; t7.detail = r7.error || ''; }
    results.tests.push(t7);
  } catch (e: any) { results.tests.push({ name: '7. Contacts', status: 'FAIL', detail: e.message }); }

  // ===== TEST 8: List Comment Automations =====
  try {
    var t8 = { name: '8. List Comment Automations (GET /comment-automations)', status: 'running', detail: '' };
    var r8 = await zernioListCommentAutomations();
    if (r8.success) { t8.status = 'PASS'; t8.detail = 'OK'; } else { t8.status = 'FAIL'; t8.detail = r8.error || ''; }
    results.tests.push(t8);
  } catch (e: any) { results.tests.push({ name: '8. List Comment Automations', status: 'FAIL', detail: e.message }); }

  // ===== TEST 9: Get Audience (Instagram) =====
  if (IG_ACCOUNT_ID) {
    try {
      var t9 = { name: '9. Get IG Audience (GET /accounts/:id/audience)', status: 'running', detail: '' };
      var r9 = await zernioGetAudience(IG_ACCOUNT_ID, { type: 'followers', limit: 5 });
      if (r9.success) { t9.status = 'PASS'; t9.detail = 'OK'; } else { t9.status = 'FAIL'; t9.detail = r9.error || ''; }
      results.tests.push(t9);
    } catch (e: any) { results.tests.push({ name: '9. Get IG Audience', status: 'FAIL', detail: e.message }); }
  }

  // ===== TEST 10: Get Connect URL =====
  try {
    var t10 = { name: '10. Get Connect URL (GET /connect/instagram)', status: 'running', detail: '' };
    var r10 = await zernioGetConnectUrl('instagram');
    if (r10.success) { t10.status = 'PASS'; t10.detail = 'OK'; } else { t10.status = 'FAIL'; t10.detail = r10.error || ''; }
    results.tests.push(t10);
  } catch (e: any) { results.tests.push({ name: '10. Get Connect URL', status: 'FAIL', detail: e.message }); }

  // ===== TEST 11: Get Messages from first IG conversation =====
  try {
    var t11 = { name: '11. Get Conversation Messages (GET /inbox/conversations/:id/messages)', status: 'running', detail: '' };
    var convs11 = await zernioListConversations({ platform: 'instagram', limit: 1 });
    var convList11 = convs11.data?.data || convs11.data?.conversations || (Array.isArray(convs11.data) ? convs11.data : []);
    if (convList11.length > 0) {
      var r11 = await zernioGetConversationMessages(convList11[0].id, { limit: 3 });
      if (r11.success) { t11.status = 'PASS'; t11.detail = 'Got messages from ' + convList11[0].id; } else { t11.status = 'FAIL'; t11.detail = r11.error || ''; }
    } else {
      t11.status = 'SKIP'; t11.detail = 'No IG conversations';
    }
    results.tests.push(t11);
  } catch (e: any) { results.tests.push({ name: '11. Get Messages', status: 'FAIL', detail: e.message }); }

  // ===== TEST 12: Send Typing Indicator =====
  try {
    var t12 = { name: '12. Send Typing (POST /inbox/conversations/:id/typing)', status: 'running', detail: '' };
    var convs12 = await zernioListConversations({ platform: 'instagram', limit: 1 });
    var convList12 = convs12.data?.data || convs12.data?.conversations || (Array.isArray(convs12.data) ? convs12.data : []);
    if (convList12.length > 0) {
      var r12 = await zernioSendTyping(convList12[0].id);
      if (r12.success) { t12.status = 'PASS'; t12.detail = 'OK'; } else { t12.status = 'FAIL'; t12.detail = r12.error || 'failed'; }
    } else {
      t12.status = 'SKIP'; t12.detail = 'No conversations';
    }
    results.tests.push(t12);
  } catch (e: any) { results.tests.push({ name: '12. Send Typing', status: 'FAIL', detail: e.message }); }

  // ===== TEST 13: Mark Read =====
  try {
    var t13 = { name: '13. Mark Read (POST /inbox/conversations/:id/read)', status: 'running', detail: '' };
    var convs13 = await zernioListConversations({ platform: 'instagram', limit: 1 });
    var convList13 = convs13.data?.data || convs13.data?.conversations || (Array.isArray(convs13.data) ? convs13.data : []);
    if (convList13.length > 0) {
      var r13 = await zernioMarkRead(convList13[0].id);
      if (r13.success) { t13.status = 'PASS'; t13.detail = 'OK'; } else { t13.status = 'FAIL'; t13.detail = r13.error || 'failed'; }
    } else {
      t13.status = 'SKIP'; t13.detail = 'No conversations';
    }
    results.tests.push(t13);
  } catch (e: any) { results.tests.push({ name: '13. Mark Read', status: 'FAIL', detail: e.message }); }

  // ===== TEST 14: Create Post (draft, no publish) =====
  if (IG_ACCOUNT_ID) {
    try {
      var t14 = { name: '14. Create Post (POST /posts) — draft only', status: 'running', detail: '' };
      var r14 = await zernioCreatePost({
        accountId: IG_ACCOUNT_ID,
        caption: '[Aura Test] Post de teste — pode apagar. ' + new Date().toISOString(),
        platform: 'instagram',
      });
      if (r14.success) {
        t14.status = 'PASS';
        var postId = r14.data?._id || r14.data?.id || r14.data?.postId || '';
        t14.detail = 'Post criado: ' + postId;

        // ===== TEST 15: Get Post =====
        if (postId) {
          try {
            var t15 = { name: '15. Get Post (GET /posts/:id)', status: 'running', detail: '' };
            var r15 = await zernioGetPost(postId);
            if (r15.success) { t15.status = 'PASS'; t15.detail = 'OK'; } else { t15.status = 'FAIL'; t15.detail = r15.error || ''; }
            results.tests.push(t15);
          } catch (e: any) { results.tests.push({ name: '15. Get Post', status: 'FAIL', detail: e.message }); }

          // ===== TEST 16: Schedule Post =====
          try {
            var t16 = { name: '16. Schedule Post (POST /posts/schedule?postId=:id)', status: 'running', detail: '' };
            var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            var r16 = await zernioSchedulePost(postId, tomorrow.toISOString());
            if (r16.success) { t16.status = 'PASS'; t16.detail = 'Agendado para ' + tomorrow.toISOString(); } else { t16.status = 'FAIL'; t16.detail = r16.error || ''; }
            results.tests.push(t16);
          } catch (e: any) { results.tests.push({ name: '16. Schedule Post', status: 'FAIL', detail: e.message }); }

          // ===== TEST 17: Post Analytics =====
          try {
            var t17 = { name: '17. Post Analytics (GET /posts/:id/analytics)', status: 'running', detail: '' };
            var r17 = await zernioGetPostAnalytics(postId);
            if (r17.success) { t17.status = 'PASS'; t17.detail = 'OK'; } else { t17.status = 'FAIL'; t17.detail = r17.error || ''; }
            results.tests.push(t17);
          } catch (e: any) { results.tests.push({ name: '17. Post Analytics', status: 'FAIL', detail: e.message }); }
        }
      } else {
        t14.status = 'FAIL'; t14.detail = r14.error || '';
      }
      results.tests.push(t14);
    } catch (e: any) { results.tests.push({ name: '14. Create Post', status: 'FAIL', detail: e.message }); }
  }

  // Calculate summary
  for (var ti = 0; ti < results.tests.length; ti++) {
    results.summary.total++;
    if (results.tests[ti].status === 'PASS') results.summary.passed++;
    else if (results.tests[ti].status === 'FAIL') results.summary.failed++;
  }

  return NextResponse.json(results);
}

// POST — run specific action tests (DM send, outbound DM, delete comment)
export async function POST(request: Request) {
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== TEST: Send DM (reply in conversation) =====
  if (action === 'send_dm') {
    var dmRes = await zernioSendDM(body.conversationId, body.accountId, body.message);
    return NextResponse.json(dmRes);
  }

  // ===== TEST: Send Outbound DM =====
  if (action === 'send_outbound_dm') {
    var outboundRes = await zernioSendOutboundDM({
      accountId: body.accountId,
      recipientId: body.recipientId,
      message: body.message,
      platform: body.platform,
      recipientUsername: body.recipientUsername,
    });
    return NextResponse.json(outboundRes);
  }

  // ===== TEST: Delete Comment =====
  if (action === 'delete_comment') {
    var delRes = await zernioDeleteComment(body.commentId, body.accountId);
    return NextResponse.json(delRes);
  }

  // ===== TEST: Create Comment Automation =====
  if (action === 'create_automation') {
    var result = await zernioCreateCommentAutomation({
      accountId: body.accountId || '',
      trigger: 'comment',
      keywords: ['*'],
      message: body.message || 'Obrigado pelo comentario!',
    });
    return NextResponse.json(result);
  }

  // ===== TEST: Create Broadcast =====
  if (action === 'create_broadcast') {
    var result = await zernioCreateBroadcast({
      accountId: body.accountId || '',
      message: body.message || 'Test broadcast',
    });
    return NextResponse.json(result);
  }

  // ===== TEST: Upload Media =====
  if (action === 'upload_media') {
    if (!body.fileData || !body.filename) {
      return NextResponse.json({ success: false, error: 'fileData (base64) e filename necessarios' });
    }
    var buffer = Buffer.from(body.fileData, 'base64');
    var result = await zernioUploadMedia(buffer, body.filename, body.mimeType || 'image/jpeg');
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}