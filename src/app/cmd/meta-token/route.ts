// Route: /cmd/meta-token — Meta token management & auto-refresh
// POST actions: status, refresh, debug, save_tokens, send_dm

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getMetaTokenStatus,
  fullTokenRefresh,
  debugMetaToken,
  sendFBGraphDM,
} from '@/lib/meta-token-manager';
import { getDb } from '@/lib/db';

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  if (action === 'status') {
    return NextResponse.json(await getMetaTokenStatus());
  }

  if (action === 'debug') {
    var token = body.token || '';
    if (!token) return NextResponse.json({ error: 'token necessario' });
    return NextResponse.json(await debugMetaToken(token));
  }

  if (action === 'refresh') {
    var shortToken = body.short_lived_token || '';
    if (!shortToken) return NextResponse.json({ error: 'Envia um short_lived_token (do Graph API Explorer)' });
    var result = await fullTokenRefresh(shortToken);
    if (result.success && result.permanentPageToken) {
      try {
        var db = await getDb();
        await db.systemSetting.upsert({ where: { key: 'meta_page_token' }, update: { value: result.permanentPageToken }, create: { key: 'meta_page_token', value: result.permanentPageToken } });
        if (result.longLivedToken) await db.systemSetting.upsert({ where: { key: 'meta_user_token_long' }, update: { value: result.longLivedToken }, create: { key: 'meta_user_token_long', value: result.longLivedToken } });
        if (result.pageId) await db.systemSetting.upsert({ where: { key: 'meta_page_id' }, update: { value: result.pageId }, create: { key: 'meta_page_id', value: result.pageId } });
      } catch(e) {}
    }
    return NextResponse.json(result);
  }

  if (action === 'save_tokens') {
    var pageToken = body.page_token || '';
    var pageId = body.page_id || '';
    var userToken = body.user_token || '';
    if (!pageToken) return NextResponse.json({ error: 'page_token necessario' });
    try {
      var db2 = await getDb();
      if (pageToken) await db2.systemSetting.upsert({ where: { key: 'meta_page_token' }, update: { value: pageToken }, create: { key: 'meta_page_token', value: pageToken } });
      if (userToken) await db2.systemSetting.upsert({ where: { key: 'meta_user_token_long' }, update: { value: userToken }, create: { key: 'meta_user_token_long', value: userToken } });
      if (pageId) await db2.systemSetting.upsert({ where: { key: 'meta_page_id' }, update: { value: pageId }, create: { key: 'meta_page_id', value: pageId } });
      return NextResponse.json({ success: true, message: 'Tokens salvos no DB' });
    } catch(e: any) { return NextResponse.json({ success: false, error: e.message }); }
  }

  if (action === 'send_dm') {
    var recipientId = body.recipient_id || '';
    var message = body.message || '';
    if (!recipientId || !message) return NextResponse.json({ error: 'recipient_id e message necessarios' });
    var dmResult = await sendFBGraphDM(recipientId, message);
    return NextResponse.json(dmResult);
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
