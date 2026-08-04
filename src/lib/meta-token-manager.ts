// ============================================================
//  AURA META TOKEN MANAGER — Auto-refresh de tokens Meta
//  Page token e permanente (nao expira), mas se invalidado,
//  este modulo tenta renovar automaticamente usando o app_secret.
//  Tambem expoe uma API para forcar refresh.
// ============================================================

import { META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN, META_PAGE_ID, META_PAGE_TOKEN } from './config';

var GRAPH_API = 'https://graph.facebook.com/v21.0';

// === DB FALLBACK: load tokens from DB if env vars not set ===

async function loadSetting(key: string): Promise<string> {
  try { var dbModule = await import('./db'); var db = await dbModule.db; var r = await db.systemSetting.findUnique({ where: { key } }); return r?.value || ''; } catch(e) { return ''; }
}

async function getEffectivePageToken(): Promise<string> {
  if (META_PAGE_TOKEN) return META_PAGE_TOKEN;
  return await loadSetting('meta_page_token');
}

async function getEffectivePageId(): Promise<string> {
  if (META_PAGE_ID) return META_PAGE_ID;
  return await loadSetting('meta_page_id');
}

async function getEffectiveAccessToken(): Promise<string> {
  if (META_ACCESS_TOKEN) return META_ACCESS_TOKEN;
  return await loadSetting('meta_user_token_long');
}

interface TokenInfo {
  isValid: boolean;
  expiresAt: number | null;
  type: string;
  scopes: string[];
}

// === DEBUG TOKEN ===

export async function debugMetaToken(token: string): Promise<TokenInfo> {
  try {
    // debug_token precisa de app access token (app_id|app_secret), nao user token
    var appToken = '';
    if (META_APP_ID && META_APP_SECRET) {
      appToken = META_APP_ID + '|' + META_APP_SECRET;
    }
    var url = GRAPH_API + '/debug_token?input_token=' + encodeURIComponent(token);
    if (appToken) url += '&access_token=' + appToken;
    var res = await fetch(url);
    var data = await res.json();
    if (data.error) return { isValid: false, expiresAt: null, type: 'unknown', scopes: [] };
    var d = data.data;
    return {
      isValid: d.is_valid,
      expiresAt: d.expires_at,
      type: d.type,
      scopes: d.scopes || d.granular_scopes?.map(function(s: any) { return s.scope; }) || []
    };
  } catch (e) { return { isValid: false, expiresAt: null, type: 'unknown', scopes: [] }; }
}

// === EXCHANGE SHORT-LIVED FOR LONG-LIVED ===

export async function exchangeForLongLived(shortLivedToken: string): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!META_APP_ID || !META_APP_SECRET) {
    return { success: false, error: 'META_APP_ID e META_APP_SECRET nao configurados no Railway' };
  }
  try {
    var url = GRAPH_API + '/oauth/access_token?grant_type=fb_exchange_token' +
      '&client_id=' + META_APP_ID +
      '&client_secret=' + META_APP_SECRET +
      '&fb_exchange_token=' + shortLivedToken;
    var res = await fetch(url);
    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, token: data.access_token };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === GET PERMANENT PAGE TOKEN FROM LONG-LIVED USER TOKEN ===

export async function getPermanentPageToken(longLivedUserToken: string): Promise<{ success: boolean; pageToken?: string; pageId?: string; pageName?: string; error?: string }> {
  try {
    var url = GRAPH_API + '/me/accounts?fields=id,name,access_token&access_token=' + longLivedUserToken;
    var res = await fetch(url);
    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    if (!data.data || !data.data.length) return { success: false, error: 'Nenhuma pagina encontrada' };
    var page = data.data[0];
    return { success: true, pageToken: page.access_token, pageId: page.id, pageName: page.name };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === FULL AUTO-REFRESH: short-lived → long-lived → permanent page token ===

export async function fullTokenRefresh(shortLivedToken: string): Promise<{ success: boolean; longLivedToken?: string; permanentPageToken?: string; pageId?: string; pageName?: string; error?: string }> {
  // Step 1: Exchange for long-lived user token
  var llResult = await exchangeForLongLived(shortLivedToken);
  if (!llResult.success || !llResult.token) return { success: false, error: 'Falha ao obter token longo: ' + (llResult.error || 'unknown') };

  // Step 2: Get permanent page token
  var ptResult = await getPermanentPageToken(llResult.token);
  if (!ptResult.success) return { success: false, error: 'Falha ao obter page token: ' + (ptResult.error || 'unknown') };

  return {
    success: true,
    longLivedToken: llResult.token,
    permanentPageToken: ptResult.pageToken,
    pageId: ptResult.pageId,
    pageName: ptResult.pageName
  };
}

// === GET CURRENT STATUS ===

export async function getMetaTokenStatus(): Promise<any> {
  var pageToken = await getEffectivePageToken();
  var pageId = await getEffectivePageId();
  var userToken = await getEffectiveAccessToken();
  var results: any = {
    appId: META_APP_ID || 'not configured',
    appSecretSet: !!META_APP_SECRET,
    pageId: pageId || 'not configured',
    pageTokenSet: !!pageToken,
    userTokenSet: !!userToken,
    checks: {} as any
  };

  if (pageToken) {
    results.checks.pageToken = await debugMetaToken(pageToken);
  }

  return results;
}

// === SEND FACEBOOK DM VIA GRAPH API ===

export async function sendFBGraphDM(recipientId: string, message: string, pageTokenOverride?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  var token = pageTokenOverride || await getEffectivePageToken();
  var pageId = await getEffectivePageId();
  if (!token) return { success: false, error: 'META_PAGE_TOKEN nao configurado (env ou DB)' };
  if (!pageId) return { success: false, error: 'META_PAGE_ID nao configurado' };

  try {
    var url = GRAPH_API + '/' + pageId + '/messages';
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
        messaging_type: 'MESSAGE_TAG'
      })
    });
    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, messageId: data.message_id };
  } catch (e: any) { return { success: false, error: e.message }; }
}
