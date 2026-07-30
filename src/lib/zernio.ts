// ============================================================
//  ZERNIO API — DM + Inbox for Instagram & Facebook
//  Docs: https://docs.zernio.com
//  Base URL: https://zernio.com/api/v1
// ============================================================

var ZERNIO_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.ZERNIO_KEY || '') : '';
var ZERNIO_BASE = 'https://zernio.com/api/v1';

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
        text: message,
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
