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
// recipientId should be Instagram IGSID or Facebook user ID
// For Instagram, also accepts username (tries to resolve)
export async function zernioSendOutboundDM(options: {
  accountId: string;
  recipientId: string;
  message: string;
  platform?: string;
  recipientUsername?: string;
}) {
  var errors: string[] = [];
  var rid = options.recipientId;
  var plat = options.platform || '';

  // Method 1: POST /inbox/messages (direct send to user by ID)
  try {
    var body1: any = {
      accountId: options.accountId,
      recipientId: rid,
      message: options.message,
    };
    if (plat) body1.platform = plat;
    if (options.recipientUsername) body1.recipientUsername = options.recipientUsername;

    var res1 = await fetch(ZERNIO_BASE + '/inbox/messages', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(body1),
    });
    if (res1.ok) {
      var data1 = await res1.json();
      return { success: true, data: data1, method: 'direct_message' };
    }
    // 404 = endpoint doesn't exist, skip silently
    if (res1.status === 404) {
      errors.push('direct_message: HTTP 404 (endpoint nao existe)');
    } else {
      try { var t1 = await res1.text(); errors.push('direct_message: HTTP ' + res1.status + ' - ' + t1.slice(0, 200)); } catch(e) { errors.push('direct_message: HTTP ' + res1.status); }
    }
  } catch (e: any) {
    errors.push('direct_message: ' + e.message);
  }

  // Method 2: POST /inbox/conversations (CORRECT FORMAT: participantId + participantUsername)
  try {
    var body2: any = {
      accountId: options.accountId,
      participantId: rid,
      message: options.message,
    };
    if (options.recipientUsername) body2.participantUsername = options.recipientUsername;

    var res2 = await fetch(ZERNIO_BASE + '/inbox/conversations', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(body2),
    });
    if (res2.ok) {
      var data2 = await res2.json();
      return { success: true, data: data2, method: 'create_conversation' };
    }
    try { var t2 = await res2.text(); errors.push('create_conversation: HTTP ' + res2.status + ' - ' + t2.slice(0, 300)); } catch(e) { errors.push('create_conversation: HTTP ' + res2.status); }
  } catch (e: any) {
    errors.push('create_conversation: ' + e.message);
  }

  // Method 3: POST /accounts/{id}/messages
  try {
    var body3: any = {
      recipientId: rid,
      message: options.message,
    };
    var res3 = await fetch(ZERNIO_BASE + '/accounts/' + options.accountId + '/messages', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(body3),
    });
    if (res3.ok) {
      var data3 = await res3.json();
      return { success: true, data: data3, method: 'account_messages' };
    }
    if (res3.status === 404) {
      errors.push('account_messages: HTTP 404 (endpoint nao existe)');
    } else {
      try { var t3 = await res3.text(); errors.push('account_messages: HTTP ' + res3.status + ' - ' + t3.slice(0, 200)); } catch(e) { errors.push('account_messages: HTTP ' + res3.status); }
    }
  } catch (e: any) {
    errors.push('account_messages: ' + e.message);
  }

  // Method 4: Broadcast with profileId
  try {
    var bcastBody: any = {
      profileId: options.accountId,
      message: options.message,
      contactIds: [rid],
    };
    var res4 = await fetch(ZERNIO_BASE + '/broadcasts', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(bcastBody),
    });
    if (res4.ok) {
      var data4 = await res4.json();
      return { success: true, data: data4, method: 'broadcast' };
    }
    try { var t4 = await res4.text(); errors.push('broadcast: HTTP ' + res4.status + ' - ' + t4.slice(0, 300)); } catch(e) { errors.push('broadcast: HTTP ' + res4.status); }
  } catch (e: any) {
    errors.push('broadcast: ' + e.message);
  }

  return { success: false, error: 'Zernio falhou (' + errors.length + ' metodos): ' + errors.join(' | ') };
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
