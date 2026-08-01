// ============================================================
//  Aura TIKTOK ENGINE v3.1
//  PRIMARY: Zernio TT (segunda conta, só TikTok, key: ZERNIO_TT_KEY)
//  SECONDARY: Zernio (primeira conta, IG+FB, key: ZERNIO_KEY)
//  FALLBACK: ManyChat (opcional, só se MANYCHAT_API_KEY configurada)
//  POSTING: Upload-Post | TRENDS: Sociavault | COMMENTS: SocialCrawl MCP
// ============================================================

import { ZERNIO_KEY, ZERNIO_TT_KEY, MANYCHAT_KEY } from './config';
import { callMCPTool } from './mcp-engine';

var ZERNIO_BASE = 'https://api.zernio.com/v1';

// === ZERNIO TT HELPERS (usam ZERNIO_TT_KEY — conta dedicada TikTok) ===

function ttHeaders(): Record<string, string> {
  return {
    'Authorization': 'Bearer ' + (ZERNIO_TT_KEY || ZERNIO_KEY),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

function zernioTTListAccounts() {
  return fetch(ZERNIO_BASE + '/accounts', { headers: ttHeaders() })
    .then(function(r) { return r.ok ? r.json().then(function(d: any) { return { success: true, data: d }; }) : r.text().then(function(t: string) { return { success: false, error: 'HTTP ' + r.status + ': ' + t.slice(0, 200) }; }); })
    .catch(function(e: any) { return { success: false, error: e.message }; });
}

function zernioTTListConversations(options?: { platform?: string; limit?: number }) {
  var url = ZERNIO_BASE + '/inbox/conversations';
  // Zernio TT so tem TikTok, nao enviar platform filter (causa 400)
  if (options?.limit) url += '?limit=' + options.limit;
  return fetch(url, { headers: ttHeaders() })
    .then(function(r) { return r.ok ? r.json().then(function(d: any) { return { success: true, data: d }; }) : r.text().then(function(t: string) { return { success: false, error: 'HTTP ' + r.status }; }); })
    .catch(function(e: any) { return { success: false, error: e.message }; });
}

export async function zernioTTGetMessages(conversationId: string, limit?: number) {
  var url = ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/messages';
  if (limit) url += '?limit=' + limit;
  return fetch(url, { headers: ttHeaders() })
    .then(function(r) { return r.ok ? r.json().then(function(d: any) { return { success: true, data: d }; }) : r.text().then(function(t: string) { return { success: false, error: 'HTTP ' + r.status }; }); })
    .catch(function(e: any) { return { success: false, error: e.message }; });
}

function zernioTTSendDM(conversationId: string, accountId: string, message: string) {
  return fetch(ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/messages', {
    method: 'POST',
    headers: ttHeaders(),
    body: JSON.stringify({ accountId: accountId, message: message }),
  }).then(function(r) { return r.ok ? r.json().then(function(d: any) { return { success: true, data: d }; }) : r.text().then(function(t: string) { return { success: false, error: 'HTTP ' + r.status + ': ' + t.slice(0, 200) }; }); })
    .catch(function(e: any) { return { success: false, error: e.message }; });
}

// === TIKTOK DMs VIA ZERNIO TT (PRIMARY — GRATIS) ===
// Usa a segunda conta Zernio (ZERNIO_TT_KEY) que tem o TikTok conectado.

export async function tiktokDMsViaZernio() {
  var ttKey = ZERNIO_TT_KEY || ZERNIO_KEY;
  if (!ttKey) return { success: false, error: 'Nenhuma ZERNIO_KEY configurada', source: 'none' };

  var usingDedicated = !!ZERNIO_TT_KEY;

  try {
    var accountsRes = await zernioTTListAccounts();
    if (!accountsRes.success) return { success: false, error: 'Zernio TT accounts: ' + (accountsRes.error || ''), source: 'zernio_tt' };

    var accountsData = accountsRes.data;
    var accounts: any[] = [];
    if (Array.isArray(accountsData)) accounts = accountsData;
    else if (accountsData?.accounts) accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];

    var ttAccount = accounts.find(function(a: any) { return a.platform === 'tiktok'; });
    if (!ttAccount) {
      return {
        success: false,
        error: usingDedicated
          ? 'Conta TikTok nao encontrada nesta Zernio.'
          : 'Nenhuma conta TikTok no Zernio.',
        source: 'zernio_tt',
        hasZernioKey: true,
        tiktokConnected: false,
        accountsFound: accounts.map(function(a: any) { return a.platform || 'unknown'; }),
      };
    }

    // Verificar se a conta tem capabilities de inbox (DMs)
    var inboxCapable = ttAccount.xCapabilities?.inbox !== false;
    if (!inboxCapable) {
      return {
        success: false,
        error: 'Zernio TikTok nao tem permissao de inbox (DMs). A Zernio ainda nao suporta DMs do TikTok.',
        source: 'zernio_tt',
        hasZernioKey: true,
        tiktokConnected: true,
        inboxCapable: false,
        username: ttAccount.username || ttAccount.displayName || 'unknown',
      };
    }

    // Buscar conversas (sem platform filter — conta TT so tem TikTok)
    var convRes = await zernioTTListConversations({ limit: 30 });
    if (!convRes.success) return { success: false, error: 'Conversas TikTok: ' + (convRes.error || ''), source: 'zernio_tt' };

    var convData = convRes.data;
    var conversations: any[] = [];
    if (convData?.data && Array.isArray(convData.data)) conversations = convData.data;
    else if (Array.isArray(convData)) conversations = convData;
    else if (convData?.conversations) conversations = Array.isArray(convData.conversations) ? convData.conversations : [];

    return {
      success: true,
      source: usingDedicated ? 'zernio_tt_dedicated' : 'zernio',
      accountId: ttAccount.id,
      conversations: conversations,
      totalConversations: conversations.length,
      unreadCount: conversations.reduce(function(sum: number, c: any) { return sum + (c.unreadCount || 0); }, 0),
      usingDedicated: usingDedicated,
    };
  } catch (e: any) {
    return { success: false, error: e.message, source: 'zernio_tt' };
  }
}

// Send TikTok DM via Zernio TT
export async function tiktokSendDMViaZernio(conversationId: string, accountId: string, message: string) {
  return await zernioTTSendDM(conversationId, accountId, message);
}

// === TIKTOK DMs VIA MANYCHAT (FALLBACK — OPCIONAL) ===
// Só é usado se Zernio não tiver TikTok conectado E MANYCHAT_API_KEY existir

var MC_BASE = 'https://api.manychat.com';

function mcHeaders(): Record<string, string> {
  if (!MANYCHAT_KEY) return {};
  return {
    'Authorization': 'Bearer ' + MANYCHAT_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// Send a DM to a TikTok user via ManyChat
export async function tiktokSendDM(options: {
  recipientId: string;
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada. Use Zernio (grátis) em vez disso.' };

  try {
    var body: any = {
      recipient_id: options.recipientId,
      message: { text: options.message },
    };

    if (options.buttonText && options.buttonUrl) {
      body.message = {
        type: 'interactive',
        text: options.message,
        buttons: [{ type: 'url', text: options.buttonText, url: options.buttonUrl }],
      };
    }

    var res = await fetch(MC_BASE + '/tk/v2/messages', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      if (res.status === 404) {
        var fallbackRes = await fetch(MC_BASE + '/fb/v2/messages', {
          method: 'POST',
          headers: mcHeaders(),
          body: JSON.stringify({ ...body, platform: 'tiktok' }),
        });
        if (!fallbackRes.ok) {
          var fbErr = await fallbackRes.text().catch(function() { return ''; });
          return { success: false, error: 'HTTP ' + fallbackRes.status + ': ' + fbErr.slice(0, 200) };
        }
        var fbData = await fallbackRes.json();
        return { success: true, data: fbData, via: 'fb_fallback' };
      }
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 200) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get TikTok conversations via ManyChat
export async function tiktokGetConversations(limit?: number) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada. Use Zernio (grátis) em vez disso.' };
  try {
    var res = await fetch(MC_BASE + '/tk/v2/conversations?limit=' + (limit || 50), {
      headers: mcHeaders(),
    });
    if (!res.ok) {
      res = await fetch(MC_BASE + '/fb/v2/conversations?platform=tiktok&limit=' + (limit || 50), {
        headers: mcHeaders(),
      });
    }
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Set TikTok welcome message via ManyChat
export async function tiktokSetWelcomeMessage(message: string) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  try {
    var res = await fetch(MC_BASE + '/tk/v2/automations/welcome', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({ message: { text: message } }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 200) };
    }
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get TikTok profile info via ManyChat
export async function tiktokGetProfileInfo() {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  try {
    var res = await fetch(MC_BASE + '/tk/v2/profile', {
      headers: mcHeaders(),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Trigger a ManyChat flow for a TikTok user
export async function tiktokTriggerFlow(options: {
  recipientId: string;
  flowId: string;
}) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  try {
    var res = await fetch(MC_BASE + '/tk/v2/flows/trigger', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        recipient_id: options.recipientId,
        flow_id: options.flowId,
      }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 200) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === TIKTOK COMMENT MONITORING (via MCP: SocialCrawl) ===

export async function tiktokGetComments(videoUrl: string, maxComments?: number) {
  try {
    var result = await callMCPTool('socialcrawl', 'scrape_comments', {
      platform: 'tiktok',
      url: videoUrl,
      limit: maxComments || 50,
    });
    return result;
  } catch (e: any) {
    return { success: false, error: 'SocialCrawl MCP nao disponivel: ' + e.message };
  }
}

// === TIKTOK ADS VIA MCP ===

export async function tiktokAdsGetCampaigns(advertiserId?: string) {
  try {
    var result = await callMCPTool('tiktok_ads', 'get_campaigns', {
      advertiser_id: advertiserId,
    });
    return result;
  } catch (e: any) {
    return { success: false, error: 'TikTok Ads MCP nao disponivel: ' + e.message };
  }
}

export async function tiktokAdsGetInsights(advertiserId: string, startDate?: string, endDate?: string) {
  try {
    var result = await callMCPTool('tiktok_ads', 'get_insights', {
      advertiser_id: advertiserId,
      start_date: startDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      end_date: endDate || new Date().toISOString().slice(0, 10),
    });
    return result;
  } catch (e: any) {
    return { success: false, error: 'TikTok Ads MCP nao disponivel: ' + e.message };
  }
}

// === TIKTOK INTEGRATION STATUS ===
export function getTikTokStatus() {
  var hasZernio = !!ZERNIO_KEY;
  var hasZernioTT = !!ZERNIO_TT_KEY;
  var hasManyChat = !!MANYCHAT_KEY;
  var hasTTKey = hasZernioTT || hasZernio;

  return {
    // DMs: Tentamos via Zernio TT primeiro (segunda conta dedicada)
    // Se Zernio TT suportar inbox do TikTok, DMs sao gratis
    dms: hasTTKey ? 'testing_via_zernio_tt' : (hasManyChat ? 'available_via_manychat' : 'needs_config'),
    dms_provider: hasTTKey
      ? 'Zernio TT (grátis — conta dedicada TikTok)'
      : (hasManyChat ? 'ManyChat (free: 1000/mes)' : 'Nenhum configurado'),
    dms_note: hasTTKey
      ? 'A testar Zernio TT para DMs. Se nao suportar, ManyChat (grátis) e alternativa.'
      : 'Configura ZERNIO_TT_KEY ou MANYCHAT_API_KEY para TikTok DMs.',
    comments: 'available_via_socialcrawl_mcp',
    posting: 'available_via_uploadpost',
    posting_via_zernio: hasZernioTT ? 'connected' : (hasZernio ? 'may_support' : 'not_connected'),
    analytics: 'available_via_uploadpost',
    auto_reply: hasTTKey ? 'testing_via_zernio_tt' : (hasManyChat ? 'available_via_manychat' : 'needs_config'),
    welcome_message: hasManyChat ? 'available_via_manychat' : 'not_configured',
    comment_to_dm: 'available_via_zernio_ig_fb',
    ads_management: 'available_via_tiktok_ads_mcp',
    scraping: 'available_via_socialcrawl_mcp',
    content_generation: 'available_via_ai',
    trending: 'available_via_sociavault',
    hashtag_research: 'available_via_ai',
    competitor_monitoring: 'available_via_hikerapi',
    zernio_tt_status: hasZernioTT ? 'connected_testing' : 'not_connected',
    zernio_igfb_status: hasZernio ? 'connected' : 'not_connected',
    engine_version: 'v3.2_dual_zernio',
    setup_note: hasZernioTT
      ? 'Zernio TT conectada com TikTok. A testar capacidades de DM. Posting via Upload-Post.'
      : 'Para TikTok completo: adiciona ZERNIO_TT_KEY (Zernio com TikTok) ou MANYCHAT_API_KEY.',
  };
}
