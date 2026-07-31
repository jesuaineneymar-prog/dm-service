// ============================================================
//  Aura HEALTH CHECK — Testa todas as integracoes
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SOCIAVAULT_KEY, COMPOSIO_KEY, UPLOADPOST_KEY, HIKERAPI_KEY, CRON_SECRET, TURSO_URL, BROWSERLESS_KEY, IG_USERNAME } from '@/lib/config';

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

async function testComposio() {
  if (!COMPOSIO_KEY) return { configured: false, status: 'no_key' };
  try {
    var res = await fetch('https://backend.composio.dev/api/v3.1/tool_router/session', {
      method: 'POST',
      headers: { 'x-api-key': COMPOSIO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolkits: ['tiktok'] }),
    });
    var data = await res.json();
    return { configured: true, status: res.ok ? 'ok' : 'fail', msg: data.error?.message?.slice(0, 80) || 'session created' };
  } catch (e: any) { return { configured: true, status: 'error', msg: e.message }; }
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

export async function GET() {
  var dbOk = false;
  var dbError = '';
  try { await db.prospect.count(); dbOk = true; } catch (e: any) { dbError = e.message; }

  // Test all integrations in parallel
  var [sociavault, uploadpost, composio, hikerapi] = await Promise.all([
    testSociaVault(),
    testUploadPost(),
    testComposio(),
    testHikerAPI(),
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
      composio,
      hikerapi,
    },
  });
}
