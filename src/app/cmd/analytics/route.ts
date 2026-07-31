// ============================================================
//  JARVIS ANALYTICS API — dados reais de engajamento
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HIKERAPI_KEY, UPLOADPOST_KEY, IG_USERNAME } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

// ── helpers ────────────────────────────────────────────────

async function hikerFetch(path: string) {
  var res = await fetch('https://api.hikerapi.com' + path, {
    headers: { 'x-access-key': HIKERAPI_KEY },
  });
  if (!res.ok) throw new Error('HikerAPI erro ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

async function uploadPostFetch(path: string) {
  var res = await fetch('https://api.upload-post.com/v1' + path, {
    headers: { Authorization: 'Apikey ' + UPLOADPOST_KEY },
  });
  if (!res.ok) throw new Error('UploadPost erro ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

// ── actions ────────────────────────────────────────────────

async function getStats() {
  // Fetch IG profile via HikerAPI
  var igProfile: any = null;
  try {
    igProfile = await hikerFetch('/users/by/username?username=' + IG_USERNAME);
  } catch (e: any) {
    console.error('HikerAPI getStats:', e.message);
  }

  // Fetch UploadPost profiles
  var upProfiles: any = null;
  try {
    upProfiles = await uploadPostFetch('/profiles');
  } catch (e: any) {
    console.error('UploadPost profiles:', e.message);
  }

  // Fetch UploadPost history
  var upHistory: any = null;
  try {
    upHistory = await uploadPostFetch('/history');
  } catch (e: any) {
    console.error('UploadPost history:', e.message);
  }

  var followers = igProfile?.follower_count || 0;
  var following = igProfile?.following_count || 0;
  var posts = igProfile?.media_count || 0;

  // Calculate engagement rate from recent posts if available
  var engagementRate = 0;
  var recentPosts: any[] = [];
  if (upHistory && Array.isArray(upHistory)) {
    recentPosts = upHistory.slice(0, 10).map(function (h: any) {
      return {
        id: h.id,
        platform: h.platform || h.social_network || '',
        status: h.status || '',
        caption: h.caption_text || h.text || '',
        createdAt: h.created_at || h.posted_at || '',
        likes: h.like_count || 0,
        comments: h.comment_count || 0,
      };
    });
    var totalLikes = recentPosts.reduce(function (s: number, p: any) { return s + (p.likes || 0); }, 0);
    var totalComments = recentPosts.reduce(function (s: number, p: any) { return s + (p.comments || 0); }, 0);
    if (followers > 0 && recentPosts.length > 0) {
      engagementRate = parseFloat(((totalLikes + totalComments) / (followers * recentPosts.length) * 100).toFixed(2));
    }
  }

  // Store analytics event for historical tracking (deduplicated — max 1 per hour)
  try {
    var oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    var existing = await db.analyticsEvent.findFirst({
      where: { platform: 'instagram', eventType: 'followers', recordedAt: { gte: oneHourAgo } },
    });
    if (!existing) {
      await db.analyticsEvent.create({
        data: { platform: 'instagram', eventType: 'followers', metricValue: followers, metadata: JSON.stringify({ username: IG_USERNAME, following, posts, engagementRate }) },
      });
    }
  } catch (e: any) {
    console.error('Erro ao guardar AnalyticsEvent:', e.message);
  }

  // Build platform data
  var platforms: any = { ig: {}, fb: {}, tt: {} };
  if (igProfile) {
    platforms.ig = {
      username: igProfile.username,
      fullName: igProfile.full_name,
      followers: igProfile.follower_count,
      following: igProfile.following_count,
      posts: igProfile.media_count,
      verified: igProfile.is_verified || false,
      bio: igProfile.biography || '',
    };
  }

  // Parse UploadPost connected accounts
  if (upProfiles) {
    var sa = (upProfiles.social_accounts || upProfiles.profile?.social_accounts || {});
    if (sa.facebook && typeof sa.facebook === 'object') {
      platforms.fb = { handle: sa.facebook.handle || '', displayName: sa.facebook.display_name || '' };
    }
    if (sa.tiktok && typeof sa.tiktok === 'object') {
      platforms.tt = { handle: sa.tiktok.handle || '', displayName: sa.tiktok.display_name || '' };
    }
  }

  return {
    followers,
    following,
    posts,
    engagementRate,
    platforms,
    recentPosts,
  };
}

async function getEngagementHistory(startDate: string) {
  var start = new Date(startDate);
  var events = await db.analyticsEvent.findMany({
    where: { recordedAt: { gte: start } },
    orderBy: { recordedAt: 'asc' },
  });

  // Group by date + eventType
  var grouped: Record<string, any> = {};
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var dateKey = ev.recordedAt.toISOString().slice(0, 10);
    var key = dateKey + '|' + ev.eventType;
    if (!grouped[key]) {
      grouped[key] = { date: dateKey, eventType: ev.eventType, metricValue: 0, count: 0 };
    }
    grouped[key].metricValue += ev.metricValue;
    grouped[key].count += 1;
  }

  return Object.values(grouped);
}

async function trackEvent(platform: string, eventType: string, metricValue: number, metadata: any) {
  var event = await db.analyticsEvent.create({
    data: {
      platform,
      eventType,
      metricValue,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
  return { success: true, event };
}

async function getTopPosts() {
  // First get user
  var user: any = await hikerFetch('/users/by/username?username=' + IG_USERNAME);
  var userId = user.pk || user.id;

  // Get recent posts
  var postsRes: any = await hikerFetch('/users/' + userId + '/posts?count=20');
  var items = postsRes.items || postsRes.data || postsRes || [];

  // Calculate engagement and sort
  var enriched = items.map(function (p: any) {
    var likes = p.like_count || 0;
    var comments = p.comment_count || 0;
    return {
      code: p.code || '',
      caption: (p.caption && p.caption.text) || p.caption || '',
      likes,
      comments,
      engagementScore: likes + comments,
      mediaType: p.media_type || p.media_type_name || '',
      takenAt: p.taken_at || p.timestamp || '',
    };
  });

  enriched.sort(function (a: any, b: any) { return b.engagementScore - a.engagementScore; });
  return enriched.slice(0, 10);
}

async function getAudienceInsights() {
  var user: any = await hikerFetch('/users/by/username?username=' + IG_USERNAME);
  var userId = user.pk || user.id;

  var followersRes: any = await hikerFetch('/users/' + userId + '/followers?count=100');
  var followers = followersRes.items || followersRes.data || followersRes.users || followersRes || [];

  var totalFollowers = user.follower_count || followers.length;
  var sumFollowers = 0;
  var verifiedCount = 0;
  var privateCount = 0;
  var sampleFollowers: any[] = [];

  for (var i = 0; i < followers.length; i++) {
    var f = followers[i];
    sumFollowers += f.follower_count || 0;
    if (f.is_verified) verifiedCount++;
    if (f.is_private) privateCount++;
    sampleFollowers.push({
      username: f.username,
      fullName: f.full_name || '',
      followers: f.follower_count || 0,
      verified: !!f.is_verified,
      private: !!f.is_private,
      bio: (f.biography || '').slice(0, 100),
    });
  }

  return {
    totalFollowers,
    avgFollowerCount: followers.length > 0 ? Math.round(sumFollowers / followers.length) : 0,
    verifiedPercent: followers.length > 0 ? parseFloat((verifiedCount / followers.length * 100).toFixed(1)) : 0,
    privatePercent: followers.length > 0 ? parseFloat((privateCount / followers.length * 100).toFixed(1)) : 0,
    sampleFollowers,
  };
}

// ── main handler ───────────────────────────────────────────

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'get_stats') {
      var stats = await getStats();
      return NextResponse.json({ success: true, data: stats });
    }

    if (action === 'get_engagement_history') {
      var startDate = body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      var history = await getEngagementHistory(startDate);
      return NextResponse.json({ success: true, data: history });
    }

    if (action === 'track_event') {
      var platform = body.platform || 'instagram';
      var eventType = body.eventType || 'custom';
      var metricValue = body.metricValue || 0;
      var metadata = body.metadata || null;
      var result = await trackEvent(platform, eventType, metricValue, metadata);
      return NextResponse.json(result);
    }

    if (action === 'get_top_posts') {
      var topPosts = await getTopPosts();
      return NextResponse.json({ success: true, data: topPosts });
    }

    if (action === 'get_audience_insights') {
      var insights = await getAudienceInsights();
      return NextResponse.json({ success: true, data: insights });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
