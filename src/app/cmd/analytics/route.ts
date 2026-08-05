// ============================================================
//  Aura ANALYTICS API — dados reais via Zernio + UploadPost + FB Graph
// ============================================================

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { UPLOADPOST_KEY, IG_USERNAME } from '@/lib/config';
import { requireAuth } from '@/lib/auth';
import { zernioGetAnalytics, zernioListAccounts, zernioGetAudience } from '@/lib/zernio';
import { fbGetInsights, fbGetPosts } from '@/lib/fb-publish';
import { igGetUserStats } from '@/lib/ig-publish';
import { sbGetIGProfile } from '@/lib/external-apis';

export var maxDuration = 60;

async function uploadPostFetch(path: string) {
  var res = await fetch('https://api.upload-post.com/api' + path, {
    headers: { Authorization: 'Apikey ' + UPLOADPOST_KEY },
  });
  if (!res.ok) throw new Error('UploadPost erro ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

async function getStats() {
  // 1. Zernio analytics
   var zernioData: any = null;
  try {
    var accountsRes = await zernioListAccounts();
    if (accountsRes.success && accountsRes.data) {
      var accounts = Array.isArray(accountsRes.data) ? accountsRes.data : (accountsRes.data.accounts || []);
      var igAccount = accounts.find(function(a: any) { return a.platform === 'instagram'; });
      if (igAccount) {
        var analyticsRes = await zernioGetAnalytics({ accountId: igAccount._id });
        if (analyticsRes.success) zernioData = analyticsRes.data;
      }
    }
  } catch (e: any) { console.error('Zernio analytics:', e.message); }

  // 2. instagrapi direct stats
   var igStats: any = null;
  try { igStats = await igGetUserStats(); } catch(e: any) { console.error('IG stats:', e.message); }

  // 3. FB Graph insights
   var fbInsights: any = null;
  try { fbInsights = await fbGetInsights(); } catch(e: any) { console.error('FB insights:', e.message); }

  // 4. FB Posts
   var fbPosts: any[] = [];
  try { var fbRes = await fbGetPosts(10); if (fbRes.success) fbPosts = fbRes.posts; } catch(e: any) {}

  // 5. UploadPost history
   var upProfiles: any = null;
  var upHistory: any = null;
  try { upProfiles = await uploadPostFetch('/uploadposts/users'); } catch (e: any) {}
  try { upHistory = await uploadPostFetch('/uploadposts/history'); } catch (e: any) {}

  // Parse data
   var igFollowers = igStats?.followers || zernioData?.followers_count || zernioData?.followerCount || 0;
   var igFollowing = igStats?.following || zernioData?.following_count || zernioData?.followingCount || 0;
  var igPosts = igStats?.posts || zernioData?.posts_count || zernioData?.mediaCount || 0;

  // FB page data
  var fbPageLikes = 0;
  var fbPageReach = 0;
  if (fbInsights?.success && fbInsights.data) {
    for (var i = 0; i < fbInsights.data.length; i++) {
      var m = fbInsights.data[i];
      if (m.name === 'page_fans') fbPageLikes = m.values?.[0]?.value || 0;
      if (m.name === 'page_impressions_unique') fbPageReach = m.values?.[0]?.value || 0;
    }
  }

  // Engagement rate
   var engagementRate = 0;
  var recentPosts: any[] = [];
  if (upHistory && Array.isArray(upHistory)) {
    recentPosts = upHistory.slice(0, 10).map(function(h: any) {
      return { id: h.id, platform: h.platform || h.social_network || '', status: h.status || '', caption: h.caption_text || h.text || '', createdAt: h.created_at || h.posted_at || '', likes: h.like_count || 0, comments: h.comment_count || 0 };
    });
    var totalLikes = recentPosts.reduce(function(s: number, p: any) { return s + (p.likes || 0); }, 0);
    var totalComments = recentPosts.reduce(function(s: number, p: any) { return s + (p.comments || 0); }, 0);
    var totalFollowers = igFollowers + fbPageLikes;
    if (totalFollowers > 0 && recentPosts.length > 0) engagementRate = parseFloat(((totalLikes + totalComments) / (totalFollowers * recentPosts.length) * 100).toFixed(2));
  }

  // DM stats from automation logs
  var dmSent = 0;
  var dmReceived = 0;
  var coldDmSent = 0;
  try {
    var weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    var logs = await db.automationLog.findMany({ where: { triggeredAt: { gte: weekAgo } } });
    for (var j = 0; j < logs.length; j++) {
      if (logs[j].type === 'auto_reply') dmSent++;
      if (logs[j].type === 'cold_dm' && logs[j].status === 'completed') coldDmSent++;
    }
  } catch(e) {}

  // Store analytics event
   try {
    var oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    var existing = await db.analyticsEvent.findFirst({ where: { platform: 'instagram', eventType: 'followers', recordedAt: { gte: oneHourAgo } } });
    if (!existing) {
      await db.analyticsEvent.create({ data: { platform: 'instagram', eventType: 'followers', metricValue: igFollowers, metadata: JSON.stringify({ username: IG_USERNAME, following: igFollowing, posts: igPosts, engagementRate, source: 'combined' }) } });
    }
  } catch (e: any) { console.error('AnalyticsEvent:', e.message); }

  var platforms: any = {
    ig: { username: IG_USERNAME, followers: igFollowers, following: igFollowing, posts: igPosts, source: igStats ? 'instagrapi' : zernioData ? 'zernio' : 'none' },
    fb: { likes: fbPageLikes, reach: fbPageReach, posts: fbPosts.length, source: fbInsights ? 'graph_api' : 'none' },
  };

  // CRM stats
  var crmStats: any = { total: 0, contacted: 0 };
  try {
    var prospectCount = await db.prospect.count();
    var contactedCount = await db.prospect.count({ where: { lastContactedAt: { not: null } } });
    crmStats = { total: prospectCount, contacted: contactedCount };
  } catch(e) {}

  return {
    followers: igFollowers + fbPageLikes,
    igFollowers,
    fbPageLikes,
    following: igFollowing,
    posts: igPosts + fbPosts.length,
    engagementRate,
    platforms,
    recentPosts,
    fbPosts,
    dmStats: { autoReplied: dmSent, coldDmSent: coldDmSent },
    crmStats,
    source: 'combined',
  };
}

async function getEngagementHistory(startDate: string) {
  var start = new Date(startDate);
  var events = await db.analyticsEvent.findMany({ where: { recordedAt: { gte: start } }, orderBy: { recordedAt: 'asc' } });
  var grouped: Record<string, any> = {};
  for (var i = 0; i < events.length; i++) {
    var ev = events[i]; var dateKey = ev.recordedAt.toISOString().slice(0, 10); var key = dateKey + '|' + ev.eventType;
    if (!grouped[key]) grouped[key] = { date: dateKey, eventType: ev.eventType, metricValue: 0, count: 0 };
    grouped[key].metricValue += ev.metricValue; grouped[key].count += 1;
  }
  return Object.values(grouped);
}

async function trackEvent(platform: string, eventType: string, metricValue: number, metadata: any) {
  var event = await db.analyticsEvent.create({ data: { platform, eventType, metricValue, metadata: metadata ? JSON.stringify(metadata) : null } });
  return { success: true, event };
}

async function getTopPosts() {
  // Try IG stats + FB posts
  var topPosts: any[] = [];
  try {
    var fbRes = await fbGetPosts(10);
    if (fbRes.success) {
      topPosts = fbRes.posts.map(function(p: any) { return { ...p, platform: 'facebook' }; });
    }
  } catch(e: any) {}
  try {
    var accountsRes = await zernioListAccounts();
    if (accountsRes.success) {
      var accounts = Array.isArray(accountsRes.data) ? accountsRes.data : (accountsRes.data.accounts || []);
      var igAccount = accounts.find(function(a: any) { return a.platform === 'instagram'; });
      if (igAccount) {
        var analyticsRes = await zernioGetAnalytics({ accountId: igAccount._id });
        if (analyticsRes.success && analyticsRes.data?.topPosts) {
          topPosts = topPosts.concat(analyticsRes.data.topPosts.map(function(p: any) { return { ...p, platform: 'instagram' }; }));
        }
      }
    }
  } catch (e: any) { console.error('getTopPosts:', e.message); }
  return topPosts;
}

async function getAudienceInsights() {
  try {
    var accountsRes = await zernioListAccounts();
    if (!accountsRes.success) return { totalFollowers: 0, sampleFollowers: [] };
    var accounts = Array.isArray(accountsRes.data) ? accountsRes.data : (accountsRes.data.accounts || []);
    var igAccount = accounts.find(function(a: any) { return a.platform === 'instagram'; });
    if (!igAccount) return { totalFollowers: 0, sampleFollowers: [] };
    var audienceRes = await zernioGetAudience(igAccount._id, { type: 'followers', limit: 100 });
    if (audienceRes.success) return audienceRes.data;
  } catch (e: any) { console.error('getAudienceInsights:', e.message); }
  return { totalFollowers: 0, sampleFollowers: [] };
}

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  try {
    var body = await request.json().catch(function() { return {}; });
    var action = body.action || '';

    if (action === 'get_stats') return NextResponse.json({ success: true, data: await getStats() });
    if (action === 'get_engagement_history') {
      var startDate = body.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return NextResponse.json({ success: true, data: await getEngagementHistory(startDate) });
    }
    if (action === 'track_event') {
      var result = await trackEvent(body.platform || 'instagram', body.eventType || 'custom', body.metricValue || 0, body.metadata || null);
      return NextResponse.json(result);
    }
    if (action === 'get_top_posts') return NextResponse.json({ success: true, data: await getTopPosts() });
    if (action === 'get_audience_insights') return NextResponse.json({ success: true, data: await getAudienceInsights() });

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
