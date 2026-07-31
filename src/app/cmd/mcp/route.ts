// ============================================================
//  Aura MCP API — Model Context Protocol Hub
//  Central de comando para todos os MCP servers
//  Nada e removido — so adicionado
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  MCP_SERVERS,
  callMCPTool,
  listMCPTools,
  checkMCPStatus,
  getAllMCPStatus,
  scrapeTikTokProfile,
  scrapeInstagramProfile,
  scrapeTikTokComments,
  scrapeInstagramComments,
  searchSocialProfiles,
  getTrendingContent,
  monitorBrandMentions,
  getMetaAdAccounts,
  getMetaCampaigns,
  getMetaCampaignInsights,
  getMetaPageInsights,
  socialyncCreatePost,
  socialyncGetScheduled,
  socialyncGetAnalytics,
  socialyncListAccounts,
} from '@/lib/mcp-engine';
import { arcadeListTools, arcadeExecuteTool, arcadeAuthorize, getArcadeStatus, arcadeSearchTools } from '@/lib/arcade-engine';
import {
  svTikTokProfile,
  svTikTokVideos,
  svTikTokVideoInfo,
  svTikTokTranscript,
  svTikTokComments,
  svTikTokTrending,
  svTikTokSearchUsers,
  svTikTokSearchKeyword,
  svTikTokSearchHashtag,
  svTikTokSearchMusic,
  svTikTokFollowers,
  svTikTokDemographics,
  svTikTokAdLibrarySearch,
  svRedditSearch,
  svRedditSubredditPosts,
  svInstagramProfile,
  svInstagramPosts,
  svInstagramReels,
  svInstagramComments,
  svYouTubeChannel,
  svYouTubeVideo,
  svYouTubeSearch,
  svYouTubeVideoTranscript,
  svYouTubeShortsTrending,
  svTwitterProfile,
  svTwitterSearch,
  svTwitterTweet,
  svFacebookProfile,
  svMetaAdLibrarySearch,
  svFacebookAdLibraryCompanyAds,
  svThreadsProfile,
  svCheckCredits,
  svHealthCheck,
  SOCIAVAULT_PLATFORMS,
} from '@/lib/sociavault-engine';

export var maxDuration = 60;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;

  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    // === LIST ALL SERVERS ===
    if (action === 'list_servers') {
      var servers = MCP_SERVERS.map(function(s) {
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          category: s.category,
          status: s.status,
          pricing: s.pricing,
          setupUrl: s.setupUrl,
          toolCount: s.tools.length,
          tools: s.tools.map(function(t) { return { name: t.name, description: t.description, category: t.category }; }),
        };
      });
      return NextResponse.json({ success: true, data: servers });
    }

    // === CHECK ALL SERVER STATUS ===
    if (action === 'check_all') {
      var status = await getAllMCPStatus();
      return NextResponse.json({ success: true, data: status });
    }

    // === CHECK ONE SERVER ===
    if (action === 'check_server') {
      if (!body.serverId) return NextResponse.json({ success: false, error: 'serverId necessario' });
      var s = await checkMCPStatus(body.serverId);
      return NextResponse.json({ success: true, data: s });
    }

    // === LIST TOOLS ===
    if (action === 'list_tools') {
      if (!body.serverId) return NextResponse.json({ success: false, error: 'serverId necessario' });
      var tools = await listMCPTools(body.serverId);
      return NextResponse.json(tools);
    }

    // === GENERIC TOOL CALL ===
    if (action === 'call_tool') {
      if (!body.serverId || !body.tool) return NextResponse.json({ success: false, error: 'serverId e tool necessarios' });
      var result = await callMCPTool(body.serverId, body.tool, body.params || {});
      return NextResponse.json(result);
    }

    // === HIGH-LEVEL: SCRAPE PROFILE ===
    if (action === 'scrape_profile') {
      if (!body.platform || !body.username) return NextResponse.json({ success: false, error: 'platform e username necessarios' });
      var scrapeResult;
      if (body.platform === 'tiktok') scrapeResult = await scrapeTikTokProfile(body.username);
      else if (body.platform === 'instagram') scrapeResult = await scrapeInstagramProfile(body.username);
      else scrapeResult = await callMCPTool('socialcrawl', 'scrape_profile', { platform: body.platform, username: body.username });
      return NextResponse.json(scrapeResult);
    }

    // === HIGH-LEVEL: SCRAPE COMMENTS ===
    if (action === 'scrape_comments') {
      if (!body.platform || !body.url) return NextResponse.json({ success: false, error: 'platform e url necessarios' });
      var commResult;
      if (body.platform === 'tiktok') commResult = await scrapeTikTokComments(body.url, body.limit);
      else if (body.platform === 'instagram') commResult = await scrapeInstagramComments(body.url, body.limit);
      else commResult = await callMCPTool('socialcrawl', 'scrape_comments', { platform: body.platform, url: body.url, limit: body.limit || 50 });
      return NextResponse.json(commResult);
    }

    // === HIGH-LEVEL: SEARCH PROFILES ===
    if (action === 'search_profiles') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessaria' });
      var searchResult = await searchSocialProfiles(body.query);
      return NextResponse.json(searchResult);
    }

    // === HIGH-LEVEL: TRENDING CONTENT ===
    if (action === 'get_trending') {
      var trendingResult = await getTrendingContent(body.platform);
      return NextResponse.json(trendingResult);
    }

    // === HIGH-LEVEL: BRAND MONITORING ===
    if (action === 'monitor_brand') {
      if (!body.brand) return NextResponse.json({ success: false, error: 'brand necessario' });
      var brandResult = await monitorBrandMentions(body.brand);
      return NextResponse.json(brandResult);
    }

    // === META ADS: GET AD ACCOUNTS ===
    if (action === 'meta_ad_accounts') {
      var accounts = await getMetaAdAccounts();
      return NextResponse.json(accounts);
    }

    // === META ADS: GET CAMPAIGNS ===
    if (action === 'meta_campaigns') {
      var campaigns = await getMetaCampaigns(body.adAccountId);
      return NextResponse.json(campaigns);
    }

    // === META ADS: GET CAMPAIGN INSIGHTS ===
    if (action === 'meta_campaign_insights') {
      if (!body.campaignId) return NextResponse.json({ success: false, error: 'campaignId necessario' });
      var insights = await getMetaCampaignInsights(body.campaignId, body.startDate, body.endDate);
      return NextResponse.json(insights);
    }

    // === META ADS: PAGE INSIGHTS ===
    if (action === 'meta_page_insights') {
      var pageInsights = await getMetaPageInsights(body.pageId);
      return NextResponse.json(pageInsights);
    }

    // === SOCIALYNC: CREATE POST ===
    if (action === 'socialync_post') {
      if (!body.platforms || !body.caption) return NextResponse.json({ success: false, error: 'platforms e caption necessarios' });
      var postResult = await socialyncCreatePost({
        platforms: body.platforms,
        caption: body.caption,
        mediaUrl: body.mediaUrl,
        scheduledAt: body.scheduledAt,
      });
      return NextResponse.json(postResult);
    }

    // === SOCIALYNC: LIST SCHEDULED ===
    if (action === 'socialync_scheduled') {
      var scheduled = await socialyncGetScheduled();
      return NextResponse.json(scheduled);
    }

    // === SOCIALYNC: ANALYTICS ===
    if (action === 'socialync_analytics') {
      var syncAnalytics = await socialyncGetAnalytics(body.postId);
      return NextResponse.json(syncAnalytics);
    }

    // === SOCIALYNC: LIST ACCOUNTS ===
    if (action === 'socialync_accounts') {
      var syncAccounts = await socialyncListAccounts();
      return NextResponse.json(syncAccounts);
    }

    // === ARCADE: STATUS ===
    if (action === 'arcade_status') {
      var arcadeStatus = await getArcadeStatus();
      return NextResponse.json({ success: true, data: arcadeStatus });
    }

    // === ARCADE: LIST TOOLS ===
    if (action === 'arcade_list_tools') {
      var arcadeTools = await arcadeListTools(body.limit);
      return NextResponse.json(arcadeTools);
    }

    // === ARCADE: EXECUTE TOOL ===
    if (action === 'arcade_execute') {
      if (!body.tool) return NextResponse.json({ success: false, error: 'tool necessario' });
      var arcadeResult = await arcadeExecuteTool(body.tool, body.params, body.userId);
      return NextResponse.json(arcadeResult);
    }

    // === ARCADE: AUTHORIZE (OAuth) ===
    if (action === 'arcade_authorize') {
      if (!body.tool) return NextResponse.json({ success: false, error: 'tool necessario' });
      var authRes = await arcadeAuthorize(body.tool, body.userId);
      return NextResponse.json(authRes);
    }

    // === ARCADE: SEARCH TOOLS ===
    if (action === 'arcade_search') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      var arcadeSearch = await arcadeSearchTools(body.query);
      return NextResponse.json(arcadeSearch);
    }

    // === PLAYWRIGHT: NAVIGATE ===
    if (action === 'browser_navigate') {
      if (!body.url) return NextResponse.json({ success: false, error: 'url necessaria' });
      var navResult = await callMCPTool('playwright', 'navigate', { url: body.url });
      return NextResponse.json(navResult);
    }

    // === PLAYWRIGHT: EXTRACT DATA ===
    if (action === 'browser_extract') {
      if (!body.url) return NextResponse.json({ success: false, error: 'url necessaria' });
      var extractResult = await callMCPTool('playwright', 'extract_data', { url: body.url, selector: body.selector });
      return NextResponse.json(extractResult);
    }

    // === SOCIAVAULT: STATUS ===
    if (action === 'sv_status') {
      var svHealth = await svHealthCheck();
      var svCredits = await svCheckCredits();
      return NextResponse.json({ success: true, data: { health: svHealth, credits: svCredits, platforms: SOCIAVAULT_PLATFORMS.length } });
    }

    // === SOCIAVAULT: TIKTOK PROFILE ===
    if (action === 'sv_tiktok_profile') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svTikTokProfile(body.username));
    }

    // === SOCIAVAULT: TIKTOK VIDEOS ===
    if (action === 'sv_tiktok_videos') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svTikTokVideos(body.username, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK VIDEO INFO ===
    if (action === 'sv_tiktok_video_info') {
      if (!body.videoId) return NextResponse.json({ success: false, error: 'videoId necessario' });
      return NextResponse.json(await svTikTokVideoInfo(body.videoId));
    }

    // === SOCIAVAULT: TIKTOK COMMENTS ===
    if (action === 'sv_tiktok_comments') {
      if (!body.videoId) return NextResponse.json({ success: false, error: 'videoId necessario' });
      return NextResponse.json(await svTikTokComments(body.videoId, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK TRANSCRIPT ===
    if (action === 'sv_tiktok_transcript') {
      if (!body.videoId) return NextResponse.json({ success: false, error: 'videoId necessario' });
      return NextResponse.json(await svTikTokTranscript(body.videoId));
    }

    // === SOCIAVAULT: TIKTOK TRENDING ===
    if (action === 'sv_tiktok_trending') {
      return NextResponse.json(await svTikTokTrending(body.cursor));
    }

    // === SOCIAVAULT: TIKTOK SEARCH USERS ===
    if (action === 'sv_tiktok_search_users') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svTikTokSearchUsers(body.query, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK SEARCH KEYWORD ===
    if (action === 'sv_tiktok_search') {
      if (!body.keyword) return NextResponse.json({ success: false, error: 'keyword necessario' });
      return NextResponse.json(await svTikTokSearchKeyword(body.keyword, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK SEARCH HASHTAG ===
    if (action === 'sv_tiktok_hashtag') {
      if (!body.hashtag) return NextResponse.json({ success: false, error: 'hashtag necessario' });
      return NextResponse.json(await svTikTokSearchHashtag(body.hashtag, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK MUSIC POPULAR ===
    if (action === 'sv_tiktok_music') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svTikTokSearchMusic(body.query, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK FOLLOWERS ===
    if (action === 'sv_tiktok_followers') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svTikTokFollowers(body.username, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK DEMOGRAPHICS ===
    if (action === 'sv_tiktok_demographics') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svTikTokDemographics(body.username));
    }

    // === SOCIAVAULT: TIKTOK AD LIBRARY ===
    if (action === 'sv_tiktok_ads') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svTikTokAdLibrarySearch(body.query, body.cursor));
    }

    // === SOCIAVAULT: TIKTOK SHOP (nao disponivel na API atual) ===
    if (action === 'sv_tiktok_shop') {
      return NextResponse.json({ success: false, error: 'TikTok Shop search nao esta disponivel na Sociavault API' });
    }

    // === SOCIAVAULT: INSTAGRAM PROFILE ===
    if (action === 'sv_ig_profile') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svInstagramProfile(body.username));
    }

    // === SOCIAVAULT: INSTAGRAM POSTS ===
    if (action === 'sv_ig_posts') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svInstagramPosts(body.username, body.cursor));
    }

    // === SOCIAVAULT: INSTAGRAM REELS ===
    if (action === 'sv_ig_reels') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svInstagramReels(body.username, body.cursor));
    }

    // === SOCIAVAULT: INSTAGRAM COMMENTS ===
    if (action === 'sv_ig_comments') {
      if (!body.postId) return NextResponse.json({ success: false, error: 'postId necessario' });
      return NextResponse.json(await svInstagramComments(body.postId, body.cursor));
    }

    // === SOCIAVAULT: YOUTUBE ===
    if (action === 'sv_yt_channel') {
      if (!body.channelId) return NextResponse.json({ success: false, error: 'channelId necessario' });
      return NextResponse.json(await svYouTubeChannel(body.channelId));
    }
    if (action === 'sv_yt_video') {
      if (!body.videoId) return NextResponse.json({ success: false, error: 'videoId necessario' });
      return NextResponse.json(await svYouTubeVideo(body.videoId));
    }
    if (action === 'sv_yt_search') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svYouTubeSearch(body.query, body.cursor));
    }
    if (action === 'sv_yt_transcript') {
      if (!body.videoId) return NextResponse.json({ success: false, error: 'videoId necessario' });
      return NextResponse.json(await svYouTubeVideoTranscript(body.videoId));
    }
    if (action === 'sv_yt_shorts_trending') {
      return NextResponse.json(await svYouTubeShortsTrending(body.cursor));
    }

    // === SOCIAVAULT: TWITTER ===
    if (action === 'sv_tw_profile') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svTwitterProfile(body.username));
    }
    if (action === 'sv_tw_search') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svTwitterSearch(body.query, body.cursor));
    }
    if (action === 'sv_tw_comments') {
      if (!body.tweetId) return NextResponse.json({ success: false, error: 'tweetId necessario' });
      var tweetData = await svTwitterTweet(body.tweetId);
      return NextResponse.json(tweetData);
    }

    // === SOCIAVAULT: FACEBOOK ===
    if (action === 'sv_fb_profile') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svFacebookProfile(body.username));
    }
    if (action === 'sv_fb_ad_library') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svMetaAdLibrarySearch(body.query, body.country, body.cursor));
    }

    // === SOCIAVAULT: REDDIT ===
    if (action === 'sv_reddit_search') {
      if (!body.query) return NextResponse.json({ success: false, error: 'query necessario' });
      return NextResponse.json(await svRedditSearch(body.query, body.cursor));
    }
    if (action === 'sv_reddit_subreddit') {
      if (!body.subreddit) return NextResponse.json({ success: false, error: 'subreddit necessario' });
      return NextResponse.json(await svRedditSubredditPosts(body.subreddit, body.cursor));
    }

    // === SOCIAVAULT: THREADS ===
    if (action === 'sv_threads_profile') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      return NextResponse.json(await svThreadsProfile(body.username));
    }

    // === SOCIAVAULT: PLATFORMS LIST ===
    if (action === 'sv_platforms') {
      return NextResponse.json({ success: true, data: SOCIAVAULT_PLATFORMS });
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
