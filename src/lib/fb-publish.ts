// ============================================================
//  Aura FB PUBLISH — Facebook Posts, Stories, Comments via Graph API
//  Usa page access token (long-lived)
// ============================================================

import { META_PAGE_ID, META_PAGE_TOKEN, META_APP_ID, META_APP_SECRET, META_ACCESS_TOKEN } from './config';
import { db } from './db';

var GRAPH = 'https://graph.facebook.com/v21.0';

// Get page token — env var or from user token
async function getPageToken(): Promise<string> {
  if (META_PAGE_TOKEN) return META_PAGE_TOKEN;
  // Try DB
  try {
    var setting = await db.systemSetting.findUnique({ where: { key: 'meta_access_token' } });
    if (setting?.value) {
      // Exchange for page token
      var res = await fetch(GRAPH + '/me/accounts?fields=id,name,access_token&access_token=' + setting.value);
      var data = await res.json();
      if (data.data?.[0]?.access_token) return data.data[0].access_token;
      return setting.value;
    }
  } catch(e) {}
  return META_ACCESS_TOKEN;
}

async function getPageId(): Promise<string> {
  if (META_PAGE_ID) return META_PAGE_ID;
  try {
    var token = await getPageToken();
    var res = await fetch(GRAPH + '/me?fields=id&access_token=' + token);
    var data = await res.json();
    if (data.id) return data.id;
  } catch(e) {}
  return '1271692609354364'; // fallback Jarvis v3 page
}

// === PUBLISH POST ===
export async function fbPublishPost(options: {
  message?: string;
  imageUrl?: string;
  link?: string;
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    var token = await getPageToken();
    var pageId = await getPageId();
    var url = GRAPH + '/' + pageId + '/feed';

    var body: any = { message: options.message || '' };
    if (options.link) body.link = options.link;
    if (options.imageUrl) {
      // Post with photo — first need to upload or use URL
      // Graph API allows posting with a URL directly
      url = GRAPH + '/' + pageId + '/photos';
      body.url = options.imageUrl;
      if (options.message) body.caption = options.message;
      delete body.message;
    }

    var res = await fetch(url + '?access_token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };

    var postId = data.id || data.post_id;

    // Log to DB
    await db.postHistory.create({
      data: {
        platform: 'facebook',
        externalPostId: postId,
        caption: options.message,
        mediaUrl: options.imageUrl || null,
        status: 'published',
        source: 'graph_api',
        publishedAt: new Date(),
      },
    });

    return { success: true, postId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === PUBLISH STORY ===
export async function fbPublishStory(options: {
  imageUrl: string;
  caption?: string;
}): Promise<{ success: boolean; storyId?: string; error?: string }> {
  try {
    var token = await getPageToken();
    var pageId = await getPageId();

    // Download image first, then upload as multipart
    var imgRes = await fetch(options.imageUrl);
    if (!imgRes.ok) return { success: false, error: 'Falha ao baixar imagem: HTTP ' + imgRes.status };
    var imgBuffer = await imgRes.arrayBuffer();
    var contentType = imgRes.headers.get('content-type') || 'image/jpeg';

    var boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    var parts: Uint8Array[] = [];
    var encoder = new TextEncoder();

    // Part 1: source file
    var p1 = '--' + boundary + '\r\nContent-Disposition: form-data; name="source"; filename="story.jpg"\r\nContent-Type: ' + contentType + '\r\n\r\n';
    parts.push(encoder.encode(p1));
    parts.push(new Uint8Array(imgBuffer));
    parts.push(encoder.encode('\r\n'));

    // Close
    parts.push(encoder.encode('--' + boundary + '--\r\n'));

    var totalLen = parts.reduce(function(s, p) { return s + p.length; }, 0);
    var merged = new Uint8Array(totalLen);
    var offset = 0;
    for (var i = 0; i < parts.length; i++) { merged.set(parts[i], offset); offset += parts[i].length; }

    var res = await fetch(GRAPH + '/' + pageId + '/photos?access_token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=' + boundary },
      body: merged.buffer as any,
    });

    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };

    return { success: true, storyId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === GET COMMENTS ===
export async function fbGetComments(postId?: string, limit?: number) {
  try {
    var token = await getPageToken();
    var pageId = await getPageId();

    // Get page posts first if no postId
    var targetPostId = postId;
    if (!targetPostId) {
      var postsRes = await fetch(GRAPH + '/' + pageId + '/posts?fields=id,message,created_time&limit=10&access_token=' + token);
      var postsData = await postsRes.json();
      if (postsData.error) return { success: false, error: postsData.error.message };
      if (!postsData.data?.length) return { success: true, comments: [], posts: [] };
      targetPostId = postsData.data[0].id;
    }

    var commentsRes = await fetch(GRAPH + '/' + targetPostId + '/comments?fields=id,from,message,created_time&limit=' + (limit || 50) + '&access_token=' + token);
    var commentsData = await commentsRes.json();
    if (commentsData.error) return { success: false, error: commentsData.error.message };

    var comments = (commentsData.data || []).map(function(c: any) {
      return {
        id: c.id,
        username: c.from?.name || 'unknown',
        userId: c.from?.id,
        text: c.message,
        createdAt: c.created_time,
        platform: 'facebook',
        postId: targetPostId,
      };
    });

    return { success: true, comments, postId: targetPostId };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === REPLY TO COMMENT ===
export async function fbReplyComment(commentId: string, message: string) {
  try {
    var token = await getPageToken();
    var res = await fetch(GRAPH + '/' + commentId + '/comments?access_token=' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, commentId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === GET PAGE INSIGHTS (Analytics) ===
export async function fbGetInsights(metrics?: string[], period?: string) {
  try {
    var token = await getPageToken();
    var pageId = await getPageId();
    var metricList = metrics || [
      'page_impressions', 'page_impressions_unique', 'page_engaged_users',
      'page_post_engagements', 'page_follows', 'page_views_total',
      'page_fans', 'page_fans_online',
    ];
    var p = period || 'day';
    var res = await fetch(GRAPH + '/' + pageId + '/insights?metric=' + metricList.join(',') + '&period=' + p + '&access_token=' + token);
    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, data: data.data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === GET PAGE POSTS (for analytics) ===
export async function fbGetPosts(limit?: number) {
  try {
    var token = await getPageToken();
    var pageId = await getPageId();
    var res = await fetch(GRAPH + '/' + pageId + '/posts?fields=id,message,created_time,shares,likes.limit(0).summary(true),comments.limit(0).summary(true)&limit=' + (limit || 20) + '&access_token=' + token);
    var data = await res.json();
    if (data.error) return { success: false, error: data.error.message };
    var posts = (data.data || []).map(function(p: any) {
      return {
        id: p.id,
        caption: p.message || '',
        createdAt: p.created_time,
        likes: p.likes?.summary?.total_count || 0,
        comments: p.comments?.summary?.total_count || 0,
        shares: p.shares?.count || 0,
        platform: 'facebook',
      };
    });
    return { success: true, posts };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
