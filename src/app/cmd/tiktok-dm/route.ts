// ============================================================
//  AURA SOCIAL DM — Controlo de DMs via Steel.dev + Browserless
//  Instagram + Facebook DMs com anti-detection
//  Browserless.io: fallback (sem anti-detection)
// ============================================================

import { NextResponse } from 'next/server';
import {
  steelIGSendDM,
  steelFBSendDM,
  steelBulkDM,
  steelCreateLoginSession,
  steelCheckLogin,
  steelSocialDMStatus,
  steelClearSessions,
  steelScreenshot,
} from '@/lib/steel-social-dm';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 120;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';
  var platform = body.platform || 'instagram';

  // ===== STATUS =====
  if (action === 'status') {
    var status = await steelSocialDMStatus();
    return NextResponse.json({ success: true, type: 'social_dm_status', ...status });
  }

  // ===== CREATE LOGIN SESSION (abre browser para login manual) =====
  if (action === 'login' || action === 'create_login') {
    var p: 'instagram' | 'facebook' = platform === 'facebook' ? 'facebook' : 'instagram';
    return NextResponse.json(await steelCreateLoginSession(p));
  }

  // ===== CHECK IF LOGGED IN =====
  if (action === 'check_login') {
    var clp: 'instagram' | 'facebook' = platform === 'facebook' ? 'facebook' : 'instagram';
    return NextResponse.json(await steelCheckLogin(clp));
  }

  // ===== ENVIAR DM A UM USUARIO =====
  if (action === 'send') {
    var username = body.username || '';
    var message = body.message || '';
    if (!username) return NextResponse.json({ success: false, error: 'username necessario (sem @)' });
    if (!message) return NextResponse.json({ success: false, error: 'message necessario' });
    username = username.replace(/^@/, '');

    if (platform === 'facebook') {
      return NextResponse.json(await steelFBSendDM({ username: username, message: message }));
    }
    return NextResponse.json(await steelIGSendDM({ username: username, message: message }));
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

    var dmPlatform: 'instagram' | 'facebook' = platform === 'facebook' ? 'facebook' : 'instagram';
    return NextResponse.json(await steelBulkDM({
      platform: dmPlatform,
      users: users,
      defaultMessage: defaultMessage,
      delayBetweenUsers: body.delay || 3000,
    }));
  }

  // ===== LIMPAR SESSAO =====
  if (action === 'clear_session') {
    await steelClearSessions(platform === 'facebook' ? 'facebook' : 'instagram');
    return NextResponse.json({ success: true, message: 'Sessao removida' });
  }

  // ===== SCREENSHOT (DEBUG) =====
  if (action === 'screenshot') {
    var ssPlatform: 'instagram' | 'facebook' = platform === 'facebook' ? 'facebook' : 'instagram';
    return NextResponse.json(await steelScreenshot(ssPlatform, body.url));
  }

  // ===== STEEL API TEST (debug) =====
  if (action === 'steel_test') {
    var STEEL_API = 'https://api.steel.dev/v1';
    var STEEL_API_KEY = process.env.STEEL_API_KEY || '';
    try {
      var t0 = Date.now();
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
        var scrapeRes = await fetch(STEEL_API + '/scrape', {
          method: 'POST', headers: { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.instagram.com', format: ['markdown'], sessionId: sid }),
        });
        results.scrape = { status: scrapeRes.status };
        try { results.scrape.body = JSON.parse(await scrapeRes.text()); } catch(e) { results.scrape.raw = (await scrapeRes.text()).slice(0, 300); }

        var ssRes = await fetch(STEEL_API + '/sessions/' + sid + '/screenshot', {
          method: 'POST', headers: { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        results.screenshot = ssRes.status;

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