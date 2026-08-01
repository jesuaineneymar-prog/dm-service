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
        profileId: options.accountId,
        accountId: options.accountId,
        name: options.name || 'Aura Auto-DM ' + (options.trigger || 'comment'),
        trigger: options.trigger || 'comment',
        keywords: options.keywords || ['*'],
        dmMessage: options.message,
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
// recipientId: Instagram IGSID, Facebook user ID, or any platform user ID
// recipientUsername: Instagram username (Zernio resolves internally)
export async function zernioSendOutboundDM(options: {
  accountId: string;
  recipientId: string;
  message: string;
  platform?: string;
  recipientUsername?: string;
}) {
  // Primary method: POST /inbox/conversations (confirmed working endpoint)
  // Requires: participantId OR participantUsername
  try {
    var body: any = {
      accountId: options.accountId,
      message: options.message,
    };
    // Use participantUsername if available (Zernio resolves to IGSID internally)
    if (options.recipientUsername) {
      body.participantUsername = options.recipientUsername;
    } else {
      body.participantId = options.recipientId;
    }

    var res = await fetch(ZERNIO_BASE + '/inbox/conversations', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      var data = await res.json();
      return { success: true, data: data, method: 'create_conversation' };
    }
    var errText = '';
    try { errText = await res.text(); } catch(e) { errText = 'HTTP ' + res.status; }
    return { success: false, error: 'create_conversation: HTTP ' + res.status + ' - ' + errText.slice(0, 500) };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
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

// Get followers/audience for an account (returns IGSIDs)
export async function zernioGetAudience(accountId: string, options?: { type?: string; limit?: number }) {
  try {
    var url = ZERNIO_BASE + '/accounts/' + accountId + '/audience';
    var params: string[] = [];
    if (options?.type) params.push('type=' + options.type);
    if (options?.limit) params.push('limit=' + String(options.limit));
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, { headers: zernioHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get contacts (for broadcast targeting)
export async function zernioGetContacts(options?: { accountId?: string; limit?: number }) {
  try {
    var url = ZERNIO_BASE + '/contacts';
    var params: string[] = [];
    if (options?.accountId) params.push('accountId=' + options.accountId);
    if (options?.limit) params.push('limit=' + String(options.limit));
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, { headers: zernioHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
