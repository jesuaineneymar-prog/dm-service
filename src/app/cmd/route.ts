// ============================================================
//  JARVIS COMMAND API — executes real platform actions
// ============================================================

import { NextResponse } from 'next/server';
import {
  igLogin, igSendDM, igGetUserId, igGetRecentPosts, igGetComments,
  igReplyComment, igGetInbox, igUploadPost,
  fbLogin, fbSendDM, fbGetUserId,
  ttLogin, ttSendDM, ttGetUserId,
  generateAIReply, generateDM, parseCommand,
  hikerGetUser, hikerGetFollowers, hikerGetMedias, hikerGetComments as hikerGetCommentsFn,
  hikerGetLikers, hikerGetStories, hikerSearchUsers, hikerGetBalance,
  hikerGetHighlights, hikerGetClips,
  upPublishText, upPublishPhotos, upPublishVideo, upGetHistory,
  upGetStatus, upGetSchedule, upGetMedia, upGetComments as upGetCommentsFn,
  upReplyComment, upSendDM, upGetDMConversations, upListProfiles,
  upGetAnalytics, upGetQueueSettings,
  upGenerateConnectURL, upGetProfile, upGetAccountInfo,
  upGetFacebookPages, upCancelScheduled, upUpdateScheduled,
  upGetQueuePreview, upRetryPost, upUnpublishPost, upPublishFromURL
} from '@/lib/platform-engine';

import { IG_USERNAME } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 300;

// Global session store (in-memory per serverless instance)
var sessions: any = {
  ig: null, fb: null, tt: null,
};

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';
  var platform = body.platform || '';
  var message = body.message || '';
  var mediaData = body.mediaData || null; // base64 image
  var mediaType = body.mediaType || 'image/jpeg';
  var credentials = body.credentials || {}; // { ig, fb, tt } session data from localStorage
  var prospects = body.prospects || [];

  // Restore sessions from client-stored credentials
  if (credentials.ig) sessions.ig = credentials.ig;
  if (credentials.fb) sessions.fb = credentials.fb;
  if (credentials.tt) sessions.tt = credentials.tt;

  // ===== LOGIN =====
  if (action === 'login') {
    var results: any = {};
    var errors: string[] = [];

    if (platform === 'instagram' || platform === 'all') {
      var igRes = await igLogin();
      results.ig = igRes;
      if (igRes.success && igRes.sessionid) {
        sessions.ig = { sessionid: igRes.sessionid, csrftoken: igRes.csrftoken, userId: igRes.userId };
      } else if (igRes.error) errors.push('IG: ' + igRes.error);
    }

    if (platform === 'facebook' || platform === 'all') {
      var fbRes = await fbLogin();
      results.fb = fbRes;
      if (fbRes.success) {
        sessions.fb = { cookies: fbRes.cookies, dtsg: fbRes.dtsg };
      } else if (fbRes.error) errors.push('FB: ' + fbRes.error);
    }

    if (platform === 'tiktok' || platform === 'all') {
      var ttRes = await ttLogin();
      results.tt = ttRes;
      if (ttRes.success) {
        sessions.tt = { sessionid: ttRes.sessionid, csrf: ttRes.csrf };
      } else if (ttRes.error) errors.push('TT: ' + ttRes.error);
    }

    return NextResponse.json({
      success: errors.length < (platform === 'all' ? 3 : 1),
      results,
      errors,
      sessions,
    });
  }

  // ===== SEND DM TO PROSPECTS =====
  if (action === 'send_dms') {
    var targetPlatform = platform === 'all' ? null : platform;
    var sentResults: any[] = [];
    var totalSent = 0;
    var totalFailed = 0;

    for (var i = 0; i < prospects.length; i++) {
      var p = prospects[i];
      if (p.status === 'sent') continue;
      if (targetPlatform && p.platform !== targetPlatform) continue;

      // Generate personalized DM
      var dmText = await generateDM(p.username || p.name, p.platform || 'instagram', message);

      var result: any = { username: p.username, platform: p.platform };

      try {
        if (p.platform === 'instagram' && sessions.ig) {
          var igId = await igGetUserId(sessions.ig.sessionid, sessions.ig.csrftoken, p.username);
          if (igId) {
            var dmRes = await igSendDM(sessions.ig.sessionid, sessions.ig.csrftoken, String(igId), dmText);
            result.success = dmRes.success;
            result.error = dmRes.error;
          } else {
            result.success = false; result.error = 'Nao encontrou @' + p.username;
          }
        } else if (p.platform === 'facebook' && sessions.fb) {
          var fbId = await fbGetUserId(sessions.fb.cookies, p.username);
          if (fbId) {
            var dmResFb = await fbSendDM(sessions.fb.cookies, sessions.fb.dtsg, fbId, dmText);
            result.success = dmResFb.success;
            result.error = dmResFb.error;
          } else {
            result.success = false; result.error = 'Nao encontrou ' + p.username;
          }
        } else if (p.platform === 'tiktok' && sessions.tt) {
          var ttId = await ttGetUserId(sessions.tt.sessionid, sessions.tt.csrf, p.username);
          if (ttId) {
            var dmResTt = await ttSendDM(sessions.tt.sessionid, sessions.tt.csrf, String(ttId), dmText);
            result.success = dmResTt.success;
            result.error = dmResTt.error;
          } else {
            result.success = false; result.error = 'Nao encontrou @' + p.username;
          }
        } else {
          result.success = false; result.error = 'Sem sessao activa para ' + p.platform;
        }

        if (result.success) totalSent++; else totalFailed++;
      } catch (e: any) {
        result.success = false; result.error = e.message; totalFailed++;
      }

      sentResults.push(result);

      // Rate limit: 5-7 min between DMs (human pacing to avoid bans)
      if (i < prospects.length - 1) {
        var delay = Math.floor(Math.random() * 120) + 300; // 300-420s = 5-7 min
        // Report progress before waiting
        sentResults[sentResults.length - 1].nextWait = delay + 's';
        await new Promise(function(r) { setTimeout(r, delay * 1000); });
      }
    }

    return NextResponse.json({
      success: true,
      totalSent,
      totalFailed,
      results: sentResults,
      sessions,
    });
  }

  // ===== READ COMMENTS =====
  if (action === 'read_comments') {
    var posts: any[] = [];
    var comments: any[] = [];

    if ((platform === 'instagram' || platform === 'all') && sessions.ig) {
      try {
        var igPosts = await igGetRecentPosts(sessions.ig.sessionid, sessions.ig.csrftoken, sessions.ig.userId || '');
        for (var ip = 0; ip < Math.min(3, igPosts.length); ip++) {
          posts.push({ ...igPosts[ip], platform: 'instagram' });
          var igComments = await igGetComments(sessions.ig.sessionid, sessions.ig.csrftoken, igPosts[ip].id);
          for (var ic = 0; ic < igComments.length; ic++) {
            comments.push({ ...igComments[ic], platform: 'instagram', postId: igPosts[ip].id, postCaption: igPosts[ip].caption });
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      posts,
      comments,
      sessions,
    });
  }

  // ===== REPLY TO COMMENTS (AI-generated) =====
  if (action === 'reply_comments') {
    var replyResults: any[] = [];
    var commentsToReply = body.comments || [];
    var totalReplied = 0;

    for (var ri = 0; ri < commentsToReply.length; ri++) {
      var c = commentsToReply[ri];
      var replyText = await generateAIReply(c.text, c.postCaption || '', c.platform || 'instagram');

      var replyResult: any = { username: c.username, originalComment: c.text, reply: replyText };

      try {
        if (c.platform === 'instagram' && sessions.ig) {
          var rr = await igReplyComment(sessions.ig.sessionid, sessions.ig.csrftoken, c.postId, c.id, replyText);
          replyResult.success = rr.success;
          replyResult.error = rr.error;
        } else {
          replyResult.success = false; replyResult.error = 'Plataforma nao suportada ou sem sessao';
        }
        if (replyResult.success) totalReplied++;
      } catch (e: any) {
        replyResult.success = false; replyResult.error = e.message;
      }

      replyResults.push(replyResult);
      if (ri < commentsToReply.length - 1) {
        var delay2 = Math.floor(Math.random() * 120) + 300; // 300-420s = 5-7 min
        replyResults[replyResults.length - 1].nextWait = delay2 + 's';
        await new Promise(function(r) { setTimeout(r, delay2 * 1000); });
      }
    }

    return NextResponse.json({
      success: true,
      totalReplied,
      results: replyResults,
      sessions,
    });
  }

  // ===== UPLOAD POST =====
  if (action === 'post') {
    if (mediaData && sessions.ig) {
      try {
        var imageBuffer = Buffer.from(mediaData, 'base64');
        var postRes = await igUploadPost(sessions.ig.sessionid, sessions.ig.csrftoken, imageBuffer, message);
        return NextResponse.json({ success: postRes.success, mediaId: postRes.mediaId, error: postRes.error, sessions });
      } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
      }
    }
    return NextResponse.json({ success: false, error: 'Necessitas enviar uma foto e ter sessao activa' });
  }

  // ===== INBOX =====
  if (action === 'inbox') {
    var inboxMessages: any[] = [];

    if (sessions.ig) {
      try {
        var igInbox = await igGetInbox(sessions.ig.sessionid, sessions.ig.csrftoken);
        inboxMessages = inboxMessages.concat(igInbox);
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      messages: inboxMessages,
      total: inboxMessages.length,
      sessions,
    });
  }

  // ===== HIKERAPI: Profile =====
  if (action === 'hiker_profile') {
    var target = body.target || IG_USERNAME || 'mwangobrain';
    if (!target) return NextResponse.json({ success: false, error: 'Necessitas especificar um utilizador' });
    var profile = await hikerGetUser(target);
    if (!profile) return NextResponse.json({ success: false, error: 'Nao encontrou @' + target });
    return NextResponse.json({
      success: true,
      type: 'hiker_profile',
      data: {
        username: profile.username,
        fullName: profile.full_name,
        followers: profile.follower_count,
        following: profile.following_count,
        posts: profile.media_count,
        bio: profile.biography,
        verified: profile.is_verified,
        business: profile.is_business,
        category: profile.category,
        website: profile.external_url,
        pk: profile.pk,
      },
    });
  }

  // ===== HIKERAPI: Followers =====
  if (action === 'hiker_followers') {
    var fgTarget = body.target || IG_USERNAME || 'mwangobrain';
    var profileFg = await hikerGetUser(fgTarget);
    if (!profileFg) return NextResponse.json({ success: false, error: 'Nao encontrou @' + fgTarget });
    var followers = await hikerGetFollowers(String(profileFg.pk), 50);
    return NextResponse.json({
      success: true,
      type: 'hiker_followers',
      totalFollowers: profileFg.follower_count,
      shown: followers.length,
      data: followers.map(function(u: any) {
        return { username: u.username, fullName: u.full_name, followers: u.follower_count, isPrivate: u.is_private, isVerified: u.is_verified, pk: u.pk };
      }),
    });
  }

  // ===== HIKERAPI: Posts =====
  if (action === 'hiker_posts') {
    var postsTarget = body.target || IG_USERNAME || 'mwangobrain';
    var profilePosts = await hikerGetUser(postsTarget);
    if (!profilePosts) return NextResponse.json({ success: false, error: 'Nao encontrou @' + postsTarget });
    var medias = await hikerGetMedias(String(profilePosts.pk), 12);
    var postsWithComments: any[] = [];
    for (var mi = 0; mi < Math.min(6, medias.length); mi++) {
      var m = medias[mi];
      var mediaComments = await hikerGetCommentsFn(m.id, 10);
      postsWithComments.push({
        code: m.code,
        id: m.id,
        likes: m.like_count,
        comments: m.comment_count,
        caption: (m.caption || {}).text || '',
        mediaType: m.media_type,
        takenAt: m.taken_at,
        commentsList: mediaComments.map(function(c: any) {
          return { id: c.pk, username: (c.user || {}).username || '', text: c.text, likes: c.like_count, timestamp: c.created_at_utc };
        }),
      });
    }
    return NextResponse.json({
      success: true,
      type: 'hiker_posts',
      totalPosts: profilePosts.media_count,
      shown: medias.length,
      data: postsWithComments,
    });
  }

  // ===== HIKERAPI: Stories =====
  if (action === 'hiker_stories') {
    var storiesTarget = body.target || IG_USERNAME || 'mwangobrain';
    var profileStories = await hikerGetUser(storiesTarget);
    if (!profileStories) return NextResponse.json({ success: false, error: 'Nao encontrou @' + storiesTarget });
    var stories = await hikerGetStories(String(profileStories.pk));
    return NextResponse.json({
      success: true,
      type: 'hiker_stories',
      active: stories.length,
      data: stories.map(function(s: any) {
        return { id: s.id, mediaType: s.media_type, takenAt: s.taken_at, expiringAt: s.expiring_at };
      }),
    });
  }

  // ===== HIKERAPI: Search =====
  if (action === 'hiker_search') {
    var searchQ = body.target || '';
    if (!searchQ) return NextResponse.json({ success: false, error: 'Necessitas especificar o que procurar' });
    var results = await hikerSearchUsers(searchQ, 20);
    return NextResponse.json({
      success: true,
      type: 'hiker_search',
      total: results.length,
      data: results.map(function(u: any) {
        return { username: u.username, fullName: u.full_name, followers: u.follower_count, isPrivate: u.is_private, isVerified: u.is_verified, pk: u.pk };
      }),
    });
  }

  // ===== HIKERAPI: Balance =====
  if (action === 'hiker_balance') {
    var balance = await hikerGetBalance();
    return NextResponse.json({
      success: true,
      type: 'hiker_balance',
      remainingRequests: balance.requests,
      balanceAmount: balance.amount,
    });
  }

  // ===== UPLOAD-POST: Publish Text =====
  if (action === 'up_publish_text') {
    var platforms = body.platforms || ['twitter'];
    var title = message || body.title || 'Post do JARVIS';
    var result = await upPublishText(title, platforms, body.options || {});
    return NextResponse.json(result);
  }

  // ===== UPLOAD-POST: Publish Photos =====
  if (action === 'up_publish_photos') {
    if (!mediaData) return NextResponse.json({ success: false, error: 'Necessitas enviar uma foto' });
    var photoPlatforms = body.platforms || ['instagram'];
    var photoTitle = message || body.title || 'Foto do JARVIS';
    var imageBuffer = Buffer.from(mediaData, 'base64');
    var result = await upPublishPhotos([imageBuffer], photoTitle, photoPlatforms, body.options || {});
    return NextResponse.json(result);
  }

  // ===== UPLOAD-POST: Publish Video =====
  if (action === 'up_publish_video') {
    if (!mediaData) return NextResponse.json({ success: false, error: 'Necessitas enviar um video' });
    var videoPlatforms = body.platforms || ['tiktok'];
    var videoTitle = message || body.title || 'Video do JARVIS';
    var videoBuffer = Buffer.from(mediaData, 'base64');
    var result = await upPublishVideo(videoBuffer, videoTitle, videoPlatforms, body.options || {});
    return NextResponse.json(result);
  }

  // ===== UPLOAD-POST: History =====
  if (action === 'up_history') {
    var history = await upGetHistory();
    return NextResponse.json(history);
  }

  // ===== UPLOAD-POST: Status =====
  if (action === 'up_status') {
    var requestId = body.requestId || '';
    if (!requestId) return NextResponse.json({ success: false, error: 'RequestId necessario' });
    var status = await upGetStatus(requestId);
    return NextResponse.json(status);
  }

  // ===== UPLOAD-POST: Schedule =====
  if (action === 'up_schedule') {
    var schedule = await upGetSchedule();
    return NextResponse.json(schedule);
  }

  // ===== UPLOAD-POST: Profiles =====
  if (action === 'up_profiles') {
    var profiles = await upListProfiles();
    return NextResponse.json(profiles);
  }

  // ===== UPLOAD-POST: Analytics =====
  if (action === 'up_analytics') {
    var profileName = body.target || 'jarvis';
    var analytics = await upGetAnalytics(profileName);
    return NextResponse.json(analytics);
  }

  // ===== UPLOAD-POST: Get Media =====
  if (action === 'up_media') {
    var mediaPlatform = body.target || '';
    var media = await upGetMedia(mediaPlatform || undefined, body.limit);
    return NextResponse.json(media);
  }

  // ===== UPLOAD-POST: IG Comments =====
  if (action === 'up_comments') {
    var mediaIdUp = body.mediaId || body.target || '';
    var comments = await upGetCommentsFn(mediaIdUp);
    return NextResponse.json(comments);
  }

  // ===== UPLOAD-POST: IG DMs =====
  if (action === 'up_inbox') {
    var conversations = await upGetDMConversations();
    return NextResponse.json(conversations);
  }

  // ===== UPLOAD-POST: Generate OAuth Connect URL (connect IG/FB/TikTok) =====
  if (action === 'up_connect') {
    var connectResult = await upGenerateConnectURL({
      platforms: body.platforms || ['instagram', 'facebook', 'tiktok'],
      redirect_url: body.redirect_url || 'https://jarvis-khaki-chi.vercel.app',
      connect_title: body.connect_title || 'Mwango Brain — Conectar Redes Sociais ao JARVIS',
      language: body.language || 'pt',
    });
    return NextResponse.json({
      success: connectResult.success,
      type: 'up_connect',
      access_url: connectResult.access_url,
      duration: connectResult.duration,
      error: connectResult.error,
      instructions: connectResult.success
        ? 'Abre o link no navegador e clica em cada plataforma (Instagram, Facebook, TikTok) para autorizar. Depois disso, o JARVIS consegue publicar em todas via API.'
        : undefined,
    });
  }

  // ===== UPLOAD-POST: Show Connected Accounts =====
  if (action === 'up_accounts') {
    var profileData = await upGetProfile('jarvis');
    var accounts: any[] = [];
    // social_accounts can be at top level or nested under .profile
    var sa = (profileData && profileData.social_accounts) || (profileData && profileData.profile && profileData.profile.social_accounts) || {};
    var platforms = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'threads', 'discord', 'telegram'];
    for (var pi = 0; pi < platforms.length; pi++) {
      var pkey = platforms[pi];
      var entry = sa[pkey];
      if (entry && entry !== '' && entry !== null && typeof entry === 'object') {
        var acc = entry;
        accounts.push({
          platform: pkey,
          handle: acc.handle || acc.username || '',
          displayName: acc.display_name || acc.handle || '',
          image: acc.social_images || '',
          needsReauth: acc.reauth_required === true,
        });
      }
    }
    return NextResponse.json({
      success: true,
      type: 'up_accounts',
      totalConnected: accounts.length,
      accounts,
      raw: profileData,
    });
  }

  // ===== UPLOAD-POST: Account Info (/me) =====
  if (action === 'up_me') {
    var me = await upGetAccountInfo();
    return NextResponse.json({
      success: true,
      type: 'up_me',
      data: me,
    });
  }

  // ===== UPLOAD-POST: Cross-post to all connected platforms =====
  if (action === 'up_publish_all') {
    var allMsg = message || body.title || '';
    if (!allMsg) return NextResponse.json({ success: false, error: 'Mensagem necessaria para publicar' });
    // First check which platforms are connected
    var checkProfile = await upGetProfile('jarvis');
    var connected: string[] = [];
    var sa2 = (checkProfile && checkProfile.social_accounts) || (checkProfile && checkProfile.profile && checkProfile.profile.social_accounts) || {};
    var platKeys = ['instagram', 'facebook', 'tiktok', 'youtube', 'linkedin', 'x', 'threads'];
    for (var pk = 0; pk < platKeys.length; pk++) {
      var entry = sa2[platKeys[pk]];
      if (entry && entry !== '' && entry !== null && typeof entry === 'object') connected.push(platKeys[pk]);
    }
    if (connected.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma plataforma conectada. Diz "conectar upload" para gerar o link de OAuth.',
      });
    }
    var pubAllResult = await upPublishText(allMsg, connected, body.options || {});
    return NextResponse.json({
      success: pubAllResult && pubAllResult.success !== false,
      type: 'up_publish_all',
      platforms: connected,
      result: pubAllResult,
    });
  }

  // ===== UPLOAD-POST: Schedule a post =====
  if (action === 'up_schedule_create') {
    var schedText = message || body.title || '';
    var schedDate = body.target || body.scheduled_date || '';
    if (!schedText || !schedDate) {
      return NextResponse.json({ success: false, error: 'Necessitas mensagem e data (ex: "agendar Olá mundo para 2026-08-01T15:00:00Z")' });
    }
    // Try to parse date
    var parsedDate: string = schedDate;
    try {
      var d = new Date(schedDate);
      if (!isNaN(d.getTime())) parsedDate = d.toISOString();
    } catch {}
    var platforms2 = body.platforms || ['instagram', 'facebook', 'tiktok'];
    var schedResult = await upPublishText(schedText, platforms2, { scheduled_date: parsedDate });
    return NextResponse.json({
      success: schedResult && schedResult.success !== false,
      type: 'up_schedule_create',
      scheduledFor: parsedDate,
      platforms: platforms2,
      result: schedResult,
    });
  }

  // ===== UPLOAD-POST: List scheduled posts =====
  if (action === 'up_schedule_list') {
    var scheduledList = await upGetSchedule();
    return NextResponse.json({
      success: true,
      type: 'up_schedule_list',
      data: scheduledList,
    });
  }

  // ===== UPLOAD-POST: Cancel scheduled post =====
  if (action === 'up_schedule_cancel') {
    var cancelId = body.jobId || body.target || '';
    if (!cancelId) return NextResponse.json({ success: false, error: 'jobId necessario' });
    var cancelRes = await upCancelScheduled(cancelId);
    return NextResponse.json(cancelRes);
  }

  // ===== UPLOAD-POST: Queue preview =====
  if (action === 'up_queue') {
    var queue = await upGetQueuePreview();
    return NextResponse.json({
      success: true,
      type: 'up_queue',
      data: queue,
    });
  }

  // ===== UPLOAD-POST: Facebook Pages =====
  if (action === 'up_fb_pages') {
    var pages = await upGetFacebookPages();
    return NextResponse.json({
      success: true,
      type: 'up_fb_pages',
      data: pages,
    });
  }

  // ===== UPLOAD-POST: Retry failed post =====
  if (action === 'up_retry') {
    var retryId = body.requestId || body.target || '';
    if (!retryId) return NextResponse.json({ success: false, error: 'requestId necessario' });
    var retryRes = await upRetryPost(retryId);
    return NextResponse.json(retryRes);
  }

  // ===== UPLOAD-POST: Publish from URL =====
  if (action === 'up_publish_url') {
    var pubURL = body.url || body.target || '';
    var pubTitle = message || body.title || 'Post do JARVIS';
    var pubPlatforms = body.platforms || ['instagram', 'tiktok'];
    if (!pubURL) return NextResponse.json({ success: false, error: 'URL do video necessaria' });
    var urlResult = await upPublishFromURL(pubURL, pubTitle, pubPlatforms, body.options || {});
    return NextResponse.json(urlResult);
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
