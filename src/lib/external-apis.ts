// ============================================================
//  JARVIS EXTERNAL API INTEGRATIONS
//  HikerAPI (Instagram), Upload-Post (Publishing), ManyChat (DMs)
//  All REAL — zero simulation
// ============================================================

// --- HikerAPI (Instagram Private API — 147 endpoints) ---
// Sign up: https://hikerapi.com → Get API key
// Pricing: $0.0006/request, 100 free requests
// No proxy needed, no captcha, no bans

var HIKER_BASE = 'https://hikerapi.com/v2';

export interface HikerConfig {
  apiKey: string; // Get from hikerapi.com dashboard
}

// HikerAPI: Get user profile by username
export async function hikerGetUser(apiKey: string, username: string) {
  try {
    var res = await fetch(HIKER_BASE + '/users/by/username?username=' + encodeURIComponent(username), {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// HikerAPI: Get user's posts (feed)
export async function hikerGetUserPosts(apiKey: string, userId: string, count?: number) {
  try {
    var url = HIKER_BASE + '/users/' + userId + '/posts?count=' + (count || 10);
    var res = await fetch(url, {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// HikerAPI: Get comments on a post
export async function hikerGetComments(apiKey: string, mediaId: string, count?: number) {
  try {
    var url = HIKER_BASE + '/media/' + mediaId + '/comments?count=' + (count || 20);
    var res = await fetch(url, {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// HikerAPI: Get user ID from username
export async function hikerGetUserId(apiKey: string, username: string): Promise<string | null> {
  var result = await hikerGetUser(apiKey, username);
  if (result.success && result.data) {
    return result.data.pk || result.data.id || result.data.user_id || null;
  }
  return null;
}

// HikerAPI: Get user's followers
export async function hikerGetFollowers(apiKey: string, userId: string, count?: number) {
  try {
    var url = HIKER_BASE + '/users/' + userId + '/followers?count=' + (count || 20);
    var res = await fetch(url, {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// HikerAPI: Search users by query
export async function hikerSearchUsers(apiKey: string, query: string) {
  try {
    var url = HIKER_BASE + '/users/search?query=' + encodeURIComponent(query);
    var res = await fetch(url, {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// HikerAPI: Get user's stories
export async function hikerGetStories(apiKey: string, userId: string) {
  try {
    var url = HIKER_BASE + '/users/' + userId + '/stories';
    var res = await fetch(url, {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// HikerAPI: Get media insights (likes, views, etc.)
export async function hikerGetMediaInsights(apiKey: string, mediaId: string) {
  try {
    var url = HIKER_BASE + '/media/' + mediaId + '/insights';
    var res = await fetch(url, {
      headers: { 'X-HikerAPI-Key': apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- Upload-Post.com API (Content Publishing) ---
// Sign up: https://upload-post.com → Get API key
// Pricing: $16/mo (5 profiles), $24/mo (unlimited)
// Posts to: Instagram, TikTok, Facebook, YouTube + 19 more

var UP_BASE = 'https://api.upload-post.com/v1';

export interface UploadPostConfig {
  apiKey: string; // Get from upload-post.com dashboard
}

// Upload-Post: Post content to a platform
export async function upPost(apiKey: string, options: {
  platform: string;   // 'instagram', 'tiktok', 'facebook', 'youtube', etc.
  mediaUrl?: string;  // URL of the image/video to post
  mediaData?: string; // base64 encoded image/video
  caption?: string;   // Post caption/text
  profileId?: string; // Profile ID (if multiple)
  publishAt?: string; // ISO date for scheduled posting (optional)
}) {
  try {
    var body: any = {
      platform: options.platform,
      caption: options.caption || '',
    };
    if (options.mediaUrl) body.mediaUrl = options.mediaUrl;
    if (options.mediaData) body.mediaData = options.mediaData;
    if (options.profileId) body.profileId = options.profileId;
    if (options.publishAt) body.publishAt = options.publishAt;

    var res = await fetch(UP_BASE + '/posts', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
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

// Upload-Post: Get post status
export async function upGetPostStatus(apiKey: string, postId: string) {
  try {
    var res = await fetch(UP_BASE + '/posts/' + postId, {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Upload-Post: List available profiles
export async function upListProfiles(apiKey: string) {
  try {
    var res = await fetch(UP_BASE + '/profiles', {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Upload-Post: List supported platforms
export async function upListPlatforms(apiKey: string) {
  try {
    var res = await fetch(UP_BASE + '/platforms', {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- ManyChat API (Auto-Reply DMs) ---
// Sign up: https://manychat.com → Connect Instagram/Facebook → Get API key
// Pricing: Free (up to 1000 conversations), Pro $15/mo

var MC_BASE = 'https://api.manychat.com';

export interface ManyChatConfig {
  apiKey: string; // Get from manychat.com settings
}

// ManyChat: Send a DM to a user
export async function mcSendDM(apiKey: string, options: {
  platform: string;   // 'instagram' or 'facebook'
  userId: string;     // Recipient user ID
  message: string;    // Message text
}) {
  try {
    var res = await fetch(MC_BASE + '/fb/v2/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        platform: options.platform,
        recipient_id: options.userId,
        message: { text: options.message },
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

// ManyChat: Get conversation list
export async function mcGetConversations(apiKey: string, platform?: string) {
  try {
    var url = MC_BASE + '/fb/v2/conversations';
    if (platform) url += '?platform=' + platform;
    var res = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ManyChat: Send dynamic flow (auto-reply rule)
export async function mcTriggerFlow(apiKey: string, options: {
  platform: string;
  userId: string;
  flowId: string; // ManyChat flow ID
}) {
  try {
    var res = await fetch(MC_BASE + '/fb/v2/flows/trigger', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        platform: options.platform,
        recipient_id: options.userId,
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

// --- N8N Webhook Integration ---
// Self-hosted N8N on VPS: http://YOUR_VPS:5678
// Create workflows with webhook triggers, JARVIS calls them

export async function n8nTrigger(webhookUrl: string, payload: any) {
  try {
    var res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ============================================================
//  CONFIG MANAGEMENT
//  User adds API keys in the JARVIS chat or via modal
// ============================================================

export interface ExternalConfig {
  hikerApiKey: string;
  uploadPostApiKey: string;
  manychatApiKey: string;
  n8nWebhookUrl: string;
}

// Get config from env vars (set in Vercel or .env.local)
export function getExternalConfig(): ExternalConfig {
  return {
    hikerApiKey: process.env.HIKER_API_KEY || '',
    uploadPostApiKey: process.env.UPLOAD_POST_API_KEY || '',
    manychatApiKey: process.env.MANYCHAT_API_KEY || '',
    n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  };
}
