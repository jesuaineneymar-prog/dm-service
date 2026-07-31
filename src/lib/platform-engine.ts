// ============================================================
//  JARVIS PLATFORM ENGINE — REAL HTTP API FOR IG, FB, TT
//  All actions are REAL, zero simulation
//  Credentials loaded from config.ts (centralized)
// ============================================================

import { env, OR_KEY, OR_URL, OR_MODEL, OR_FALLBACK_MODEL, HIKERAPI_KEY, UPLOADPOST_KEY, MANYCHAT_KEY, N8N_WEBHOOK_URL } from '@/lib/config';

// --- Credentials ---
var IG_USERNAME = env('IG_USERNAME');
var IG_PASSWORD = env('IG_PASSWORD');
var FB_USERNAME = env('FB_USERNAME');
var FB_PASSWORD = env('FB_PASSWORD');
var FB_DISPLAY_NAME = env('FB_DISPLAY_NAME');
var TT_USERNAME = env('TT_USERNAME');
var TT_PASSWORD = env('TT_PASSWORD');

// --- AI config ---
var OR_FALLBACK = OR_FALLBACK_MODEL;

// --- CAPTCHA Solver ---
var NOCAPTCHA_KEY = env('NOCAPTCHA_KEY');

// --- API Services ---
var UP_PROFILE = env('UP_PROFILE', 'jarvis');
var BROWSERLESS_KEY = env('BROWSERLESS_KEY');
var N8N_URL = N8N_WEBHOOK_URL;
var N8N_API_KEY = env('N8N_API_KEY');

// --- Helpers ---
var fetchW = function(url: string, opts: any, timeout?: number) {
  if (!timeout) timeout = 15000;
  var ac = new AbortController();
  var tid = setTimeout(function() { ac.abort(); }, timeout);
  return fetch(url, { ...opts, signal: ac.signal }).then(function(res) {
    clearTimeout(tid); return res;
  }).catch(function() {
    clearTimeout(tid); return null;
  });
};

var IG_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
var IG_HEADERS = function(sessionid: string, csrftoken: string, extra?: any) {
  var dsUserId = sessionid.split('%3A')[0] || '';
  var base: any = {
    'User-Agent': IG_UA,
    'X-IG-App-ID': '936619743392459',
    'X-CSRFToken': csrftoken,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept-Language': 'pt-PT,pt;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (sessionid) base['Cookie'] = 'sessionid=' + sessionid + '; csrftoken=' + csrftoken + '; ds_user_id=' + dsUserId + '; ig_did=00000000-0000-0000-0000-000000000000; mid=XYZ; rur=FTW';
  return { ...base, ...extra };
};

var TT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
var TT_HEADERS = function(sessionid: string, csrf: string) {
  return {
    'User-Agent': TT_UA,
    'Cookie': 'sessionid=' + sessionid + '; tt_csrf_token=' + csrf,
    'X-CSRFToken': csrf,
    'Referer': 'https://www.tiktok.com/',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
};

var FB_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ============================================================
//  HIKERAPI MODULE — Instagram Private API (154 endpoints)
//  https://api.hikerapi.com — $0.0006/request
// ============================================================

var HIKER_BASE = 'https://api.hikerapi.com';
var hikerHeaders = function() {
  return { 'x-access-key': HIKERAPI_KEY, 'Accept': 'application/json' };
};

// --- HikerAPI: Get user profile by username ---
export async function hikerGetUser(username: string): Promise<any> {
  try {
    var res = await fetchW(HIKER_BASE + '/v1/user/by/username?username=' + encodeURIComponent(username), { headers: hikerHeaders() });
    if (!res) return null;
    var data = await res.json();
    if (data && data.pk) return data;
    return null;
  } catch (e) { return null; }
}

// --- HikerAPI: Get user ID ---
export async function hikerGetUserId(username: string): Promise<string | null> {
  var user = await hikerGetUser(username);
  return user ? String(user.pk) : null;
}

// --- HikerAPI: Get followers ---
export async function hikerGetFollowers(userId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/user/followers?user_id=' + userId + '&amount=' + (amount || 50);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get following ---
export async function hikerGetFollowing(userId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/user/following?user_id=' + userId + '&amount=' + (amount || 50);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get user posts/medias ---
export async function hikerGetMedias(userId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/user/medias?user_id=' + userId + '&amount=' + (amount || 12);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get media details by code ---
export async function hikerGetMediaByCode(code: string): Promise<any> {
  try {
    var res = await fetchW(HIKER_BASE + '/v1/media/by/code?code=' + code, { headers: hikerHeaders() });
    if (!res) return null;
    return await res.json();
  } catch (e) { return null; }
}

// --- HikerAPI: Get comments of a post ---
export async function hikerGetComments(mediaId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/media/comments?id=' + mediaId + '&amount=' + (amount || 20);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get likers of a post ---
export async function hikerGetLikers(mediaId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/media/likers?id=' + mediaId + '&amount=' + (amount || 50);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get user stories ---
export async function hikerGetStories(userId: string): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/user/stories?user_id=' + userId;
    var res = await fetchW(url, { headers: hikerHeaders() }, 20000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Search users ---
export async function hikerSearchUsers(query: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/search/users?query=' + encodeURIComponent(query) + '&amount=' + (amount || 20);
    var res = await fetchW(url, { headers: hikerHeaders() }, 20000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get user highlights ---
export async function hikerGetHighlights(userId: string): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/user/highlights?user_id=' + userId;
    var res = await fetchW(url, { headers: hikerHeaders() }, 20000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Check API balance ---
export async function hikerGetBalance(): Promise<{ requests: number; amount: number }> {
  try {
    var res = await fetchW(HIKER_BASE + '/sys/balance', { headers: hikerHeaders() });
    if (!res) return { requests: 0, amount: 0 };
    var data = await res.json();
    return { requests: data.requests || 0, amount: data.amount || 0 };
  } catch (e) { return { requests: 0, amount: 0 }; }
}

// --- HikerAPI: GraphQL comments (threaded) ---
export async function hikerGetCommentsGraphQL(mediaId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/gql/comments?media_id=' + mediaId + '&amount=' + (amount || 20);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get user clips/reels ---
export async function hikerGetClips(userId: string, amount?: number): Promise<any[]> {
  try {
    var url = HIKER_BASE + '/v1/user/clips?user_id=' + userId + '&amount=' + (amount || 12);
    var res = await fetchW(url, { headers: hikerHeaders() }, 30000);
    if (!res) return [];
    var data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) { return []; }
}

// --- HikerAPI: Get user info/about ---
export async function hikerGetUserAbout(userId: string): Promise<any> {
  try {
    var res = await fetchW(HIKER_BASE + '/v1/user/about?user_id=' + userId, { headers: hikerHeaders() });
    if (!res) return null;
    return await res.json();
  } catch (e) { return null; }
}

// ============================================================
//  UPLOAD-POST MODULE — Multi-platform publishing (22 networks)
//  https://api.upload-post.com — Auth: Apikey <jwt>
// ============================================================

var UP_BASE = 'https://api.upload-post.com';
var upHeaders = function() {
  return { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Accept': 'application/json' };
};

// --- Upload-Post: Publish text to multiple platforms ---
export async function upPublishText(title: string, platforms: string[], options?: any): Promise<any> {
  try {
    var form = new URLSearchParams();
    form.append('user', UP_PROFILE);
    form.append('title', title);
    platforms.forEach(function(p) { form.append('platform[]', p); });
    if (options && options.description) form.append('description', options.description);
    if (options && options.scheduled_date) form.append('scheduled_date', options.scheduled_date);
    if (options && options.timezone) form.append('timezone', options.timezone);
    if (options && options.async_upload) form.append('async_upload', 'true');
    if (options && options.first_comment) form.append('first_comment', options.first_comment);

    var res = await fetchW(UP_BASE + '/api/upload_text', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, 30000);
    if (!res) return { success: false, error: 'Timeout ao conectar Upload-Post' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Publish photos to multiple platforms ---
export async function upPublishPhotos(photos: Buffer[], title: string, platforms: string[], options?: any): Promise<any> {
  try {
    var form = new FormData();
    form.append('user', UP_PROFILE);
    form.append('title', title);
    platforms.forEach(function(p) { form.append('platform[]', p); });
    photos.forEach(function(photo) { form.append('photos[]', new Blob([photo]), 'photo.jpg'); });
    if (options && options.description) form.append('description', options.description);
    if (options && options.scheduled_date) form.append('scheduled_date', options.scheduled_date);
    if (options && options.first_comment) form.append('first_comment', options.first_comment);
    if (options && options.instagram_title) form.append('instagram_title', options.instagram_title);
    if (options && options.facebook_title) form.append('facebook_title', options.facebook_title);
    if (options && options.tiktok_title) form.append('tiktok_title', options.tiktok_title);

    var res = await fetchW(UP_BASE + '/api/upload_photos', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY },
      body: form,
    }, 60000);
    if (!res) return { success: false, error: 'Timeout ao enviar fotos' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Publish video to multiple platforms ---
export async function upPublishVideo(videoBuffer: Buffer, title: string, platforms: string[], options?: any): Promise<any> {
  try {
    var form = new FormData();
    form.append('user', UP_PROFILE);
    form.append('video', new Blob([videoBuffer]), 'video.mp4');
    form.append('title', title);
    platforms.forEach(function(p) { form.append('platform[]', p); });
    if (options && options.description) form.append('description', options.description);
    if (options && options.scheduled_date) form.append('scheduled_date', options.scheduled_date);
    if (options && options.async_upload) form.append('async_upload', 'true');

    var res = await fetchW(UP_BASE + '/api/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY },
      body: form,
    }, 120000);
    if (!res) return { success: false, error: 'Timeout ao enviar video' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get upload history ---
export async function upGetHistory(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/history', { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get upload status ---
export async function upGetStatus(requestId: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/status?request_id=' + requestId, { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get scheduled posts ---
export async function upGetSchedule(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/schedule', { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get media from connected accounts ---
export async function upGetMedia(platform?: string, limit?: number): Promise<any> {
  try {
    var url = UP_BASE + '/api/uploadposts/media';
    var params: string[] = [];
    if (platform) params.push('platform=' + platform);
    if (limit) params.push('limit=' + limit);
    if (params.length) url += '?' + params.join('&');
    var res = await fetchW(url, { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get Instagram comments via Upload-Post ---
export async function upGetComments(mediaIdOrUrl: string): Promise<any> {
  try {
    var url = UP_BASE + '/api/uploadposts/comments?media_id=' + encodeURIComponent(mediaIdOrUrl);
    var res = await fetchW(url, { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Reply to Instagram comment via DM ---
export async function upReplyComment(mediaId: string, commentId: string, message: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/comments/reply', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId, comment_id: commentId, message: message }),
    }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Send DM via Instagram ---
export async function upSendDM(recipientUserId: string, message: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/dms/send', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_id: recipientUserId, message: message }),
    }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get DM conversations ---
export async function upGetDMConversations(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/dms/conversations', { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Create user profile ---
export async function upCreateProfile(username: string, name: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/users', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, name: name }),
    }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: List profiles ---
export async function upListProfiles(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/users', { headers: upHeaders() }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get analytics ---
export async function upGetAnalytics(username: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/analytics/' + encodeURIComponent(username), { headers: upHeaders() }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get queue settings ---
export async function upGetQueueSettings(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/queue/settings', { headers: upHeaders() }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get current account info (/me) ---
export async function upGetAccountInfo(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/me', { headers: upHeaders() }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get specific profile with connected social accounts ---
export async function upGetProfile(username: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/users/' + encodeURIComponent(username), { headers: upHeaders() }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Generate OAuth connection URL (CRITICAL — connects IG/FB/TikTok) ---
// Returns: { access_url, duration } — User MUST open in browser to authorize each platform
export async function upGenerateConnectURL(opts: {
  platforms?: string[],
  redirect_url?: string,
  connect_title?: string,
  logo_image?: string,
  language?: string,
  username?: string,
}): Promise<{ success: boolean; access_url?: string; duration?: string; error?: string }> {
  try {
    var body = {
      username: opts.username || UP_PROFILE,
      redirect_url: opts.redirect_url || 'https://jarvis-khaki-chi.vercel.app',
      platforms: opts.platforms || ['instagram', 'facebook', 'tiktok'],
      connect_title: opts.connect_title || 'Mwango Brain — Conectar Redes Sociais ao JARVIS',
      logo_image: opts.logo_image || '',
      language: opts.language || 'pt',
    };
    var res = await fetchW(UP_BASE + '/api/uploadposts/users/generate-jwt', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 20000);
    if (!res) return { success: false, error: 'Timeout ao gerar URL de conexão' };
    var data = await res.json();
    if (data && data.access_url) {
      return { success: true, access_url: data.access_url, duration: data.duration || '48h' };
    }
    return { success: false, error: JSON.stringify(data) };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: List Facebook pages connected to account ---
export async function upGetFacebookPages(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/facebook/pages', { headers: upHeaders() }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Cancel a scheduled post ---
export async function upCancelScheduled(jobId: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/schedule/' + encodeURIComponent(jobId), {
      method: 'DELETE',
      headers: upHeaders(),
    }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Update/reschedule a post ---
export async function upUpdateScheduled(jobId: string, updates: any): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/schedule/' + encodeURIComponent(jobId), {
      method: 'PATCH',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Get queue preview ---
export async function upGetQueuePreview(): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/queue/preview', { headers: upHeaders() }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Retry a failed post ---
export async function upRetryPost(requestId: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/posts/retry', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId }),
    }, 30000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Unpublish a post ---
export async function upUnpublishPost(postId: string, platform: string): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/posts/unpublish', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, platform: platform }),
    }, 20000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Update queue settings ---
export async function upUpdateQueueSettings(settings: any): Promise<any> {
  try {
    var res = await fetchW(UP_BASE + '/api/uploadposts/queue/settings', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }, 15000);
    if (!res) return { success: false, error: 'Timeout' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post: Publish from a URL (video or photo) ---
export async function upPublishFromURL(mediaURL: string, title: string, platforms: string[], options?: any): Promise<any> {
  try {
    var form = new FormData();
    form.append('user', UP_PROFILE);
    form.append('title', title);
    form.append('video', mediaURL); // Upload-Post accepts URL or file binary
    platforms.forEach(function(p) { form.append('platform[]', p); });
    if (options && options.scheduled_date) form.append('scheduled_date', options.scheduled_date);
    if (options && options.add_to_queue) form.append('add_to_queue', 'true');
    if (options && options.async_upload) form.append('async_upload', 'true');
    if (options && options.first_comment) form.append('first_comment', options.first_comment);
    if (options && options.facebook_page_id) form.append('facebook_page_id', options.facebook_page_id);
    if (options && options.thumbnail) form.append('thumbnail', options.thumbnail);

    var res = await fetchW(UP_BASE + '/api/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + UPLOADPOST_KEY },
      body: form,
    }, 60000);
    if (!res) return { success: false, error: 'Timeout ao publicar via URL' };
    return await res.json();
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function igLogin(): Promise<{ success: boolean; sessionid?: string; csrftoken?: string; error?: string; userId?: string }> {
  try {
    // Step 1: Get initial CSRF token and cookies
    var initRes = await fetchW('https://www.instagram.com/', { headers: { 'User-Agent': IG_UA } }, 10000);
    if (!initRes) return { success: false, error: 'Falhou ao conectar ao Instagram' };

    var cookies = initRes.headers.get('set-cookie') || '';
    var csrfMatch = cookies.match(/csrftoken=([^;]+)/);
    var csrf = csrfMatch ? csrfMatch[1] : '';

    if (!csrf) {
      // Try from HTML
      var html = await initRes.text();
      var htmlCsrf = html.match(/csrftoken["\s:=]+"([^"]+)"/);
      if (htmlCsrf) csrf = htmlCsrf[1];
    }

    if (!csrf) return { success: false, error: 'Nao conseguiu obter CSRF token' };

    // Step 2: Login
    var body = 'username=' + encodeURIComponent(IG_USERNAME) + '&enc_password=' + encodeURIComponent('#PWD_INSTAGRAM_BROWSER:0:' + Date.now() + ':' + IG_PASSWORD) + '&queryParams=%7B%7D&optIntoOneTap=false&stopDeletion=false&trustedDevice=true';

    var loginRes = await fetchW('https://www.instagram.com/api/v1/web/accounts/login/ajax/', {
      method: 'POST',
      headers: {
        'User-Agent': IG_UA,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrf,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.instagram.com/',
        'Cookie': 'csrftoken=' + csrf + '; ig_did=00000000-0000-0000-0000-000000000000; mid=XYZ',
      },
      body: body,
    }, 20000);

    if (!loginRes) return { success: false, error: 'Sem resposta do login' };

    var loginData = await loginRes.json().catch(function() { return null; });

    if (!loginData) return { success: false, error: 'Resposta invalida do login' };

    if (loginData.two_factor_required) {
      return { success: false, error: 'VERIFICACAO_2FA: Instagram pediu verificacao em 2 etapas. Abre o teu Instagram e aprova o login.' };
    }

    if (loginData.userId && loginData.loggedInUser) {
      var loginCookies = loginRes.headers.get('set-cookie') || '';
      var sidMatch = loginCookies.match(/sessionid=([^;]+)/);
      var newCsrf = loginCookies.match(/csrftoken=([^;]+)/);

      if (sidMatch && newCsrf) {
        return {
          success: true,
          sessionid: sidMatch[1],
          csrftoken: newCsrf[1],
          userId: String(loginData.userId),
        };
      }
    }

    if (loginData.status === 'fail' || loginData.error_type) {
      return { success: false, error: 'LOGIN_FALHOU: ' + (loginData.message || loginData.error_type || 'Credenciais incorrectas ou conta bloqueada') };
    }

    return { success: false, error: 'LOGIN_INCERTO: ' + JSON.stringify(loginData).slice(0, 200) };
  } catch (e: any) {
    return { success: false, error: 'ERRO: ' + (e.message || 'desconhecido') };
  }
}

// Get Instagram user ID from username
export async function igGetUserId(sessionid: string, csrftoken: string, username: string): Promise<string | null> {
  try {
    var res = await fetchW('https://www.instagram.com/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username), {
      headers: IG_HEADERS(sessionid, csrftoken),
    }, 12000);
    if (!res || !res.ok) return null;
    var data = await res.json();
    return data.data?.user?.pk || data.data?.user?.id || null;
  } catch (e) { return null; }
}

// Send Instagram DM
export async function igSendDM(sessionid: string, csrftoken: string, recipientId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Create thread
    var threadRes = await fetchW('https://www.instagram.com/api/v1/direct_v2/create_thread/', {
      method: 'POST',
      headers: IG_HEADERS(sessionid, csrftoken),
      body: 'recipient_users=[' + JSON.stringify([String(recipientId)]) + ']&client_context=' + Date.now() + '&device_id=' + (Math.random().toString(36) + Date.now().toString(36)),
    }, 15000);

    var threadData = await threadRes.json();
    var threadId = threadData.thread_id || threadData.thread?.thread_id;

    if (!threadId) {
      return { success: false, error: 'Nao criou thread de DM' };
    }

    // Send message
    var msgRes = await fetchW('https://www.instagram.com/api/v1/direct_v2/threads/' + threadId + '/items/', {
      method: 'POST',
      headers: IG_HEADERS(sessionid, csrftoken),
      body: 'text=' + encodeURIComponent(message) + '&client_context=' + Date.now() + '&device_id=' + (Math.random().toString(36) + Date.now().toString(36)),
    }, 15000);

    if (msgRes && msgRes.ok) return { success: true };
    return { success: false, error: 'Falhou ao enviar DM (HTTP ' + (msgRes ? msgRes.status : '?') + ')' };
  } catch (e: any) {
    return { success: false, error: e.message || 'timeout' };
  }
}

// Get recent Instagram posts
export async function igGetRecentPosts(sessionid: string, csrftoken: string, userId: string): Promise<any[]> {
  try {
    var res = await fetchW('https://www.instagram.com/api/v1/feed/user/' + userId + '/?count=10', {
      headers: IG_HEADERS(sessionid, csrftoken),
    }, 15000);
    if (!res || !res.ok) return [];
    var data = await res.json();
    return (data.items || []).map(function(item: any) {
      return {
        id: item.id || item.pk,
        caption: (item.caption?.text || '').slice(0, 200),
        mediaType: item.media_type || 1,
        likeCount: item.like_count || 0,
        commentCount: item.comment_count || 0,
        takenAt: item.taken_at ? new Date(item.taken_at * 1000).toISOString() : '',
        imageUrl: item.image_versions2?.candidates?.[0]?.url || item.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url || '',
      };
    });
  } catch (e) { return []; }
}

// Get comments on a post
export async function igGetComments(sessionid: string, csrftoken: string, mediaId: string): Promise<any[]> {
  try {
    var res = await fetchW('https://www.instagram.com/api/v1/media/' + mediaId + '/comments/?can_support_threading=true&permalink_enabled=false', {
      headers: IG_HEADERS(sessionid, csrftoken),
    }, 12000);
    if (!res || !res.ok) return [];
    var data = await res.json();
    return (data.comments || []).map(function(c: any) {
      return {
        id: c.pk || c.id,
        username: c.user?.username || '',
        text: c.text || '',
        userId: c.user_id || c.user?.pk,
        createdAt: c.created_at || c.created_at_utc || 0,
        liked: c.has_liked || false,
      };
    });
  } catch (e) { return []; }
}

// Reply to a comment
export async function igReplyComment(sessionid: string, csrftoken: string, mediaId: string, commentId: string, replyText: string): Promise<{ success: boolean; error?: string }> {
  try {
    var res = await fetchW('https://www.instagram.com/api/v1/media/' + mediaId + '/comments/' + commentId + '/reply/', {
      method: 'POST',
      headers: IG_HEADERS(sessionid, csrftoken),
      body: 'comment_text=' + encodeURIComponent(replyText) + '&replied_to_comment_id=' + commentId,
    }, 12000);
    if (res && res.ok) {
      var data = await res.json();
      return { success: !!data.pk || !!data.id };
    }
    return { success: false, error: 'Falhou ao responder' };
  } catch (e: any) {
    return { success: false, error: e.message || 'timeout' };
  }
}

// Upload photo and create post
export async function igUploadPost(sessionid: string, csrftoken: string, imageData: Buffer, caption: string): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    // Step 1: Upload photo using FormData (proper multipart)
    var uploadId = Date.now().toString();
    var formData = new FormData();
    formData.append('upload_id', uploadId);
    formData.append('photo', new Blob([imageData], { type: 'image/jpeg' }), 'photo.jpg');

    // For serverless, we use the v2 upload endpoint
    var uploadRes = await fetchW('https://www.instagram.com/api/v2/upload/photo/', {
      method: 'POST',
      headers: {
        'User-Agent': IG_UA,
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': csrftoken,
        'X-Requested-With': 'XMLHttpRequest',
        'Accept-Language': 'pt-PT,pt;q=0.9',
      },
      body: formData,
    }, 30000);

    if (!uploadRes || !uploadRes.ok) {
      // Fallback: configure without actual upload - create a text-only post attempt
      var configureRes = await fetchW('https://www.instagram.com/api/v1/media/configure/', {
        method: 'POST',
        headers: IG_HEADERS(sessionid, csrftoken),
        body: 'caption=' + encodeURIComponent(caption) + '&media_type=1&upload_id=' + uploadId + '&device_id=' + (Math.random().toString(36) + Date.now().toString(36)),
      }, 20000);

      if (configureRes && configureRes.ok) {
        var cData = await configureRes.json();
        if (cData.media?.id) return { success: true, mediaId: cData.media.id };
      }

      return { success: false, error: 'Upload falhou. Instagram requer browser real para upload de fotos. Usa a opcao de publicar via API.' };
    }

    var uploadData = await uploadRes.json();
    var serverUploadId = uploadData.upload_id || uploadId;

    // Step 2: Configure the post
    var cfgRes = await fetchW('https://www.instagram.com/api/v1/media/configure/', {
      method: 'POST',
      headers: IG_HEADERS(sessionid, csrftoken),
      body: 'caption=' + encodeURIComponent(caption) + '&media_type=1&upload_id=' + serverUploadId,
    }, 20000);

    if (cfgRes && cfgRes.ok) {
      var cfgData = await cfgRes.json();
      if (cfgData.media?.id) return { success: true, mediaId: cfgData.media.id };
      if (cfgData.pk) return { success: true, mediaId: cfgData.pk };
    }

    return { success: false, error: 'Post criado mas sem ID confirmado' };
  } catch (e: any) {
    return { success: false, error: e.message || 'upload timeout' };
  }
}

// Read Instagram inbox (DMs received)
export async function igGetInbox(sessionid: string, csrftoken: string): Promise<any[]> {
  try {
    var res = await fetchW('https://www.instagram.com/api/v1/direct_v2/inbox/?visual_messages_return=false&thread_message_limit=10&persistentBadging=true&limit=20', {
      headers: IG_HEADERS(sessionid, csrftoken),
    }, 12000);
    if (!res || !res.ok) return [];
    var data = await res.json();
    var messages: any[] = [];
    var threads = data.inbox?.threads || [];
    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];
      var items = thread.items || [];
      var users = thread.users || [];
      var otherUser = users[0];
      for (var j = 0; j < items.length; j++) {
        var item = items[j];
        if (item.item_type === 'text' && String(item.user_id) !== String(thread.inviter_id || 0)) {
          messages.push({
            username: otherUser?.username || '',
            text: item.text || '',
            timestamp: item.timestamp || 0,
            threadId: thread.thread_id,
            platform: 'instagram',
          });
        }
      }
    }
    return messages.slice(0, 30);
  } catch (e) { return []; }
}

// ============================================================
//  FACEBOOK REAL OPERATIONS
// ============================================================

export async function fbLogin(): Promise<{ success: boolean; cookies?: string; dtsg?: string; error?: string }> {
  try {
    var initRes = await fetchW('https://m.facebook.com/', {
      headers: { 'User-Agent': FB_UA },
      redirect: 'manual',
    }, 10000);
    if (!initRes) return { success: false, error: 'Falhou ao conectar ao Facebook' };

    var html = await initRes.text();
    var dtsgMatch = html.match(/dtsg.+?value="([^"]+)"/);
    var lsdMatch = html.match(/\["LSD",[],{"token":"([^"]+)"}/);
    var lsd = lsdMatch ? lsdMatch[1] : '';
    var fbDtsg = dtsgMatch ? dtsgMatch[1] : '';

    if (!fbDtsg) return { success: false, error: 'Nao conseguiu obter dtsg token' };

    // Login
    var loginBody = 'email=' + encodeURIComponent(FB_USERNAME) + '&pass=' + encodeURIComponent(FB_PASSWORD) + '&lsd=' + encodeURIComponent(lsd) + '&fb_dtsg=' + encodeURIComponent(fbDtsg) + '&jazoest=21934&li=lbWSZ7eY9rWkEaAK&locale=pt_PT';

    var loginRes = await fetchW('https://m.facebook.com/login/', {
      method: 'POST',
      headers: {
        'User-Agent': FB_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://m.facebook.com/',
        'Origin': 'https://m.facebook.com',
      },
      body: loginBody,
      redirect: 'manual',
    }, 20000);

    if (!loginRes) return { success: false, error: 'Sem resposta do login' };

    var location = loginRes.headers.get('location') || '';
    var setCookies = loginRes.headers.get('set-cookie') || '';
    var allCookies = '';

    if (loginRes.status === 302 && location) {
      // Follow redirect
      var redirRes = await fetchW(location, { headers: { 'User-Agent': FB_UA }, redirect: 'manual' }, 10000);
      if (redirRes) allCookies = (redirRes.headers.get('set-cookie') || '');
    }

    // Check for CAPTCHA or verification
    if (location.indexOf('checkpoint') >= 0 || location.indexOf('captcha') >= 0) {
      return { success: false, error: 'VERIFICACAO_FB: Facebook pediu CAPTCHA ou verificacao. Precisa de resolucao manual.' };
    }

    // Extract dtsg from response
    var loginHtml = await loginRes.text().catch(function() { return ''; });
    var newDtsg = loginHtml.match(/dtsg.+?value="([^"]+)"/);
    if (newDtsg) fbDtsg = newDtsg[1];

    if (setCookies || allCookies) {
      return { success: true, cookies: setCookies + allCookies, dtsg: fbDtsg };
    }

    return { success: false, error: 'Login inconclusivo. Verifica as credenciais.' };
  } catch (e: any) {
    return { success: false, error: 'ERRO: ' + (e.message || 'desconhecido') };
  }
}

// Get Facebook user ID from username
export async function fbGetUserId(fbCookie: string, username: string): Promise<string | null> {
  try {
    var res = await fetchW('https://www.facebook.com/' + encodeURIComponent(username), {
      headers: { 'User-Agent': FB_UA, 'Cookie': fbCookie },
      redirect: 'manual',
    }, 10000);
    var location = res?.headers.get('location') || '';
    var idMatch = location.match(/id=(\d+)/);
    if (idMatch) return idMatch[1];

    var text = await res.text();
    var entityMatch = text.match(/"entity_id"\s*:\s*"(\d+)"/);
    return entityMatch ? entityMatch[1] : null;
  } catch (e) { return null; }
}

// Send Facebook DM
export async function fbSendDM(fbCookie: string, fbDtsg: string, recipientId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    var res = await fetchW('https://www.facebook.com/messaging/send/', {
      method: 'POST',
      headers: {
        'User-Agent': FB_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': fbCookie,
        'Origin': 'https://www.facebook.com',
        'Referer': 'https://www.facebook.com/messages/t/' + recipientId,
      },
      body: 'fb_dtsg=' + encodeURIComponent(fbDtsg) + '&body=' + encodeURIComponent(message) + '&ids%5B' + recipientId + '%5D=' + recipientId + '&action=send',
    }, 15000);
    if (res && res.ok) {
      var data = await res.json();
      if (!data.error) return { success: true };
      return { success: false, error: data.error || 'Erro no envio' };
    }
    return { success: false, error: 'HTTP ' + (res ? res.status : '?') };
  } catch (e: any) {
    return { success: false, error: e.message || 'timeout' };
  }
}

// ============================================================
//  TIKTOK REAL OPERATIONS
// ============================================================

export async function ttLogin(): Promise<{ success: boolean; sessionid?: string; csrf?: string; error?: string }> {
  try {
    var initRes = await fetchW('https://www.tiktok.com/', {
      headers: { 'User-Agent': TT_UA },
    }, 10000);
    if (!initRes) return { success: false, error: 'Falhou ao conectar ao TikTok' };

    var html = await initRes.text();
    var csrfMatch = html.match(/tt_csrf_token["\s:=]+"([^"]+)"/);
    var csrf = csrfMatch ? csrfMatch[1] : '';

    // Login
    var loginBody = 'username=' + encodeURIComponent(TT_USERNAME) + '&password=' + encodeURIComponent(TT_PASSWORD) + '&verifyToken=';

    var loginRes = await fetchW('https://www.tiktok.com/passport/general/login/password/', {
      method: 'POST',
      headers: {
        'User-Agent': TT_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': 'tt_csrf_token=' + csrf,
        'X-CSRFToken': csrf,
        'Referer': 'https://www.tiktok.com/',
      },
      body: loginBody,
    }, 20000);

    if (!loginRes) return { success: false, error: 'Sem resposta do login' };

    var data = await loginRes.json().catch(function() { return null; });

    if (data && data.data) {
      var setCookies = loginRes.headers.get('set-cookie') || '';
      var sidMatch = setCookies.match(/sessionid=([^;]+)/);
      var newCsrf = setCookies.match(/tt_csrf_token=([^;]+)/);
      return {
        success: true,
        sessionid: sidMatch ? sidMatch[1] : '',
        csrf: newCsrf ? newCsrf[1] : csrf,
      };
    }

    if (data && data.message) {
      return { success: false, error: 'LOGIN_FALHOU: ' + data.message };
    }

    return { success: false, error: 'Resposta inesperada do TikTok' };
  } catch (e: any) {
    return { success: false, error: 'ERRO: ' + (e.message || 'desconhecido') };
  }
}

// Get TikTok user ID from username
export async function ttGetUserId(sessionid: string, csrf: string, username: string): Promise<string | null> {
  try {
    var res = await fetchW('https://www.tiktok.com/api/user/detail/?uniqueId=' + encodeURIComponent(username) + '&needSecUserId=1', {
      headers: TT_HEADERS(sessionid, csrf),
    }, 12000);
    if (!res || !res.ok) return null;
    var data = await res.json();
    return data.userInfo?.user?.id || data.user?.id || null;
  } catch (e) { return null; }
}

// Send TikTok DM
export async function ttSendDM(sessionid: string, csrf: string, recipientId: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    var res = await fetchW('https://www.tiktok.com/api/chat/send/', {
      method: 'POST',
      headers: TT_HEADERS(sessionid, csrf),
      body: 'recipient_user_id=' + encodeURIComponent(recipientId) + '&content=' + encodeURIComponent(message) + '&type=text',
    }, 15000);
    if (res && res.ok) {
      var data = await res.json();
      if (data.status_code === 0 || !data.message) return { success: true };
      return { success: false, error: data.message || 'Erro' };
    }
    return { success: false, error: 'HTTP ' + (res ? res.status : '?') };
  } catch (e: any) {
    return { success: false, error: e.message || 'timeout' };
  }
}

// ============================================================
//  AI-POWERED REPLY GENERATION (via OpenRouter)
// ============================================================

export async function generateAIReply(commentText: string, postCaption: string, platform: string): Promise<string> {
  try {
    var sysPrompt = 'Responde a este comentario de forma natural, como a equipa da Mwango Brain responderia. Portugues de Angola, frases curtas (1-2 frases). Seja simpatico e profissional. NUNCA digas que es IA.';
    var messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: 'Publicacao: "' + postCaption + '"\nComentario: "' + commentText + '"\nPlataforma: ' + platform + '\n\nResponde ao comentario:' },
    ];

    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://jvfinal.vercel.app', 'X-Title': 'JARVIS' },
      body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: 150, temperature: 0.7 }),
    });

    if (!res.ok) {
      var res2 = await fetch(OR_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://jvfinal.vercel.app', 'X-Title': 'JARVIS' },
        body: JSON.stringify({ model: OR_FALLBACK, messages, max_tokens: 150, temperature: 0.7 }),
      });
      var d2 = await res2.json();
      return d2.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || 'Obrigado pelo comentario!';
    }

    var d = await res.json();
    return d.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || 'Obrigado pelo comentario!';
  } catch (e) {
    return 'Obrigado pelo comentario!';
  }
}

// Generate personalized DM for a prospect
export async function generateDM(prospectName: string, platform: string, customMessage?: string): Promise<string> {
  if (customMessage) return customMessage;

  try {
    var sysPrompt = 'Escreve uma mensagem de prospeccao curta e simpatica em portugues de Angola (2-3 frases). A Mwango Brain e uma agencia criativa angolana. O objectivo e contactar ' + prospectName + ' sobre uma proposta de colaboracao. NUNCA menciones que es IA.';
    var messages = [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: 'Prospecto: ' + prospectName + '\nPlataforma: ' + platform + '\nEscreve uma mensagem personalizada de prospeccao:' },
    ];

    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://jvfinal.vercel.app', 'X-Title': 'JARVIS' },
      body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: 200, temperature: 0.8 }),
    });

    var d = await res.ok ? await res.json() : null;
    return d?.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || 'Ola! Somos a Mwango Brain, uma agencia criativa angolana. Gostariamos de conversar contigo sobre uma possivel colaboracao. Podemos trocar ideias?';
  } catch (e) {
    return 'Ola! Somos a Mwango Brain, uma agencia criativa angolana. Gostariamos de conversar contigo sobre uma possivel colaboracao.';
  }
}

// ============================================================
//  COMMAND PARSER — interprets user commands and returns action
// ============================================================

export interface CommandResult {
  action: string;
  platform?: string;
  target?: string;
  message?: string;
  mediaUrl?: string;
  extra?: any;
}

export function parseCommand(text: string): CommandResult {
  var cmd = text.toLowerCase().trim();
  var result: CommandResult = { action: 'unknown' };

  // Login command
  if (cmd.includes('entra') || cmd.includes('login') || cmd.includes('conectar') || cmd.includes('ligar')) {
    if (cmd.includes('instagram') || cmd.includes('ig')) return { action: 'login', platform: 'instagram' };
    if (cmd.includes('facebook') || cmd.includes('fb')) return { action: 'login', platform: 'facebook' };
    if (cmd.includes('tiktok') || cmd.includes('tt') || cmd.includes('tic')) return { action: 'login', platform: 'tiktok' };
    if (cmd.includes('todas') || cmd.includes('tudo')) return { action: 'login', platform: 'all' };
    return { action: 'login', platform: 'all' };
  }

  // Post command
  if (cmd.includes('public') || cmd.includes('post') || cmd.includes('mete no')) {
    var platform = 'instagram';
    if (cmd.includes('facebook') || cmd.includes('fb')) platform = 'facebook';
    if (cmd.includes('tiktok') || cmd.includes('tt') || cmd.includes('tic')) platform = 'tiktok';
    var msg = text.replace(/^(jarvis\s*)?/i, '').replace(/(entra|publica|post|mete no)\s*(no\s*)?(instagram|facebook|tiktok|ig|fb|tt|tic(tok)?)?\s*(e\s+)?/i, '').trim();
    return { action: 'post', platform, message: msg };
  }

  // Read comments command
  if (cmd.includes('ve') && cmd.includes('coment')) {
    var pl = 'instagram';
    if (cmd.includes('facebook') || cmd.includes('fb')) pl = 'facebook';
    if (cmd.includes('tiktok') || cmd.includes('tt')) pl = 'tiktok';
    return { action: 'read_comments', platform: pl };
  }

  // Reply comments command
  if (cmd.includes('responde') && cmd.includes('coment')) {
    var pl2 = 'instagram';
    if (cmd.includes('facebook') || cmd.includes('fb')) pl2 = 'facebook';
    if (cmd.includes('tiktok') || cmd.includes('tt')) pl2 = 'tiktok';
    return { action: 'reply_comments', platform: pl2 };
  }

  // Send DM command
  if (cmd.includes('mandar mensagem') || cmd.includes('enviar mensagem') || cmd.includes('manda mensagem') || cmd.includes('envia mensagem') || cmd.includes('send dm') || cmd.includes('broadcast')) {
    var pl3 = 'all';
    if (cmd.includes('instagram') || cmd.includes('ig')) pl3 = 'instagram';
    if (cmd.includes('facebook') || cmd.includes('fb')) pl3 = 'facebook';
    if (cmd.includes('tiktok') || cmd.includes('tt')) pl3 = 'tiktok';
    var customMsg: string | undefined;
    var quotedMsg = text.match(/"([^"]+)"/);
    if (quotedMsg) customMsg = quotedMsg[1];
    return { action: 'send_dms', platform: pl3, message: customMsg };
  }

  // Inbox command
  if (cmd.includes('inbox') || cmd.includes('mensagens recebidas') || cmd.includes('dm recebido') || cmd.includes('ver mensagens')) {
    return { action: 'inbox', platform: 'all' };
  }

  // Import CSV command
  if (cmd.includes('importar') && cmd.includes('csv')) {
    return { action: 'import_csv' };
  }

  // === HIKERAPI COMMANDS (Instagram intelligence) ===

  // Profile lookup
  if (cmd.includes('perfil') || cmd.includes('profile') || cmd.includes('informações de') || cmd.includes('info de')) {
    var targetUser = cmd.match(/@(?:instagram\.com\/)?([a-zA-Z0-9_.]+)/);
    var targetUsername = targetUser ? targetUser[1] : '';
    if (!targetUsername) {
      // Try to extract from "perfil de XXX" or "info de @XXX"
      var t2 = cmd.match(/(?:perfil|profile|informações|info)[\sde]+@?([a-zA-Z0-9_.]+)/);
      targetUsername = t2 ? t2[1] : '';
    }
    return { action: 'hiker_profile', platform: 'instagram', target: targetUsername };
  }

  // Followers
  if (cmd.includes('seguidor') || cmd.includes('followers')) {
    var fgUser = cmd.match(/@(?:instagram\.com\/)?([a-zA-Z0-9_.]+)/);
    var fgTarget = fgUser ? fgUser[1] : '';
    return { action: 'hiker_followers', platform: 'instagram', target: fgTarget };
  }

  // Posts
  if (cmd.includes('ver post') || cmd.includes('ver public') || cmd.includes('feed') || cmd.includes('posts')) {
    return { action: 'hiker_posts', platform: 'instagram' };
  }

  // Stories
  if (cmd.includes('stories') || cmd.includes('story') || cmd.includes('historia')) {
    return { action: 'hiker_stories', platform: 'instagram' };
  }

  // Search users
  if (cmd.includes('procurar') || cmd.includes('pesquisar') || cmd.includes('buscar')) {
    var queryMatch = text.match(/(?:procurar|pesquisar|buscar)\s+(.+)/i);
    var searchQuery = queryMatch ? queryMatch[1].trim().replace('@', '') : '';
    return { action: 'hiker_search', platform: 'instagram', target: searchQuery };
  }

  // Balance
  if (cmd.includes('saldo') || cmd.includes('balance') || cmd.includes('créditos') || cmd.includes('creditos')) {
    return { action: 'hiker_balance' };
  }

  // === UPLOAD-POST COMMANDS (Publishing across IG + FB + TikTok) ===

  // Connect platforms via OAuth (generates URL)
  if (cmd.includes('conectar upload') || cmd.includes('ligar upload') || cmd.includes('oauth') || cmd.includes('connect url') || cmd.includes('gerar link')) {
    return { action: 'up_connect' };
  }

  // Show connected accounts
  if (cmd.includes('contas conectadas') || cmd.includes('contas ligadas') || cmd.includes('estado das contas') || cmd.includes('plataformas conectadas') || cmd.includes('ver contas')) {
    return { action: 'up_accounts' };
  }

  // Account info
  if (cmd.includes('minha conta upload') || cmd.includes('info upload') || cmd.includes('plano upload')) {
    return { action: 'up_me' };
  }

  // Publish to multiple platforms at once (cross-posting)
  if (cmd.includes('publica em tudo') || cmd.includes('publicar em tudo') || cmd.includes('post em tudo') || cmd.includes('cross-post')) {
    var crossMsg = text.replace(/^(jarvis\s*)?/i, '').replace(/(publica|publicar|post|mete)\s+(em tudo|em todas|tudo|cross-post)\s*/i, '').trim();
    return { action: 'up_publish_all', message: crossMsg };
  }

  // Schedule a post
  if (cmd.includes('agendar') || cmd.includes('schedule')) {
    var schedMatch = text.match(/(?:agendar|schedule)\s+(.+?)(?:\s+para\s+|\s+@\s+|\s+as\s+)(.+)$/i);
    var schedMsg = schedMatch ? schedMatch[1].trim() : '';
    var schedDate = schedMatch ? schedMatch[2].trim() : '';
    return { action: 'up_schedule', message: schedMsg, target: schedDate };
  }

  // List scheduled posts
  if (cmd.includes('agendados') || cmd.includes('agendadas') || cmd.includes('ver agenda') || cmd.includes('scheduled posts')) {
    return { action: 'up_schedule_list' };
  }

  // List upload history
  if (cmd.includes('histórico') || cmd.includes('historico') || cmd.includes('history') || cmd.includes('posts recentes upload')) {
    return { action: 'up_history' };
  }

  // Queue preview
  if (cmd.includes('fila') || cmd.includes('queue') || cmd.includes('próximo post') || cmd.includes('proximo post')) {
    return { action: 'up_queue' };
  }

  // Facebook pages
  if (cmd.includes('páginas facebook') || cmd.includes('paginas facebook') || cmd.includes('fb pages') || cmd.includes('minhas páginas')) {
    return { action: 'up_fb_pages' };
  }

  return { action: 'unknown' };
}

// ============================================================
//  SESSION STORE (credentials saved across API calls)
// ============================================================

export interface PlatformSession {
  ig: { sessionid: string; csrftoken: string; userId: string } | null;
  fb: { cookies: string; dtsg: string } | null;
  tt: { sessionid: string; csrf: string } | null;
}

// In production these would be in a database, for now we return them from API routes
// and the frontend stores them in localStorage
