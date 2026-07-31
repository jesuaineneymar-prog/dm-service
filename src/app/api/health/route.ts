// ============================================================
//  Aura HEALTH CHECK — Testa todas as integracoes
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SOCIAVAULT_KEY, ARCADE_KEY, UPLOADPOST_KEY, HIKERAPI_KEY, CRON_SECRET, TURSO_URL, BROWSERLESS_KEY, IG_USERNAME, ZERNIO_KEY } from '@/lib/config';

async function testSociaVault() {
  if (!SOCIAVAULT_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://api.sociavault.com/v1/credits', {
      headers: { 'X-API-Key': SOCIAVAULT_KEY },
    });
    var data = await res.json();
    return { configured: true, status: res.ok ? 'ok' : 'fail', credits: data.credits, plan: data.subscriptionStatus };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

async function testUploadPost() {
  if (!UPLOADPOST_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://api.upload-post.com/api/uploadposts/users', {
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY },
    });
    var data = await res.json();
    return { configured: true, status: data.success ? 'ok' : 'fail', msg: data.success ? 'connected' : (data.message || 'unknown error') };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

async function testArcade() {
  return { configured: !!ARCADE_KEY, status: ARCADE_KEY ? 'ok' : 'no_key' };
}

async function testHikerAPI() {
  if (!HIKERAPI_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://api.hikerapi.com/v1/user/by/username?username=instagram', {
      headers: { 'x-access-key': HIKERAPI_KEY },
    });
    return { configured: true, status: res.ok ? 'ok' : 'fail ' + res.status };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

async function testZernio() {
  if (!ZERNIO_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://api.zernio.com/v1/accounts', {
      headers: { 'Authorization': 'Bearer ' + ZERNIO_KEY },
    });
    var data = await res.json();
    var count = data.accounts ? data.accounts.length : 0;
    return { configured: true, status: res.ok ? 'ok' : 'fail ' + res.status, accounts: count };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

export async function GET() {
  var dbOk = false;
  var dbError = '';
  try { await db.prospect.count(); dbOk = true; } catch (e: any) { dbError = e.message; }

  // Test all integrations in parallel
  var [sociavault, uploadpost, arcade, hikerapi, zernio] = await Promise.all([
    testSociaVault(),
    testUploadPost(),
    testArcade(),
    testHikerAPI(),
    testZernio(),
  ]);

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    checks: {
      database: dbOk ? 'ok' : 'error: ' + dbError,
      turso: !!TURSO_URL,
      cron_secret: !!CRON_SECRET,
      ig_username: IG_USERNAME || 'not_set',
      browserless: !!BROWSERLESS_KEY,
      sociavault,
      uploadpost,
      arcade,
      hikerapi,
      zernio,
    },
  });
}
