// ============================================================
//  ZERNIO API — DM + Inbox for Instagram & Facebook
//  Docs: https://docs.zernio.com
//  Base URL: https://zernio.com/api/v1
// ============================================================

import { ZERNIO_KEY } from './config';

var ZERNIO_BASE = 'https://api.zernio.com/v1';

function zernioHeaders(): Record<string, string> {
  return {
    'Authorization': 'Bearer ' + ZERNIO_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// List connected accounts (Instagram, Facebook, etc.)
export async function zernioListAccounts() {
  try {
    var res = await fetch(ZERNIO_BASE + '/accounts', {
      headers: zernioHeaders(),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// List inbox conversations (DMs from Instagram + Facebook)
export async function zernioListConversations(options?: { platform?: string; limit?: number; cursor?: string }) {
  try {
    var url = ZERNIO_BASE + '/inbox/conversations';
    var params: string[] = [];
    if (options?.platform) params.push('platform=' + encodeURIComponent(options.platform));
    if (options?.limit) params.push('limit=' + String(options.limit));
    if (options?.cursor) params.push('cursor=' + encodeURIComponent(options.cursor));
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, {
      headers: zernioHeaders(),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get messages in a conversation
export async function zernioGetConversationMessages(conversationId: string, options?: { limit?: number; before?: string }) {
  try {
    var url = ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/messages';
    var params: string[] = [];
    if (options?.limit) params.push('limit=' + String(options.limit));
    if (options?.before) params.push('before=' + encodeURIComponent(options.before));
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, {
      headers: zernioHeaders(),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Send a DM (reply in a conversation)
export async function zernioSendDM(conversationId: string, accountId: string, message: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/messages', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify({
        accountId: accountId,
        message: message,
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

// Send typing indicator
export async function zernioSendTyping(conversationId: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/typing', {
      method: 'POST',
      headers: zernioHeaders(),
    });
    return { success: res.ok };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Mark conversation as read
export async function zernioMarkRead(conversationId: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/inbox/conversations/' + conversationId + '/read', {
      method: 'POST',
      headers: zernioHeaders(),
    });
    return { success: res.ok };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Create comment-to-DM automation (auto-DM when someone comments)
export async function zernioCreateCommentAutomation(options: {
  accountId: string;
  trigger?: string; // 'comment' or 'story_reply'
  keywords?: string[];
  message: string;
  mediaUrl?: string;
}) {
  try {
    var res = await fetch(ZERNIO_BASE + '/comment-automations', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify({
        accountId: options.accountId,
        trigger: options.trigger || 'comment',
        keywords: options.keywords || ['*'],
        message: options.message,
        mediaUrl: options.mediaUrl,
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

// List comment-to-DM automations
export async function zernioListCommentAutomations() {
  try {
    var res = await fetch(ZERNIO_BASE + '/comment-automations', {
      headers: zernioHeaders(),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Create a broadcast (bulk DM)
export async function zernioCreateBroadcast(options: {
  accountId: string;
  message: string;
  contactIds?: string[];
  phones?: string[];
  mediaUrl?: string;
}) {
  try {
    var res = await fetch(ZERNIO_BASE + '/broadcasts', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(options),
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

// ============================================================
//  OUTBOUND DM — Initiate new conversations (not replies)
//  Uses Zernio's direct message endpoint to start new threads
// ============================================================

// Send a DM to a NEW user (outbound — starts a new conversation)
// recipientId can be Instagram user ID or Facebook user ID
export async function zernioSendOutboundDM(options: {
  accountId: string;
  recipientId: string;
  message: string;
  platform?: string;
}) {
  // Method 1: Try /inbox/messages (direct send to user)
  try {
    var body1: any = {
      accountId: options.accountId,
      recipientId: options.recipientId,
      message: options.message,
    };
    if (options.platform) body1.platform = options.platform;

    var res1 = await fetch(ZERNIO_BASE + '/inbox/messages', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(body1),
    });
    if (res1.ok) {
      var data1 = await res1.json();
      return { success: true, data: data1, method: 'direct_message' };
    }
    // If 404, try method 2
    if (res1.status !== 404) {
      var errText1 = await res1.text().catch(function() { return ''; });
      // Don't fail yet, try next method
    }
  } catch (e: any) {
    // continue to next method
  }

  // Method 2: Try /accounts/{id}/conversations (create conversation + send)
  try {
    var body2: any = {
      message: options.message,
    };
    var res2 = await fetch(
      ZERNIO_BASE + '/accounts/' + options.accountId + '/conversations',
      {
        method: 'POST',
        headers: zernioHeaders(),
        body: JSON.stringify(body2),
      }
    );
    if (res2.ok) {
      var data2 = await res2.json();
      return { success: true, data: data2, method: 'create_conversation' };
    }
    var errText2 = await res2.text().catch(function() { return ''; });
  } catch (e: any) {
    // continue to next method
  }

  // Method 3: Try broadcast with single contact (can sometimes init new convos)
  try {
    var bcastResult = await zernioCreateBroadcast({
      accountId: options.accountId,
      message: options.message,
      contactIds: [options.recipientId],
    });
    if (bcastResult.success) {
      return { success: true, data: bcastResult.data, method: 'broadcast' };
    }
  } catch (e: any) {
    // all methods failed
  }

  return { success: false, error: 'Todos os metodos Zernio falharam para iniciar conversa com ' + options.recipientId };
}

// Get connect URL for a platform
export async function zernioGetConnectUrl(platform: string, profileId?: string) {
  try {
    var url = ZERNIO_BASE + '/connect/' + platform + (profileId ? '?profileId=' + profileId : '');
    var res = await fetch(url, {
      headers: zernioHeaders(),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
