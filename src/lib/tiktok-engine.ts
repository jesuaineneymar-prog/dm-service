// ============================================================
//  Aura TIKTOK ENGINE v2
//  Deep Search Jul 2026: 
//    - ManyChat: parceiro OFICIAL TikTok para DMs (via Business Messaging API)
//    - ManyChat TikTok API: /tk/v2/ (nao /fb/v2/)
//    - Comment-to-DM: ManyChat suporta nativamente (trigger: "User comments on a post")
//    - TikTok Ads MCP: ads.tiktok.com/mcp (campanhas, anuncios, insights)
//    - Upload-Post: posting + analytics (ja conectado)
//    - SocialCrawl: scraping comentarios TikTok via MCP
// ============================================================

import { MANYCHAT_KEY } from './config';
import { callMCPTool } from './mcp-engine';

var MC_BASE = 'https://api.manychat.com';

function mcHeaders(): Record<string, string> {
  if (!MANYCHAT_KEY) return {};
  return {
    'Authorization': 'Bearer ' + MANYCHAT_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// === TIKTOK DM OPERATIONS VIA MANYCHAT ===
// ManyChat uses /tk/v2/ for TikTok (NOT /fb/v2/)
// Docs: https://help.manychat.com/hc/en-us/articles/17508399106844

// Send a DM to a TikTok user via ManyChat
export async function tiktokSendDM(options: {
  recipientId: string;  // TikTok user open ID
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada. Va em Settings > ManyChat.' };

  try {
    var body: any = {
      recipient_id: options.recipientId,
      message: { text: options.message },
    };

    // If button is needed, use interactive message
    if (options.buttonText && options.buttonUrl) {
      body.message = {
        type: 'interactive',
        text: options.message,
        buttons: [{
          type: 'url',
          text: options.buttonText,
          url: options.buttonUrl,
        }],
      };
    }

    // TikTok-specific endpoint
    var res = await fetch(MC_BASE + '/tk/v2/messages', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      // Fallback to /fb/v2/ if /tk/v2/ fails (some ManyChat versions)
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
  if (!MANYCHAT_KEY) return { success: false, error: 'MANYCHAT_API_KEY nao configurada' };
  try {
    // Try TikTok-specific endpoint first
    var res = await fetch(MC_BASE + '/tk/v2/conversations?limit=' + (limit || 50), {
      headers: mcHeaders(),
    });
    if (!res.ok) {
      // Fallback to /fb/v2/ with platform filter
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

// Set TikTok welcome message (auto-reply on first DM)
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
// SocialCrawl MCP: scrape TikTok comments from any public video
// This complements ManyChat's comment-to-DM triggers

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
// TikTok Ads MCP Server: ads.tiktok.com/mcp
// Manage ad campaigns, get insights, create ads

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
  var hasManyChat = !!MANYCHAT_KEY;
  return {
    dms: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    comments: 'available_via_socialcrawl_mcp',
    posting: 'available_via_uploadpost',
    analytics: 'available_via_uploadpost',
    auto_reply: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    welcome_message: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    comment_to_dm: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    ads_management: 'available_via_tiktok_ads_mcp',
    scraping: 'available_via_socialcrawl_mcp',
    manychat_endpoint: '/tk/v2/ (TikTok-specific, with /fb/v2/ fallback)',
  };
}
