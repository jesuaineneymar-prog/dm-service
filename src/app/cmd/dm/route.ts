// Route: /cmd/dm — Social DMs (IG + FB)
// INTEGRADO COM:
//   - instagram-private-api (IG DMs sem browser — rapido)
//   - NSTBrowser (FB DMs via anti-detect browser)
//   - Meta Graph API (FB Page DMs — so para PSIDs existentes)
//   - Steel.dev (fallback — se configurado)

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sendIGPrivateDM, checkIGPrivateSession, listIGInbox } from '@/lib/ig-private-dm';
import { nstFBSendDM, nstIGSendDM, nstStatus } from '@/lib/nst-browser';
import { IG_PRIVATE_API_ENABLED } from '@/lib/config';

export var maxDuration = 120;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';
  var platform = body.platform || 'instagram';

  // === STATUS ===
  if (action === 'status') {
    var igSession = IG_PRIVATE_API_ENABLED ? await checkIGPrivateSession().catch(function() { return { valid: false }; }) : { valid: false };
    var nst = await nstStatus();
    return NextResponse.json({
      success: true,
      ig_private_api: IG_PRIVATE_API_ENABLED ? 'enabled' : 'disabled',
      ig_session_valid: igSession.valid,
      ig_session_user: (igSession as any).username || null,
      nst_running: nst.nstRunning,
      nst_profiles: nst.profiles.length,
      nst_url: nst.nstUrl,
      supported_platforms: ['instagram', 'facebook'],
      ig_dm_engine: IG_PRIVATE_API_ENABLED ? 'instagram-private-api' : 'not_configured',
      fb_dm_engine: nst.nstRunning ? 'nstbrowser' : 'not_available',
    });
  }

  // === CHECK IG SESSION ===
  if (action === 'check_ig_session') {
    var sessionInfo = await checkIGPrivateSession();
    return NextResponse.json(sessionInfo);
  }

  // === LIST IG INBOX ===
  if (action === 'ig_inbox') {
    var inbox = await listIGInbox(body.limit || 20);
    return NextResponse.json(inbox);
  }

  // === NST STATUS ===
  if (action === 'nst_status') {
    var status = await nstStatus();
    return NextResponse.json({ success: true, ...status });
  }

  // === ENVIAR DM ===
  if (action === 'send') {
    var username = (body.username || '').replace(/^@/, '');
    var message = body.message || '';
    if (!username || !message) return NextResponse.json({ success: false, error: 'username e mensagem necessarios' });

    // Instagram DM
    if (platform === 'instagram') {
      // Primario: instagram-private-api (rapido, sem browser)
      if (IG_PRIVATE_API_ENABLED) {
        var igResult = await sendIGPrivateDM(username, message);
        if (igResult.success) return NextResponse.json({ ...igResult, provider: 'ig_private_api' });
        // Fallback: NSTBrowser IG
        var nstIgResult = await nstIGSendDM(username, message);
        return NextResponse.json(nstIgResult);
      }
      // Sem private API: NSTBrowser direto
      var nstOnlyResult = await nstIGSendDM(username, message);
      return NextResponse.json(nstOnlyResult);
    }

    // Facebook DM
    if (platform === 'facebook') {
      var fbResult = await nstFBSendDM(username, message);
      return NextResponse.json(fbResult);
    }
  }

  // === BULK DM ===
  if (action === 'bulk_send') {
    var users = body.users || [];
    if (!Array.isArray(users) || !users.length) return NextResponse.json({ success: false, error: 'users necessario (array)' });
    if (users.length > 50) return NextResponse.json({ success: false, error: 'Maximo 50 por batch' });

    var results: any[] = [];
    var delay = body.delay || 5000;

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var targetUsername = (u.username || '').replace(/^@/, '');
      var msg = u.message || body.defaultMessage || '';
      var targetPlatform = u.platform || platform;

      if (!targetUsername || !msg) {
        results.push({ username: targetUsername, success: false, error: 'username ou mensagem vazio' });
        continue;
      }

      try {
        var r: any;
        if (targetPlatform === 'facebook') {
          r = await nstFBSendDM(targetUsername, msg);
        } else if (IG_PRIVATE_API_ENABLED) {
          r = await sendIGPrivateDM(targetUsername, msg);
        } else {
          r = await nstIGSendDM(targetUsername, msg);
        }
        results.push({ username: targetUsername, ...r });
      } catch (e: any) {
        results.push({ username: targetUsername, success: false, error: e.message });
      }

      // Delay entre mensagens (anti-ban)
      if (i < users.length - 1) await new Promise(function(res) { setTimeout(res, delay); });
    }

    var sent = results.filter(function(r) { return r.success; }).length;
    var failed = results.filter(function(r) { return !r.success; }).length;
    return NextResponse.json({ success: sent > 0, sent: sent, failed: failed, total: results.length, results: results });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}