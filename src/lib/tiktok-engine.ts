// ============================================================
//  Aura SOCIAL ENGINE v4 — Instagram + Facebook
//  PRIMARY: Zernio (IG+FB DMs, posting, analytics)
//  SECONDARY: ManyChat (IG+FB auto-reply)
//  COMMENTS: Zernio comment automations | META ADS: MCP
//  TikTok aliases mantidos para compatibilidade
// ============================================================

import { ZERNIO_KEY, ZERNIO_TT_KEY, MANYCHAT_KEY } from './config';
import { callMCPTool } from './mcp-engine';

var ZERNIO_BASE = 'https://api.zernio.com/v1';

// === ZERNIO IG+FB HELPERS (usamos ZERNIO_KEY — conta com IG+FB conectado) ===

function igfbHeaders(): Record<string, string> {
  return {
    'Authorization': 'Bearer ' + ZERNIO_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function zernioIGFBListAccounts(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    var r = await fetch(ZERNIO_BASE + '/accounts', { headers: igfbHeaders() });
    if (r.ok) { var d = await r.json(); return { success: true, data: d }; }
    var t = await r.text(); return { success: false, error: 'HTTP ' + r.status + ': ' + t.slice(0, 200) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function zernioIGFBListConversations(options?: { platform?: string; limit?: number }): Promise<{ success: boolean; data?: any; error?: string }> {
  var url = ZERNIO_BASE + '/inbox/conversations';
  if (options?.platform) url += '?platform=' + options.platform;
  else url += '?platform=instagram';
  if (options?.limit) url += (url.includes('?') ? '&' : '?') + 'limit=' + options.limit;
  try {
    var r = await fetch(url, { headers: igfbHeaders() });
    if (r.ok) { var d = await r.json(); return { success: true, data: d }; }
    return { success: false, error: 'HTTP ' + r.status };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function igfbGetMessages(conversationId: string, limit?: number): Promise<any> {
  var url = ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/messages';
  if (limit) url += '?limit=' + limit;
  try {
    var r = await fetch(url, { headers: igfbHeaders() });
    if (r.ok) { var d = await r.json(); return { success: true, data: d }; }
    return { success: false, error: 'HTTP ' + r.status };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function zernioIGFBSendDM(conversationId: string, accountId: string, message: string): Promise<any> {
  try {
    var r = await fetch(ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/messages', {
      method: 'POST',
      headers: igfbHeaders(),
      body: JSON.stringify({ accountId: accountId, message: message }),
    });
    if (r.ok) { var d = await r.json(); return { success: true, data: d }; }
    var t = await r.text(); return { success: false, error: 'HTTP ' + r.status + ': ' + t.slice(0, 200) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === IG+FB DMs VIA ZERNIO (PRIMARY) ===

export async function igfbDMsViaZernio(platform?: string): Promise<any> {
  if (!ZERNIO_KEY) return { success: false, error: 'ZERNIO_KEY nao configurada', source: 'none' };

  try {
    var accountsRes = await zernioIGFBListAccounts();
    if (!accountsRes.success) return { success: false, error: 'Zernio accounts: ' + (accountsRes.error || ''), source: 'zernio' };

    var accountsData = accountsRes.data;
    var accounts: any[] = [];
    if (Array.isArray(accountsData)) accounts = accountsData;
    else if (accountsData?.accounts) accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];

    var targetPlatform = platform || 'instagram';
    var account = accounts.find(function(a: any) { return a.platform === targetPlatform; });
    if (!account) {
      return {
        success: false,
        error: 'Conta ' + targetPlatform + ' nao encontrada no Zernio.',
        source: 'zernio',
        hasZernioKey: true,
        platformsFound: accounts.map(function(a: any) { return a.platform || 'unknown'; }),
      };
    }

    var convRes = await zernioIGFBListConversations({ platform: targetPlatform, limit: 30 });
    if (!convRes.success) return { success: false, error: 'Conversas ' + targetPlatform + ': ' + (convRes.error || ''), source: 'zernio' };

    var convData = convRes.data;
    var conversations: any[] = [];
    if (convData?.data && Array.isArray(convData.data)) conversations = convData.data;
    else if (Array.isArray(convData)) conversations = convData;
    else if (convData?.conversations) conversations = Array.isArray(convData.conversations) ? convData.conversations : [];

    return {
      success: true,
      source: 'zernio',
      accountId: account.id,
      platform: targetPlatform,
      conversations: conversations,
      totalConversations: conversations.length,
      unreadCount: conversations.reduce(function(sum: number, c: any) { return sum + (c.unreadCount || 0); }, 0),
    };
  } catch (e: any) {
    return { success: false, error: e.message, source: 'zernio' };
  }
}

export async function igfbSendDMViaZernio(conversationId: string, accountId: string, message: string) {
  return await zernioIGFBSendDM(conversationId, accountId, message);
}

// === IG+FB VIA MANYCHAT (FALLBACK) ===

var MC_BASE = 'https://api.manychat.com';

function mcHeaders(): Record<string, string> {
  if (!MANYCHAT_KEY) return {};
  return { 'Authorization': 'Bearer ' + MANYCHAT_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' };
}

export async function igfbSendViaManyChat(options: {
  platform: string;
  recipientId: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };

  try {
    var basePath = options.platform === 'fb' ? '/fb/v2/' : '/ig/v2/';
    var body: any = { recipient_id: options.recipientId, message: { text: options.message } };
    if (options.buttonText && options.buttonUrl) {
      body.message = { type: 'interactive', text: options.message, buttons: [{ type: 'url', text: options.buttonText, url: options.buttonUrl }] };
    }
    var res = await fetch(MC_BASE + basePath + 'messages', { method: 'POST', headers: mcHeaders(), body: JSON.stringify(body) });
    if (!res.ok) { var t = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + t.slice(0, 200) }; }
    var data = await res.json();
    return { success: true, data: data, via: 'manychat_' + options.platform };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function igfbGetConversations(platform?: string, limit?: number) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  var basePath = (platform === 'fb' ? '/fb/v2/' : '/ig/v2/');
  try {
    var res = await fetch(MC_BASE + basePath + 'conversations?limit=' + (limit || 50), { headers: mcHeaders() });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function igfbSetWelcomeMessage(platform: string, message: string) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  var basePath = (platform === 'fb' ? '/fb/v2/' : '/ig/v2/');
  try {
    var res = await fetch(MC_BASE + basePath + 'automations/welcome', { method: 'POST', headers: mcHeaders(), body: JSON.stringify({ message: { text: message } }) });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function igfbGetProfileInfo(platform: string) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  var basePath = (platform === 'fb' ? '/fb/v2/' : '/ig/v2/');
  try {
    var res = await fetch(MC_BASE + basePath + 'profile', { headers: mcHeaders() });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function igfbTriggerFlow(options: { platform: string; recipientId: string; flowId: string }) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  var basePath = (options.platform === 'fb' ? '/fb/v2/' : '/ig/v2/');
  try {
    var res = await fetch(MC_BASE + basePath + 'flows/trigger', {
      method: 'POST', headers: mcHeaders(),
      body: JSON.stringify({ recipient_id: options.recipientId, flow_id: options.flowId }),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === IG+FB COMMENT SCRAPING (via SocialCrawl MCP) ===

export async function igfbGetComments(postUrl: string, maxComments?: number) {
  try {
    var result = await callMCPTool('socialcrawl', 'scrape_comments', {
      platform: 'instagram',
      url: postUrl,
      limit: maxComments || 50,
    });
    return result;
  } catch (e: any) { return { success: false, error: 'SocialCrawl MCP nao disponivel: ' + e.message }; }
}

// === META ADS VIA MCP ===

export async function metaAdsGetCampaigns(adAccountId?: string) {
  try {
    var result = await callMCPTool('meta_ads', 'get_campaigns', { ad_account_id: adAccountId });
    return result;
  } catch (e: any) { return { success: false, error: 'Meta Ads MCP nao disponivel: ' + e.message }; }
}

export async function metaAdsGetInsights(adAccountId: string, startDate?: string, endDate?: string) {
  try {
    var result = await callMCPTool('meta_ads', 'get_insights', {
      ad_account_id: adAccountId,
      start_date: startDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      end_date: endDate || new Date().toISOString().slice(0, 10),
    });
    return result;
  } catch (e: any) { return { success: false, error: 'Meta Ads MCP nao disponivel: ' + e.message }; }
}

// === IG+FB STATUS ===

export function getIGFBStatus() {
  var hasZernio = !!ZERNIO_KEY;
  var hasManyChat = !!MANYCHAT_KEY;

  return {
    dms: hasZernio ? 'available_via_zernio' : (hasManyChat ? 'available_via_manychat' : 'not_configured'),
    dms_provider: hasZernio ? 'Zernio (IG+FB DMs activos)' : (hasManyChat ? 'ManyChat (IG+FB)' : 'Nenhum — configura ZERNIO_KEY ou MANYCHAT_API_KEY'),
    comments: 'available_via_zernio_comment_automations',
    posting: 'available_via_zernio_and_uploadpost',
    analytics: 'available_via_zernio',
    auto_reply: hasManyChat ? 'available_via_manychat' : 'configure_manychat',
    welcome_message: hasManyChat ? 'available_via_manychat' : 'not_configured',
    ads_management: 'available_via_meta_ads_mcp',
    scraping: 'available_via_sociavault',
    content_generation: 'available_via_ai',
    trending: 'available_via_sociavault',
    hashtag_research: 'available_via_ai',
    competitor_monitoring: 'available_via_sociavault',
    outbound_dm: 'available_via_zernio_outbound_and_steel_dev',
    proactive_dm: 'available_via_meta_graph_api_and_steel_dev',
    zernio_status: hasZernio ? 'connected' : 'not_connected',
    manychat_status: hasManyChat ? 'connected' : 'not_connected',
    engine_version: 'v4_ig_fb_specialized',
    specialisation: 'Instagram + Facebook (Mwango Brain)',
    supported_platforms: ['instagram', 'facebook'],
  };
}

// === TIKTOK ALIASES (compatibilidade — mantem imports existentes) ===

export var tiktokDMsViaZernio = igfbDMsViaZernio;
export var tiktokSendDMViaZernio = igfbSendDMViaZernio;
export var tiktokSendDM = igfbSendViaManyChat;
export var tiktokGetConversations = igfbGetConversations;
export var tiktokSetWelcomeMessage = igfbSetWelcomeMessage;
export var tiktokGetProfileInfo = igfbGetProfileInfo;
export var tiktokTriggerFlow = igfbTriggerFlow;
export var tiktokGetComments = igfbGetComments;
export var tiktokAdsGetCampaigns = metaAdsGetCampaigns;
export var tiktokAdsGetInsights = metaAdsGetInsights;
export var getTikTokStatus = getIGFBStatus;
