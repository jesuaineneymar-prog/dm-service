// ============================================================
//  Aura META GRAPH API — Proactive DMs via Facebook/Instagram
//  Human pacing: 10-15 min delay between messages
//  Usa Meta Graph API com access token de pagina
//  Suporta: enviar DMs a qualquer pessoa (nao so seguidores)
//  Human-like delays, rate limiting, logging
// ============================================================

import { META_ACCESS_TOKEN } from './config';
import { db } from './db';

var GRAPH_BASE = 'https://graph.facebook.com/v21.0';
var _pageTokenCache: string | null = null;
var _pageTokenFetchedAt = 0;
var PAGE_TOKEN_TTL = 3600000; // 1 hour

// Auto-fetch page access token from user token
async function getPageAccessToken(): Promise<string | null> {
  if (!_pageTokenCache || Date.now() - _pageTokenFetchedAt > PAGE_TOKEN_TTL) {
    try {
      var token = await getMetaToken();
      // Try fetching from /me/accounts (user token → page token)
      var res = await fetch(GRAPH_BASE + '/me/accounts?fields=id,name,access_token&access_token=' + token);
      var data = await res.json();
      if (data.data?.[0]?.access_token) {
        _pageTokenCache = data.data[0].access_token;
        _pageTokenFetchedAt = Date.now();
        console.log('[Meta] Page token obtido para:', data.data[0].name, '(ID:', data.data[0].id + ')');
      } else {
        // If /me/accounts fails, the token might be a page token already — use it directly
        console.log('[Meta] /me/accounts falhou, tentando usar token como page token...');
        var testRes = await fetch(GRAPH_BASE + '/me?fields=id,name&access_token=' + token);
        var testData = await testRes.json();
        if (testData.id && testData.name && !testData.error) {
          _pageTokenCache = token;
          _pageTokenFetchedAt = Date.now();
          console.log('[Meta] Token usado directamente como page token para:', testData.name);
        }
      }
    } catch (e) { /* keep cached or null */ }
  }
  return _pageTokenCache;
}

// Get Meta token: checks DB first, then env var
async function getMetaToken(): Promise<string> {
  // Check database first
  try {
    var dbModule = await import('./db');
    var db = dbModule.db;
    var setting = await db.systemSetting.findUnique({ where: { key: 'meta_access_token' } });
    if (setting?.value) return setting.value;
  } catch(e) {}
  // Fall back to env var
  return META_ACCESS_TOKEN;
}

// Get page ID (from cache or fetch)
var _pageIdCache: string | null = null;
async function getPageId(): Promise<string | null> {
  if (_pageIdCache) return _pageIdCache;
  try {
    var token = await getMetaToken();
    var res = await fetch(GRAPH_BASE + '/me/accounts?fields=id,name&access_token=' + token);
    var data = await res.json();
    if (data.data?.[0]?.id) { _pageIdCache = data.data[0].id; return _pageIdCache; }
    // Token might be page token already
    var testRes = await fetch(GRAPH_BASE + '/me?fields=id&access_token=' + token);
    var testData = await testRes.json();
    if (testData.id && !testData.error) { _pageIdCache = testData.id; return _pageIdCache; }
  } catch(e) {}
  return null;
}

// Invalidate token cache (called when token is updated)
export function invalidateMetaCache() {
  _pageTokenCache = null;
  _pageTokenFetchedAt = 0;
  _pageIdCache = null;
}

// Setup: save Meta token to DB and verify it works
export async function metaSetupToken(userToken: string): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // Test the token
    var testRes = await fetch(GRAPH_BASE + '/me/permissions?access_token=' + userToken);
    var testData = await testRes.json();
    if (testData.error) return { success: false, error: 'Token invalido: ' + testData.error.message };
    var perms = (testData.data || []).map(function(p: any) { return p.permission + ':' + p.status; });
    var hasMessaging = perms.some(function(p: string) { return p.startsWith('pages_messaging:granted'); });

    // Get page info
    var pageRes = await fetch(GRAPH_BASE + '/me/accounts?fields=id,name,access_token&access_token=' + userToken);
    var pageData = await pageRes.json();
    var pageInfo = pageData.data?.[0] || null;

    // Save to DB
    var dbModule = await import('./db');
    var db = dbModule.db;
    await db.systemSetting.upsert({
      where: { key: 'meta_access_token' },
      update: { value: userToken },
      create: { key: 'meta_access_token', value: userToken },
    });

    // Invalidate cache so next call uses new token
    invalidateMetaCache();

    return {
      success: true,
      data: {
        permissions: perms,
        hasMessaging,
        page: pageInfo ? { id: pageInfo.id, name: pageInfo.name } : null,
        saved: true,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Human pacing: random delay between 10-15 minutes (600000-900000ms)
var MIN_DELAY_MS = 600000; // 10 min
var MAX_DELAY_MS = 900000; // 15 min

function randomHumanDelay(): number {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

function sleep(ms: number): Promise<void> {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

// === SEND SINGLE DM ===

export async function metaSendDM(options: {
  platform: 'instagram' | 'facebook';
  recipientId: string;
  message: string;
  skipPacing?: boolean;
}): Promise<{ success: boolean; error?: string; data?: any }> {
  var metaToken = META_ACCESS_TOKEN;
  if (!metaToken) metaToken = await getMetaToken();
  if (!metaToken) return { success: false, error: 'META_ACCESS_TOKEN nao configurado (env var nem DB)' };

  try {
    var url: string;
    var body: any;

    if (options.platform === 'instagram') {
      // Instagram Conversations API
      url = GRAPH_BASE + '/' + options.recipientId + '/messages';
      body = {
        recipient: { id: options.recipientId },
        message: { text: options.message },
        access_token: metaToken,
      };
    } else {
      // Facebook Messenger API — uses page access token
      var pageToken = await getPageAccessToken();
      if (!pageToken) return { success: false, error: 'Nao consegui obter page access token. Verifica as permissoes do META_ACCESS_TOKEN.' };
      url = GRAPH_BASE + '/me/messages';
      body = {
        recipient: { id: options.recipientId },
        message: { text: options.message },
        access_token: pageToken,
      };
    }

    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    var data = await res.json();

    if (!res.ok || data.error) {
      var errMsg = data.error?.message || ('HTTP ' + res.status);
      // Log failure
      try {
        await db.automationLog.create({
          data: {
            type: 'meta_dm',
            action: 'meta_dm_failed',
            platform: options.platform,
            result: JSON.stringify({ recipientId: options.recipientId, error: errMsg, message: options.message.slice(0, 100) }),
          },
        });
      } catch (e) { /* ignore */ }
      return { success: false, error: errMsg };
    }

    // Log success
    try {
      await db.automationLog.create({
        data: {
          type: 'meta_dm',
          action: 'meta_dm_sent',
          platform: options.platform,
          result: JSON.stringify({ recipientId: options.recipientId, messageId: data.message_id || '', provider: 'meta_graph' }),
        },
      });
    } catch (e) { /* ignore */ }

    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === BULK DMs WITH HUMAN PACING ===

export async function metaBulkDM(options: {
  platform: 'instagram' | 'facebook';
  recipients: Array<{ recipientId: string; message?: string }>;
  defaultMessage?: string;
  delayMs?: number; // override default 10-15 min
  skipPacing?: boolean; // for testing only
}): Promise<{ success: boolean; sent: number; failed: number; details: any[]; totalDelayMs?: number }> {
  var sent = 0;
  var failed = 0;
  var details: any[] = [];
  var totalDelay = 0;

  for (var i = 0; i < options.recipients.length; i++) {
    var r = options.recipients[i];
    var msg = r.message || options.defaultMessage || '';
    if (!msg) { details.push({ recipientId: r.recipientId, success: false, error: 'Mensagem vazia' }); failed++; continue; }

    var result = await metaSendDM({
      platform: options.platform,
      recipientId: r.recipientId,
      message: msg,
      skipPacing: options.skipPacing,
    });

    details.push({ recipientId: r.recipientId, ...result });
    if (result.success) sent++; else failed++;

    // Human pacing delay between messages (10-15 min)
    if (!options.skipPacing && i < options.recipients.length - 1) {
      var delay = options.delayMs || randomHumanDelay();
      console.log('[Meta DM] Human pacing: esperando ' + Math.round(delay / 60000) + ' min antes do proximo DM...');
      await sleep(delay);
      totalDelay += delay;
    }
  }

  return { success: sent > 0, sent: sent, failed: failed, details: details, totalDelayMs: totalDelay || undefined };
}

// === GET CONVERSATIONS ===

export async function metaGetConversations(platform: 'instagram' | 'facebook', limit?: number) {
  var metaToken = await getMetaToken();
  if (!metaToken) return { success: false, error: 'META_ACCESS_TOKEN nao configurado (env var nem DB)' };

  try {
    var token = metaToken;
    if (platform === 'facebook') {
      var pt = await getPageAccessToken();
      if (!pt) return { success: false, error: 'Nao consegui obter page token para Facebook' };
      token = pt;
    }
    var fields = 'id,participants,snippet,updated_time,unread_count';
    var url = GRAPH_BASE + '/me/conversations?fields=' + fields + '&limit=' + (limit || 25) + '&access_token=' + token;
    var res = await fetch(url);
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === GET PAGE INFO ===

export async function metaGetPageInfo() {
  var metaToken = await getMetaToken();
  if (!metaToken) return { success: false, error: 'META_ACCESS_TOKEN nao configurado (env var nem DB)' };

  try {
    var token = metaToken;
    var pt = await getPageAccessToken();
    if (pt) token = pt;
    var fields = 'id,name,category,fan_count,picture{url}';
    var url = GRAPH_BASE + '/me?fields=' + fields + '&access_token=' + token;
    var res = await fetch(url);
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === STATUS ===

export async function metaGraphStatus() {
  var hasToken = !!META_ACCESS_TOKEN;
  try { var _dbt = await getMetaToken(); if (_dbt) hasToken = true; } catch(e) {}
  var pageInfo = null;
  if (hasToken) {
 pageInfo = await metaGetPageInfo();
  }
  return {
    configured: hasToken,
    page: pageInfo?.success ? pageInfo.data : null,
    humanPacing: { minMinutes: Math.round(MIN_DELAY_MS / 60000), maxMinutes: Math.round(MAX_DELAY_MS / 60000) },
    supportedPlatforms: ['instagram', 'facebook'],
    capabilities: ['send_dm', 'bulk_dm', 'get_conversations', 'get_page_info'],
  };
}
