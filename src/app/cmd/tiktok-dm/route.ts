// ============================================================
//  AURA TIKTOK DM — Controlo de DMs via Playwright + Browserless
//  Alternativa ao ManyChat TikTok (nao disponivel em Angola)
// ============================================================

import { NextResponse } from 'next/server';
import {
  tiktokSendDM,
  tiktokBulkDM,
  tiktokDMStatus,
  tiktokLoginAndSave,
  tiktokClearSession,
  tiktokScreenshot,
} from '@/lib/tiktok-dm';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 120; // TikTok DM precisa de tempo extra

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== STATUS =====
  if (action === 'status') {
    var status = await tiktokDMStatus();
    return NextResponse.json({
      success: true,
      type: 'tiktok_dm_status',
      platform: 'tiktok',
      method: 'playwright_browserless',
      adaptedFrom: 'AliMantach/tiktok-streak-bot',
      ...status,
    });
  }

  // ===== LOGIN E GUARDAR SESSAO =====
  if (action === 'login') {
    var loginResult = await tiktokLoginAndSave();
    if (loginResult.success) {
      return NextResponse.json({
        success: true,
        type: 'tiktok_login_success',
        message: 'Sessao TikTok guardada com sucesso',
        data: loginResult.data,
      });
    }
    return NextResponse.json({
      success: false,
      error: 'Login TikTok falhou: ' + (loginResult.error || 'erro desconhecido'),
      hint: 'Configure TIKTOK_USERNAME e TIKTOK_PASSWORD no Vercel, ou use o action "screenshot" para ver o estado do browser.',
    });
  }

  // ===== ENVIAR DM A UM USUARIO =====
  if (action === 'send') {
    var username = body.username || '';
    var message = body.message || '';
    if (!username) return NextResponse.json({ success: false, error: 'username necessario (sem @)' });
    if (!message) return NextResponse.json({ success: false, error: 'message necessario' });

    // Remover @ se o usuario incluir
    username = username.replace(/^@/, '');

    var sendResult = await tiktokSendDM({ username: username, message: message });
    if (sendResult.success) {
      return NextResponse.json({
        success: true,
        type: 'tiktok_dm_sent',
        username: username,
        message: message,
        ...sendResult,
      });
    }
    return NextResponse.json({ success: false, error: 'Erro ao enviar TikTok DM: ' + (sendResult.error || 'desconhecido') });
  }

  // ===== ENVIAR DMs EM MASSA =====
  if (action === 'bulk_send') {
    var users = body.users || [];
    var defaultMessage = body.defaultMessage || '';
    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, error: 'users necessario (array de {username, message?})' });
    }
    if (users.length > 50) {
      return NextResponse.json({ success: false, error: 'Maximo 50 usuarios por batch' });
    }

    var bulkResult = await tiktokBulkDM({
      users: users,
      defaultMessage: defaultMessage,
      delayBetweenUsers: body.delay || 3000,
    });

    return NextResponse.json({
      success: bulkResult.success,
      type: 'tiktok_bulk_dm_result',
      sent: bulkResult.sent,
      failed: bulkResult.failed,
      total: users.length,
      details: bulkResult.details,
    });
  }

  // ===== LIMPAR SESSAO =====
  if (action === 'clear_session') {
    await tiktokClearSession();
    return NextResponse.json({ success: true, type: 'tiktok_session_cleared', message: 'Sessao TikTok removida' });
  }

  // ===== SCREENSHOT (DEBUG) =====
  if (action === 'screenshot') {
    var ssResult = await tiktokScreenshot();
    if (ssResult.success) {
      return NextResponse.json({
        success: true,
        type: 'tiktok_screenshot',
        screenshot: ssResult.screenshot,
        format: 'base64_png',
      });
    }
    return NextResponse.json({ success: false, error: 'Screenshot falhou: ' + (ssResult.error || 'desconhecido') });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}