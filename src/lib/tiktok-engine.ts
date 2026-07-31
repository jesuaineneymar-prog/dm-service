// ============================================================
//  JARVIS TIKTOK ENGINE — DMs via ManyChat + Business Messaging API
//  Pesquisa Jul 2026: ManyChat é parceiro oficial do TikTok
//  Business Messaging API permite receber/enviar DMs
//  Comment triggers: 'User sends a message', welcome messages
//  Limitações: Comment-to-DM ainda em rollout
// ============================================================

import { MANYCHAT_KEY } from './config';

var MC_BASE = 'https://api.manychat.com';

function mcHeaders(): Record<string, string> {
  return {
    'Authorization': 'Bearer ' + MANYCHAT_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// === TIKTOK DM OPERATIONS VIA MANYCHAT ===

// Send a DM to a TikTok user via ManyChat
export async function tiktokSendDM(options: {
  recipientId: string;  // TikTok user open ID
  message: string;
  buttonText?: string;
  buttonUrl?: string;
}) {
  try {
    var body: any = {
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

    var res = await fetch(MC_BASE + '/fb/v2/messages', {
      method: 'POST',
      headers: mcHeaders(),
      body: JSON.stringify({
        ...body,
        recipient_id: options.recipientId,
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

// Get TikTok conversations via ManyChat
export async function tiktokGetConversations(limit?: number) {
  try {
    var url = MC_BASE + '/fb/v2/conversations?platform=tiktok&limit=' + (limit || 50);
    var res = await fetch(url, { headers: mcHeaders() });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Set TikTok welcome message (auto-reply on first DM)
export async function tiktokSetWelcomeMessage(message: string) {
  try {
    var res = await fetch(MC_BASE + '/fb/v2/automations/tiktok/welcome', {
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
  try {
    var res = await fetch(MC_BASE + '/fb/v2/tiktok/profile', {
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
  try {
    var res = await fetch(MC_BASE + '/fb/v2/flows/trigger', {
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

// === TIKTOK COMMENT MONITORING (via HikerAPI + Upload-Post) ===
// TikTok comments via official API are limited.
// We use the webhook notification approach — when a comment is detected,
// JARVIS sends the user a DM via ManyChat.

// === TIKTOK INTEGRATION STATUS ===
export function getTikTokStatus() {
  var hasManyChat = !!MANYCHAT_KEY;
  return {
    dms: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    comments: 'limited_api',
    posting: 'available_via_uploadpost',
    analytics: 'available_via_uploadpost',
    auto_reply: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    welcome_message: hasManyChat ? 'available_via_manychat' : 'needs_manychat_key',
    comment_to_dm: 'rolling_out_check_manychat',
  };
}
