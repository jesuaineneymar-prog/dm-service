// Cron: /api/cron/meta-token-monitor — Verifica token Meta diariamente
// Se invalido, tenta auto-refresh. Se nao conseguir, guarda alerta no DB.
// Chamado pelo CRON_SECRET a cada 24h

import { NextResponse } from 'next/server';
import { CRON_SECRET } from '@/lib/config';
import { debugMetaToken, getPermanentPageToken } from '@/lib/meta-token-manager';
import { getDb } from '@/lib/db';

async function saveSetting(key: string, value: string) {
  try { var db = await getDb(); await db.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }); } catch(e) {}
}

async function loadSetting(key: string): Promise<string> {
  try { var db = await getDb(); var r = await db.systemSetting.findUnique({ where: { key } }); return r?.value || ''; } catch(e) { return ''; }
}

export async function GET(request: Request) {
  var url = new URL(request.url);
  var secret = url.searchParams.get('secret') || '';
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  var log: string[] = [];
  var now = new Date().toISOString();
  log.push('Meta token monitor: ' + now);

  var pageToken = await loadSetting('meta_page_token');
  var longUserToken = await loadSetting('meta_user_token_long');
  var pageId = await loadSetting('meta_page_id');

  if (!pageToken) {
    log.push('No page token in DB.');
    await saveSetting('meta_token_monitor_log', JSON.stringify({ timestamp: now, status: 'no_token', log }));
    return NextResponse.json({ status: 'no_token', log });
  }

  // Check page token
  var pageCheck = await debugMetaToken(pageToken);
  log.push('Page token valid: ' + pageCheck.isValid + ' | expires: ' + (pageCheck.expiresAt === 0 ? 'NEVER' : String(pageCheck.expiresAt)));

  if (pageCheck.isValid) {
    log.push('OK - no action needed.');
    await saveSetting('meta_token_monitor_log', JSON.stringify({ timestamp: now, status: 'valid', log }));
    await saveSetting('meta_token_alert', '');
    return NextResponse.json({ status: 'valid', log });
  }

  // INVALID - try auto-refresh from long-lived user token
  log.push('Page token INVALID! Trying auto-refresh...');

  if (!longUserToken) {
    log.push('No user token for refresh. Setting alert.');
    await saveSetting('meta_token_alert', JSON.stringify({ timestamp: now, level: 'critical', message: 'Page token invalido sem user token. Gera novo token em developers.facebook.com/tools/explorer/' }));
    await saveSetting('meta_token_monitor_log', JSON.stringify({ timestamp: now, status: 'critical', log }));
    return NextResponse.json({ status: 'critical', log });
  }

  var userCheck = await debugMetaToken(longUserToken);
  log.push('User token valid: ' + userCheck.isValid);

  if (userCheck.isValid) {
 var ptResult = await getPermanentPageToken(longUserToken);
    if (ptResult.success && ptResult.pageToken) {
      await saveSetting('meta_page_token', ptResult.pageToken);
      if (ptResult.pageId) await saveSetting('meta_page_id', ptResult.pageId);
      log.push('AUTO-REFRESH SUCCESS! New page token saved.');
      await saveSetting('meta_token_monitor_log', JSON.stringify({ timestamp: now, status: 'auto_refreshed', log }));
      await saveSetting('meta_token_alert', '');
      return NextResponse.json({ status: 'auto_refreshed', log });
    } else {
      log.push('Refresh failed: ' + (ptResult.error || 'unknown'));
    }
  } else {
    log.push('User token also expired.');
  }

  log.push('ALL RECOVERY FAILED. Needs manual intervention.');
  await saveSetting('meta_token_alert', JSON.stringify({ timestamp: now, level: 'critical', message: 'Todos tokens expirados. Gera novo token em developers.facebook.com/tools/explorer/ com pages_messaging' }));
  await saveSetting('meta_token_monitor_log', JSON.stringify({ timestamp: now, status: 'all_expired', log }));
  return NextResponse.json({ status: 'all_expired', log });
}
