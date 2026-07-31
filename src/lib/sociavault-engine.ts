// ============================================================
//  JARVIS SOCIAVAULT ENGINE — Sociavault REST API v1/scrape/
//  Base URL: https://api.sociavault.com
//  Auth: X-API-Key header (nao query param)
//  Free plan: 50 credits (1 credit por request)
//
//  Plataformas: TikTok, Instagram, YouTube, Twitter/X, LinkedIn,
//  Facebook, Reddit, Threads, Pinterest, Twitch, Google
//  + TikTok Shop, Ad Libraries (TikTok, Meta, Google, LinkedIn)
// ============================================================

import { SOCIAVAULT_KEY } from './config';

var BASE_URL = 'https://api.sociavault.com';

// === HELPER: Chamada REST API com X-API-Key header ===

async function svAPI(endpoint: string, params: Record<string, any> = {}): Promise<{ success: boolean; data?: any; error?: string; credits_charged?: number }> {
  if (!SOCIAVAULT_KEY) {
    return { success: false, error: 'SOCIAVAULT_API_KEY nao configurada' };
  }

  try {
    var url = BASE_URL + endpoint;
    var queryParams = new URLSearchParams();
    for (var k in params) {
      if (params[k] !== undefined && params[k] !== null) {
        queryParams.set(k, String(params[k]));
      }
    }
    var qs = queryParams.toString();
    var fullUrl = qs ? url + '?' + qs : url;

    var res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': SOCIAVAULT_KEY,
      },
    });

    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: 'SociaVault HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }

    var data = await res.json();
    return {
      success: !!data.success,
      data: data.data || data,
      credits_charged: data.credits_charged,
    };
  } catch (e: any) {
    return { success: false, error: 'SociaVault: ' + e.message };
  }
}

// === TIKTOK ===

export async function svTikTokProfile(handle: string) {
  return svAPI('/v1/scrape/tiktok/profile', { handle });
}

export async function svTikTokDemographics(handle: string) {
  return svAPI('/v1/scrape/tiktok/demographics', { handle });
}

export async function svTikTokVideos(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/videos', { handle, cursor });
}

export async function svTikTokVideoInfo(videoId: string) {
  return svAPI('/v1/scrape/tiktok/video', { video_id: videoId });
}

export async function svTikTokTranscript(videoId: string) {
  return svAPI('/v1/scrape/tiktok/transcript', { video_id: videoId });
}

export async function svTikTokLive(handle: string) {
  return svAPI('/v1/scrape/tiktok/live', { handle });
}

export async function svTikTokComments(videoId: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/comments', { video_id: videoId, cursor });
}

export async function svTikTokCommentReplies(videoId: string, commentId: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/comment', { video_id: videoId, comment_id: commentId, cursor });
}

export async function svTikTokFollowing(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/following', { handle, cursor });
}

export async function svTikTokFollowers(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/followers', { handle, cursor });
}

export async function svTikTokSearchUsers(query: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/search/users', { query, cursor });
}

export async function svTikTokSearchHashtag(hashtag: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/search/hashtag', { query: hashtag, cursor });
}

export async function svTikTokSearchKeyword(query: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/search/keyword', { query, cursor });
}

export async function svTikTokSearchMusic(query: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/search/music', { song_id: query, cursor });
}

export async function svTikTokSearchTop(cursor?: string) {
  return svAPI('/v1/scrape/tiktok/search/top', { cursor });
}

export async function svTikTokMusicDetails(musicId: string) {
  return svAPI('/v1/scrape/tiktok/music/details', { music_id: musicId });
}

export async function svTikTokMusicVideos(musicId: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/music/videos', { music_id: musicId, cursor });
}

export async function svTikTokTrending(region?: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/trending', { region: region || 'US', cursor });
}

// === INSTAGRAM ===

export async function svInstagramProfile(handle: string) {
  return svAPI('/v1/scrape/instagram/profile', { handle });
}

export async function svInstagramBasicProfile(userId: string) {
  return svAPI('/v1/scrape/instagram/basic', { user_id: userId });
}

export async function svInstagramPosts(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/instagram/posts', { handle, cursor });
}

export async function svInstagramPostInfo(url: string) {
  return svAPI('/v1/scrape/instagram/post', { url });
}

export async function svInstagramTranscript(url: string) {
  return svAPI('/v1/scrape/instagram/transcript', { url });
}

export async function svInstagramComments(url: string, cursor?: string) {
  return svAPI('/v1/scrape/instagram/comments', { url, cursor });
}

export async function svInstagramCommentReplies(url: string, commentId: string, cursor?: string) {
  return svAPI('/v1/scrape/instagram/comment/replies', { url, comment_id: commentId, cursor });
}

export async function svInstagramReels(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/instagram/reels', { handle, cursor });
}

export async function svInstagramHighlights(handle: string) {
  return svAPI('/v1/scrape/instagram/highlights', { handle });
}

export async function svInstagramHighlightDetail(highlightId: string) {
  return svAPI('/v1/scrape/instagram/highlight', { highlight_id: highlightId });
}

export async function svInstagramReelsBySong(musicId: string, cursor?: string) {
  return svAPI('/v1/scrape/instagram/reels', { music_id: musicId, cursor });
}

export async function svInstagramSearchHashtag(hashtag: string, cursor?: string) {
  return svAPI('/v1/scrape/instagram/search/hashtag', { hashtag, cursor });
}

// === YOUTUBE ===

export async function svYouTubeChannel(channelId: string) {
  return svAPI('/v1/scrape/youtube/channel', { channel_id: channelId });
}

export async function svYouTubeChannelVideos(channelId: string, cursor?: string) {
  return svAPI('/v1/scrape/youtube/channel/playlists', { channel_id: channelId, cursor });
}

export async function svYouTubeChannelShorts(channelId: string, cursor?: string) {
  return svAPI('/v1/scrape/youtube/channel/shorts', { channel_id: channelId, cursor });
}

export async function svYouTubeChannelLives(channelId: string) {
  return svAPI('/v1/scrape/youtube/channel/lives', { channel_id: channelId });
}

export async function svYouTubeChannelCommunity(channelId: string) {
  return svAPI('/v1/scrape/youtube/channel/community', { channel_id: channelId });
}

export async function svYouTubeVideo(videoId: string) {
  return svAPI('/v1/scrape/youtube/video', { video_id: videoId });
}

export async function svYouTubeVideoTranscript(videoId: string) {
  return svAPI('/v1/scrape/youtube/video/transcript', { video_id: videoId });
}

export async function svYouTubeSearch(query: string, cursor?: string) {
  return svAPI('/v1/scrape/youtube/search', { query, cursor });
}

export async function svYouTubeSearchHashtag(hashtag: string, cursor?: string) {
  return svAPI('/v1/scrape/youtube/search/hashtag', { hashtag, cursor });
}

export async function svYouTubeVideoComments(videoId: string, cursor?: string) {
  return svAPI('/v1/scrape/youtube/video/comments', { video_id: videoId, cursor });
}

export async function svYouTubeVideoComment(videoId: string, cursor?: string) {
  return svAPI('/v1/scrape/youtube/video/comment', { video_id: videoId, cursor });
}

export async function svYouTubeShortsTrending(cursor?: string) {
  return svAPI('/v1/scrape/youtube/shorts/trending', { cursor });
}

// === TWITTER / X ===

export async function svTwitterProfile(handle: string) {
  return svAPI('/v1/scrape/twitter/profile', { handle });
}

export async function svTwitterUserTweets(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/twitter/user', { handle, cursor });
}

export async function svTwitterTweet(tweetId: string) {
  return svAPI('/v1/scrape/twitter/tweet', { tweet_id: tweetId });
}

export async function svTwitterTweetTranscript(tweetId: string) {
  return svAPI('/v1/scrape/twitter/tweet/transcript', { tweet_id: tweetId });
}

export async function svTwitterSearch(query: string, cursor?: string) {
  return svAPI('/v1/scrape/twitter/search', { query, cursor });
}

export async function svTwitterCommunity(username: string) {
  return svAPI('/v1/scrape/twitter/community', { username });
}

export async function svTwitterCommunityTweets(communityId: string, cursor?: string) {
  return svAPI('/v1/scrape/twitter/community/tweets', { community_id: communityId, cursor });
}

// === FACEBOOK ===

export async function svFacebookProfile(url: string) {
  return svAPI('/v1/scrape/facebook/profile', { url });
}

export async function svFacebookProfilePosts(pageId: string) {
  return svAPI('/v1/scrape/facebook/profile/posts', { pageId });
}

export async function svFacebookProfileReels(pageId: string, cursor?: string) {
  return svAPI('/v1/scrape/facebook/profile/reels', { pageId, cursor });
}

export async function svFacebookPost(url: string) {
  return svAPI('/v1/scrape/facebook/post', { url });
}

export async function svFacebookPostTranscript(url: string) {
  return svAPI('/v1/scrape/facebook/post/transcript', { url });
}

export async function svFacebookPostComments(url: string, cursor?: string) {
  return svAPI('/v1/scrape/facebook/post/comments', { url, cursor });
}

export async function svFacebookCommentReplies(url: string, feedbackId: string, expansionToken: string, cursor?: string) {
  return svAPI('/v1/scrape/facebook/comment/replies', { url, feedback_id: feedbackId, expansion_token: expansionToken, cursor });
}

export async function svFacebookGroupPosts(groupId: string) {
  return svAPI('/v1/scrape/facebook/group/posts', { group_id: groupId });
}

// === META AD LIBRARY ===

export async function svMetaAdLibrarySearch(query: string, country?: string, cursor?: string) {
  return svAPI('/v1/scrape/facebook/ad_library/search', { query, country: country || 'AO', cursor });
}

export async function svMetaAdLibraryAd(adId: string) {
  return svAPI('/v1/scrape/facebook/ad_library/search', { ad_id: adId });
}

export async function svMetaAdLibraryAdTranscript(adId: string) {
  return svAPI('/v1/scrape/facebook/ad_library/search', { ad_id: adId });
}

export async function svMetaAdLibraryCompanyAds(pageId: string) {
  return svAPI('/v1/scrape/facebook/ad_library/search', { page_id: pageId });
}

// === REDDIT ===

export async function svRedditSubredditDetails(subreddit: string) {
  return svAPI('/v1/scrape/reddit/subreddit/details', { subreddit });
}

export async function svRedditSubredditPosts(subreddit: string, cursor?: string) {
  return svAPI('/v1/scrape/reddit/subreddit', { subreddit, cursor });
}

export async function svRedditSubredditSearch(subreddit: string, query: string, cursor?: string) {
  return svAPI('/v1/scrape/reddit/subreddit/search', { subreddit, query, cursor });
}

export async function svRedditPostComments(postId: string, cursor?: string) {
  return svAPI('/v1/scrape/reddit/post/comments', { post_id: postId, cursor });
}

export async function svRedditPostTranscript(url: string) {
  return svAPI('/v1/scrape/reddit/post/transcript', { url });
}

export async function svRedditSearch(query: string, cursor?: string) {
  return svAPI('/v1/scrape/reddit/search', { query, cursor });
}

// === THREADS ===

export async function svThreadsProfile(handle: string) {
  return svAPI('/v1/scrape/threads/profile', { handle });
}

export async function svThreadsPosts(username: string, cursor?: string) {
  return svAPI('/v1/scrape/threads/post', { username, cursor });
}

export async function svThreadsSearch(query: string, cursor?: string) {
  return svAPI('/v1/scrape/threads/search', { q: query, cursor });
}

export async function svThreadsSearchUsers(query: string) {
  return svAPI('/v1/scrape/threads/user', { query });
}

// === LINKEDIN ===

export async function svLinkedInProfile(url: string) {
  return svAPI('/v1/scrape/linkedin/profile', { url });
}

export async function svLinkedInCompany(companyId: string) {
  return svAPI('/v1/scrape/linkedin/company', { company_id: companyId });
}

export async function svLinkedInPost(url: string) {
  return svAPI('/v1/scrape/linkedin/post', { url });
}

export async function svLinkedInPostTranscript(url: string) {
  return svAPI('/v1/scrape/linkedin/post/transcript', { url });
}

// === PINTEREST ===

export async function svPinterestSearch(query: string, cursor?: string) {
  return svAPI('/v1/scrape/pinterest/search', { query, cursor });
}

export async function svPinterestPin(pinId: string) {
  return svAPI('/v1/scrape/pinterest/pin', { pin_id: pinId });
}

export async function svPinterestUserBoards(username: string) {
  return svAPI('/v1/scrape/pinterest/user/boards', { username });
}

export async function svPinterestBoard(boardId: string) {
  return svAPI('/v1/scrape/pinterest/board', { board_id: boardId });
}

// === TWITCH ===

export async function svTwitchProfile(handle: string) {
  return svAPI('/v1/scrape/twitch/profile', { handle });
}

export async function svTwitchUserVideos(handle: string, cursor?: string) {
  return svAPI('/v1/scrape/twitch/user/videos', { handle, cursor });
}

export async function svTwitchUserSchedule(handle: string) {
  return svAPI('/v1/scrape/twitch/user/schedule', { handle });
}

export async function svTwitchClip(clipId: string) {
  return svAPI('/v1/scrape/twitch/clip', { clip_id: clipId });
}

// === GOOGLE ===

export async function svGoogleSearch(query: string) {
  return svAPI('/v1/scrape/google/search', { query });
}

// === TIKTOK AD LIBRARY ===

export async function svTikTokAdLibrarySearch(query: string, cursor?: string) {
  return svAPI('/v1/scrape/tiktok/ad_library/search', { query, cursor });
}

// === FACEBOOK AD LIBRARY (usado via svMetaAdLibrarySearch acima) ===

export async function svFacebookAdLibraryCompanyAds(pageId: string) {
  return svAPI('/v1/scrape/facebook/ad_library/search', { page_id: pageId });
}

// === STATUS CHECKS ===

export async function svCheckCredits(): Promise<{ configured: boolean; credits?: number; subscription?: string; error?: string }> {
  if (!SOCIAVAULT_KEY) {
    return { configured: false, error: 'API key nao configurada' };
  }
  try {
    var res = await fetch(BASE_URL + '/v1/credits', {
      headers: { 'X-API-Key': SOCIAVAULT_KEY, 'Accept': 'application/json' },
    });
    if (!res.ok) return { configured: true, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { configured: true, credits: data.credits, subscription: data.subscriptionStatus };
  } catch (e: any) {
    return { configured: true, error: e.message };
  }
}

export async function svHealthCheck(): Promise<{ configured: boolean; healthy: boolean; latency?: number; credits?: number; error?: string }> {
  if (!SOCIAVAULT_KEY) {
    return { configured: false, healthy: false, error: 'API key nao configurada' };
  }
  var start = Date.now();
  var result = await svTikTokTrending();
  var latency = Date.now() - start;
  // Also check credits
  var creditInfo = await svCheckCredits();
  return {
    configured: true,
    healthy: result.success,
    latency,
    credits: creditInfo.credits,
    error: result.success ? undefined : result.error,
  };
}

// === PLATFORM LIST PARA UI ===

export var SOCIAVAULT_PLATFORMS = [
  {
    slug: 'tiktok', name: 'TikTok', icon: '🎵', tools: 20,
    endpoints: ['profile', 'videos', 'video_info', 'comments', 'trending', 'search_users', 'search_hashtag', 'search_keyword', 'search_music', 'search_top', 'music_details', 'music_videos', 'live', 'transcript', 'followers', 'following', 'demographics', 'comment_replies'],
  },
  {
    slug: 'instagram', name: 'Instagram', icon: '📸', tools: 12,
    endpoints: ['profile', 'basic_profile', 'posts', 'post_info', 'comments', 'comment_replies', 'reels', 'highlights', 'highlight_detail', 'transcript', 'search_hashtag', 'reels_by_song'],
  },
  {
    slug: 'youtube', name: 'YouTube', icon: '▶️', tools: 12,
    endpoints: ['channel', 'channel_videos', 'channel_shorts', 'channel_lives', 'channel_community', 'video', 'video_transcript', 'search', 'search_hashtag', 'video_comments', 'video_comment', 'shorts_trending'],
  },
  {
    slug: 'twitter', name: 'X (Twitter)', icon: '𝕏', tools: 7,
    endpoints: ['profile', 'user_tweets', 'tweet', 'tweet_transcript', 'search', 'community', 'community_tweets'],
  },
  {
    slug: 'facebook', name: 'Facebook', icon: '📘', tools: 9,
    endpoints: ['profile', 'profile_posts', 'profile_reels', 'post', 'post_transcript', 'post_comments', 'comment_replies', 'group_posts'],
  },
  {
    slug: 'meta_ads', name: 'Meta Ad Library', icon: '📢', tools: 4,
    endpoints: ['search', 'ad', 'ad_transcript', 'company_ads'],
  },
  {
    slug: 'reddit', name: 'Reddit', icon: '🟠', tools: 6,
    endpoints: ['search', 'subreddit_details', 'subreddit_posts', 'subreddit_search', 'post_comments', 'post_transcript'],
  },
  {
    slug: 'threads', name: 'Threads', icon: '🧵', tools: 4,
    endpoints: ['profile', 'posts', 'search', 'search_users'],
  },
  {
    slug: 'linkedin', name: 'LinkedIn', icon: '💼', tools: 4,
    endpoints: ['profile', 'company', 'post', 'post_transcript'],
  },
  {
    slug: 'pinterest', name: 'Pinterest', icon: '📌', tools: 4,
    endpoints: ['search', 'pin', 'user_boards', 'board'],
  },
  {
    slug: 'twitch', name: 'Twitch', icon: '🟣', tools: 4,
    endpoints: ['profile', 'user_videos', 'user_schedule', 'clip'],
  },
  {
    slug: 'google', name: 'Google', icon: '🔍', tools: 1,
    endpoints: ['search'],
  },
];
