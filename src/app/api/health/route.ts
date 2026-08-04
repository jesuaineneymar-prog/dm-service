// ============================================================
//  Aura HEALTH CHECK — Testa todas as integracoes
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ARCADE_KEY, UPLOADPOST_KEY, CRON_SECRET, TURSO_URL, BROWSERLESS_KEY, IG_USERNAME, ZERNIO_KEY, ZERNIO_TT_KEY, OR_KEY, OR_URL, OR_MODEL } from '@/lib/config';

async function testSociaVault() {
  var SOCIAVAULT_KEY = process.env.SOCIAVAULT_KEY || process.env.SOCIAVAULT_API_KEY || '';
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

async function testZernio() {
  if (!ZERNIO_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://api.zernio.com/v1/accounts', {
      headers: { 'Authorization': 'Bearer ' + ZERNIO_KEY },
    });
    var data = await res.json();
    var accs = data.accounts || (Array.isArray(data) ? data : []);
    var platforms = accs.map(function(a: any) { return a.platform; });
    return { configured: true, status: res.ok ? 'ok' : 'fail ' + res.status, accounts: accs.length, platforms: platforms };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

async function testZernioTT() {
  if (!ZERNIO_TT_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://api.zernio.com/v1/accounts', {
      headers: { 'Authorization': 'Bearer ' + ZERNIO_TT_KEY },
    });
    var data = await res.json();
    var accs = data.accounts || (Array.isArray(data) ? data : []);
    var platforms = accs.map(function(a: any) { return a.platform; });
    var hasTikTok = platforms.includes('tiktok');
    return { configured: true, status: res.ok ? 'ok' : 'fail ' + res.status, accounts: accs.length, platforms: platforms, tiktok_connected: hasTikTok };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

async function testOpenRouter() {
  if (!OR_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OR_MODEL, messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
    });
    return { configured: true, status: res.ok ? 'ok' : 'fail ' + res.status, model: OR_MODEL };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
}

export async function GET() {
  var dbOk = false;
  var dbError = '';
  try { await db.prospect.count(); dbOk = true; } catch (e: any) { dbError = e.message; }

  // Test all integrations in parallel
  var [sociavault, uploadpost, arcade, zernio, zernio_tt, openrouter] = await Promise.all([
    testSociaVault(),
    testUploadPost(),
    testArcade(),
    testZernio(),
    testZernioTT(),
    testOpenRouter(),
  ]);

  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '4.0.0',
    checks: {
      database: dbOk ? 'ok' : 'error: ' + dbError,
      turso: !!TURSO_URL,
      cron_secret: !!CRON_SECRET,
      ig_username: IG_USERNAME || 'not_set',
      browserless: !!BROWSERLESS_KEY,
      sociavault,
      uploadpost,
      arcade,
      zernio,
      zernio_tt,
      llm: openrouter,
    },
  });
}
// trigger
