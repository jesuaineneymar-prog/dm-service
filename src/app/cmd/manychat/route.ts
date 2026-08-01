// ============================================================
//  Aura MANYCHAT — Controlo completo do ManyChat
//  Instagram + Facebook + TikTok DMs
// ============================================================

import { NextResponse } from 'next/server';
import {
  mcGetAccountInfo,
  mcCheckInstagramConnection,
  mcCheckFacebookConnection,
  mcGetSubscribers,
  mcSendInstagramDM,
  mcSendFacebookDM,
  mcSendTikTokDM,
  mcGetSubscriber,
  mcFindSubscriberByCustomId,
  mcListFlows,
  mcTriggerFlow,
} from '@/lib/manychat';
import { MANYCHAT_KEY } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== STATUS GERAL =====
  if (action === 'status') {
    var results: any = {
      manychat_key_configured: !!MANYCHAT_KEY,
      key_prefix: MANYCHAT_KEY ? MANYCHAT_KEY.slice(0, 8) + '...' : 'not_set',
      platforms: {},
    };

    // Testar conexao com cada plataforma
    var igResult = await mcCheckInstagramConnection();
    results.platforms.instagram = igResult.success
      ? { status: 'connected', data: igResult.data }
      : { status: 'error', error: igResult.error };

    var fbResult = await mcCheckFacebookConnection();
    results.platforms.facebook = fbResult.success
      ? { status: 'connected', data: fbResult.data }
      : { status: 'error', error: fbResult.error };

    var acctResult = await mcGetAccountInfo();
    results.account = acctResult.success ? acctResult.data : { error: acctResult.error };

    return NextResponse.json({ success: true, type: 'manychat_status', ...results });
  }

  // ===== TESTE DE CONEXAO =====
  if (action === 'test_connection') {
    if (!MANYCHAT_KEY) {
      return NextResponse.json({ success: false, error: 'MANYCHAT_API_KEY nao configurada no Vercel' });
    }
    var testResult = await mcGetAccountInfo();
    if (testResult.success) {
      return NextResponse.json({
        success: true,
        type: 'manychat_connected',
        message: 'ManyChat API conectada com sucesso!',
        account: testResult.data,
      });
    }
    return NextResponse.json({
      success: false,
      error: 'Falha na conexao ManyChat: ' + (testResult.error || 'erro desconhecido'),
    });
  }

  // ===== ENVIAR DM INSTAGRAM =====
  if (action === 'send_ig_dm') {
    var subId = body.subscriberId || '';
    var igMsg = body.message || '';
    if (!subId) return NextResponse.json({ success: false, error: 'subscriberId necessario' });
    if (!igMsg) return NextResponse.json({ success: false, error: 'message necessario' });

    var sendResult = await mcSendInstagramDM({
      subscriberId: subId,
      message: igMsg,
      buttons: body.buttons,
    });

    if (sendResult.success) {
      return NextResponse.json({
        success: true, type: 'ig_dm_sent',
        subscriberId: subId, message: igMsg, data: sendResult.data,
      });
    }
    return NextResponse.json({ success: false, error: 'Erro ao enviar IG DM: ' + sendResult.error });
  }

  // ===== ENVIAR DM FACEBOOK =====
  if (action === 'send_fb_dm') {
    var fbSubId = body.subscriberId || '';
    var fbMsg = body.message || '';
    if (!fbSubId) return NextResponse.json({ success: false, error: 'subscriberId necessario' });
    if (!fbMsg) return NextResponse.json({ success: false, error: 'message necessario' });

    var fbSendResult = await mcSendFacebookDM({
      subscriberId: fbSubId,
      message: fbMsg,
      buttons: body.buttons,
    });

    if (fbSendResult.success) {
      return NextResponse.json({
        success: true, type: 'fb_dm_sent',
        subscriberId: fbSubId, message: fbMsg, data: fbSendResult.data,
      });
    }
    return NextResponse.json({ success: false, error: 'Erro ao enviar FB DM: ' + fbSendResult.error });
  }

  // ===== ENVIAR DM TIKTOK =====
  if (action === 'send_tt_dm') {
    var ttSubId = body.subscriberId || '';
    var ttMsg = body.message || '';
    if (!ttSubId) return NextResponse.json({ success: false, error: 'subscriberId necessario' });
    if (!ttMsg) return NextResponse.json({ success: false, error: 'message necessario' });

    var ttSendResult = await mcSendTikTokDM({
      subscriberId: ttSubId,
      message: ttMsg,
    });

    if (ttSendResult.success) {
      return NextResponse.json({
        success: true, type: 'tt_dm_sent',
        subscriberId: ttSubId, message: ttMsg, data: ttSendResult.data,
      });
    }
    return NextResponse.json({ success: false, error: 'Erro ao enviar TikTok DM: ' + ttSendResult.error });
  }

  // ===== LISTAR SUBSCRIBERS =====
  if (action === 'list_subscribers') {
    var listResult = await mcGetSubscribers({
      platform: body.platform,
      limit: body.limit || 50,
      status: body.status,
    });
    if (!listResult.success) {
      return NextResponse.json({ success: false, error: listResult.error });
    }
    return NextResponse.json({
      success: true, type: 'manychat_subscribers', data: listResult.data,
    });
  }

  // ===== BUSCAR SUBSCRIBER POR ID =====
  if (action === 'get_subscriber') {
    var gSubId = body.subscriberId || '';
    if (!gSubId) return NextResponse.json({ success: false, error: 'subscriberId necessario' });
    var gResult = await mcGetSubscriber(gSubId);
    if (!gResult.success) return NextResponse.json({ success: false, error: gResult.error });
    return NextResponse.json({ success: true, data: gResult.data });
  }

  // ===== BUSCAR POR CUSTOM ID =====
  if (action === 'find_subscriber') {
    var customId = body.customId || '';
    if (!customId) return NextResponse.json({ success: false, error: 'customId necessario' });
    var fResult = await mcFindSubscriberByCustomId(customId);
    if (!fResult.success) return NextResponse.json({ success: false, error: fResult.error });
    return NextResponse.json({ success: true, data: fResult.data });
  }

  // ===== LISTAR FLOWS =====
  if (action === 'list_flows') {
    var flowsResult = await mcListFlows();
    if (!flowsResult.success) return NextResponse.json({ success: false, error: flowsResult.error });
    return NextResponse.json({ success: true, type: 'manychat_flows', data: flowsResult.data });
  }

  // ===== ATIVAR FLOW =====
  if (action === 'trigger_flow') {
    var tSubId = body.subscriberId || '';
    var tFlowId = body.flowId || '';
    if (!tSubId || !tFlowId) {
      return NextResponse.json({ success: false, error: 'subscriberId e flowId necessarios' });
    }
    var tResult = await mcTriggerFlow({ subscriberId: tSubId, flowId: tFlowId });
    if (!tResult.success) return NextResponse.json({ success: false, error: tResult.error });
    return NextResponse.json({ success: true, type: 'flow_triggered', data: tResult.data });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
