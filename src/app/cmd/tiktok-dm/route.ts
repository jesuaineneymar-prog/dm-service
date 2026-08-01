// ============================================================
//  AURA TIKTOK DM — Controlo de DMs via Steel.dev + Browserless
//  Steel.dev: proxy residencial, CAPTCHA solving, fingerprinting
//  Browserless.io: fallback (sem anti-detection)
//  Adaptado de: AliMantach/tiktok-streak-bot
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
      method: 'steel_dev_primary',
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

  // ===== STEEL API TEST (debug) =====
  if (action === 'steel_test') {
    var STEEL_API = 'https://api.steel.dev/v1';
    var STEEL_API_KEY = process.env.STEEL_API_KEY || '';
    try {
      var t0 = Date.now();
      // 1. Criar sessao Steel
      var sRes = await fetch(STEEL_API + '/sessions', {
        method: 'POST',
        headers: { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 120000 }),
      });
      var sText = await sRes.text();
      var sData;
      try { sData = JSON.parse(sText); } catch(e) { sData = { error: sText }; }
      var createMs = Date.now() - t0;
      var sid = sData.id || '';

      var results: any = { sessionCreated: sRes.status, sessionId: sid, createMs };

      if (sid) {
        // Testar scrape endpoint (REST, sem WebSocket)
        var scrapeRes = await fetch(STEEL_API + '/scrape', {
          method: 'POST', headers: { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.tiktok.com', format: ['markdown'], sessionId: sid }),
        });
        results.scrape = { status: scrapeRes.status };
        try { results.scrape.body = JSON.parse(await scrapeRes.text()); } catch(e) { results.scrape.raw = (await scrapeRes.text()).slice(0, 300); }

        // Screenshot
        var ssRes = await fetch(STEEL_API + '/sessions/' + sid + '/screenshot', {
          method: 'POST', headers: { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        results.screenshot = ssRes.status;

        // Liberar
        await fetch(STEEL_API + '/sessions/' + sid + '/release', { method: 'POST', headers: { 'steel-api-key': STEEL_API_KEY } });
        results.released = 200;
      }

      return NextResponse.json({ success: true, type: 'steel_test', ...results, totalMs: Date.now() - t0 });
    } catch (e: any) {
      return NextResponse.json({ success: false, error: 'Steel test falhou: ' + e.message });
    }
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}