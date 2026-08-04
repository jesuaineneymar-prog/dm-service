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
  profileId?: string;
  trigger?: string; // 'comment' or 'story_reply'
  keywords?: string[];
  message: string;
  mediaUrl?: string;
  name?: string;
}) {
  try {
    var res = await fetch(ZERNIO_BASE + '/comment-automations', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify({
        accountId: options.accountId,
        profileId: options.profileId,
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

// Delete a comment automation by ID
export async function zernioDeleteCommentAutomation(automationId: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/comment-automations/' + automationId, {
      method: 'DELETE',
      headers: zernioHeaders(),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 200) };
    }
    return { success: true, deleted: automationId };
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
// ============================================================
//  ZERNIO POSTS — Criar, agendar, listar, apagar posts
//  Endpoints confirmados: POST /posts, GET /posts, GET /posts/:id
//  GET /posts/schedule?postId=, DELETE /comments/:id, GET /analytics
// ============================================================

// Create a new post (draft or publish)
export async function zernioCreatePost(options: {
  accountId: string;
  caption?: string;
  mediaUrl?: string;
  platform?: string;
  scheduledAt?: string;
}) {
  try {
    var body: any = {
      accountId: options.accountId,
      caption: options.caption || '',
    };
    if (options.mediaUrl) body.mediaUrl = options.mediaUrl;
    if (options.platform) body.platform = options.platform;
    if (options.scheduledAt) body.scheduledAt = options.scheduledAt;

    var res = await fetch(ZERNIO_BASE + '/posts', {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// List posts
export async function zernioListPosts(options?: { accountId?: string; limit?: number; status?: string }) {
  try {
    var url = ZERNIO_BASE + '/posts';
    var params: string[] = [];
    if (options?.accountId) params.push('accountId=' + options.accountId);
    if (options?.limit) params.push('limit=' + String(options.limit));
    if (options?.status) params.push('status=' + options.status);
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, { headers: zernioHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get post details + schedule info
export async function zernioGetPost(postId: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/posts/' + postId, { headers: zernioHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Schedule a post
export async function zernioSchedulePost(postId: string, scheduledAt: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/posts/schedule?postId=' + postId, {
      method: 'POST',
      headers: zernioHeaders(),
      body: JSON.stringify({ scheduledAt: scheduledAt }),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Delete a comment by ID
export async function zernioDeleteComment(commentId: string, accountId: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/comments/' + commentId, {
      method: 'DELETE',
      headers: zernioHeaders(),
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    return { success: true, deleted: commentId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get analytics
export async function zernioGetAnalytics(options?: { accountId?: string; period?: string }) {
  try {
    var url = ZERNIO_BASE + '/analytics';
    var params: string[] = [];
    if (options?.accountId) params.push('accountId=' + options.accountId);
    if (options?.period) params.push('period=' + options.period);
    if (params.length > 0) url += '?' + params.join('&');

    var res = await fetch(url, { headers: zernioHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Get post analytics
export async function zernioGetPostAnalytics(postId: string) {
  try {
    var res = await fetch(ZERNIO_BASE + '/posts/' + postId + '/analytics', { headers: zernioHeaders() });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Upload media to Zernio (uses multipart/form-data with 'files' field)
export async function zernioUploadMedia(fileBuffer: Buffer, filename: string, mimeType: string) {
  try {
    var form = new FormData();
    var ab = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer;
    form.append('files', new Blob([ab], { type: mimeType }), filename);

    var res = await fetch(ZERNIO_BASE + '/media', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + ZERNIO_KEY },
      body: form,
    });
    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 500) };
    }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// List users
export async function zernioListUsers() {
  try {
    var res = await fetch(ZERNIO_BASE + '/users', { headers: zernioHeaders() });
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
