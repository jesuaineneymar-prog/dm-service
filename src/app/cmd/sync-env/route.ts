// ============================================================
//  Aura SYNC ENV — sincronizar env vars com Railway
//  Ler, escrever, e sincronizar variaveis de ambiente
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { railwayGetEnvVars, railwaySyncEnvVars, railwayGetDeployments, railwayRedeploy, railwaySetEnvVar } from '@/lib/railway-sync';

export var maxDuration = 60;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  try {
    if (action === 'get_vars') {
      var r = await railwayGetEnvVars();
      if (r.vars) {
        var masked: Record<string, string> = {};
        var keys = Object.keys(r.vars);
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i]; var v = r.vars[k];
          if (v.length > 8) { masked[k] = v.slice(0, 4) + '***' + v.slice(-4); }
          else { masked[k] = v; }
        }
        return NextResponse.json({ success: true, data: masked, count: keys.length });
      }
      return NextResponse.json(r);
    }

    if (action === 'get_vars_raw') {
      var rawVars = await railwayGetEnvVars();
      return NextResponse.json(rawVars);
    }

    if (action === 'set_var') {
      if (!body.name || body.value === undefined) return NextResponse.json({ success: false, error: 'name e value necessarios' });
      var setVarResult = await railwaySetEnvVar(body.name, String(body.value));
      return NextResponse.json(setVarResult);
    }

    if (action === 'sync') {
      var syncUpdates = body.updates || {};
      if (Object.keys(syncUpdates).length === 0) return NextResponse.json({ success: false, error: 'updates necessario' });
      var syncResult = await railwaySyncEnvVars(syncUpdates);
      return NextResponse.json(syncResult);
    }

    if (action === 'sync_cookies') {
      var cookieUpdates: Record<string, string> = {};
      var igB64 = process.env['AURA_IG_COOKIES_B64'];
      var fbB64 = process.env['AURA_FB_COOKIES_B64'];
      if (igB64) cookieUpdates.AURA_IG_COOKIES_B64 = igB64;
      if (fbB64) cookieUpdates.AURA_FB_COOKIES_B64 = fbB64;
      if (Object.keys(cookieUpdates).length === 0) return NextResponse.json({ success: false, error: 'Nenhum cookie em memoria' });
      var cookieSyncResult = await railwaySyncEnvVars(cookieUpdates);
      return NextResponse.json({ success: cookieSyncResult.synced.length > 0, message: cookieSyncResult.synced.length > 0 ? 'Cookies sincronizados' : 'Falha', synced: cookieSyncResult.synced, errors: cookieSyncResult.errors });
    }

    if (action === 'deployments') {
      return NextResponse.json(await railwayGetDeployments());
    }

    if (action === 'redeploy') {
      return NextResponse.json(await railwayRedeploy());
    }

    if (action === 'local_status') {
      var vars = {
        TURSO_URL: !!process.env.TURSO_URL, OR_KEY: !!process.env.OR_KEY,
        META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN, META_PAGE_TOKEN: !!process.env.META_PAGE_TOKEN,
        META_APP_ID: !!process.env.META_APP_ID, META_APP_SECRET: !!process.env.META_APP_SECRET,
        META_PAGE_ID: !!process.env.META_PAGE_ID, IG_USERNAME: !!process.env.IG_USERNAME,
        IG_PASSWORD: !!process.env.IG_PASSWORD, UPLOADPOST_KEY: !!process.env.UPLOADPOST_KEY,
        ZERNIO_KEY: !!process.env.ZERNIO_KEY, RAILWAY_API_TOKEN: !!process.env.RAILWAY_API_TOKEN,
        SCRAPING_BEE_KEY: !!process.env.SCRAPING_BEE_KEY, STEEL_API_KEY: !!process.env.STEEL_API_KEY,
        BROWSERLESS_TOKEN: !!process.env.BROWSERLESS_TOKEN, MANYCHAT_KEY: !!process.env.MANYCHAT_KEY,
        AUTH_PASSWORD: !!process.env.AUTH_PASSWORD, CRON_SECRET: !!process.env.CRON_SECRET,
      };
      var total = Object.keys(vars).length;
      var configured = Object.values(vars).filter(Boolean).length;
      return NextResponse.json({ success: true, data: { vars, total, configured, missing: total - configured } });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
