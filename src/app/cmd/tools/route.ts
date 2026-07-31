// ============================================================
//  JARVIS EXTERNAL TOOLS API
//  Integrates HikerAPI, Upload-Post, ManyChat, N8N
//  All REAL actions, zero simulation
// ============================================================

import { NextResponse } from 'next/server';
import {
  hikerGetUser, hikerGetUserPosts, hikerGetComments,
  hikerGetUserId, hikerSearchUsers, hikerGetFollowers,
  hikerGetStories, hikerGetMediaInsights,
  upPost, upGetPostStatus, upListProfiles, upListPlatforms,
  mcSendDM, mcGetConversations, mcTriggerFlow,
  n8nTrigger,
  getExternalConfig,
} from '@/lib/external-apis';

import { requireAuth } from '@/lib/auth';

export var maxDuration = 300;

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var tool = body.tool || '';
  var action = body.action || '';
  var apiKey = body.apiKey || '';

  var config = getExternalConfig();

  // ===== HIKERAPI (Instagram Data & Actions) =====
  if (tool === 'hikerapi') {
    var key = apiKey || config.hikerApiKey;
    if (!key) return NextResponse.json({ success: false, error: 'SEM_HIKER_KEY: Regista-te em hikerapi.com e poe a API key. Cria conta gratis com 100 requests em https://hikerapi.com' });

    if (action === 'get_user') {
      var username = body.username || '';
      if (!username) return NextResponse.json({ success: false, error: 'Username necessario' });
      return NextResponse.json(await hikerGetUser(key, username));
    }

    if (action === 'get_posts') {
      var userId = body.userId || '';
      if (!userId) return NextResponse.json({ success: false, error: 'User ID necessario' });
      return NextResponse.json(await hikerGetUserPosts(key, userId, body.count || 10));
    }

    if (action === 'get_comments') {
      var mediaId = body.mediaId || '';
      if (!mediaId) return NextResponse.json({ success: false, error: 'Media ID necessario' });
      return NextResponse.json(await hikerGetComments(key, mediaId));
    }

    if (action === 'search_users') {
      var query = body.query || '';
      if (!query) return NextResponse.json({ success: false, error: 'Query necessaria' });
      return NextResponse.json(await hikerSearchUsers(key, query));
    }

    if (action === 'get_followers') {
      var userId2 = body.userId || '';
      if (!userId2) return NextResponse.json({ success: false, error: 'User ID necessario' });
      return NextResponse.json(await hikerGetFollowers(key, userId2));
    }

    if (action === 'get_stories') {
      var userId3 = body.userId || '';
      if (!userId3) return NextResponse.json({ success: false, error: 'User ID necessario' });
      return NextResponse.json(await hikerGetStories(key, userId3));
    }

    if (action === 'get_insights') {
      var mId = body.mediaId || '';
      if (!mId) return NextResponse.json({ success: false, error: 'Media ID necessario' });
      return NextResponse.json(await hikerGetMediaInsights(key, mId));
    }

    if (action === 'resolve_username') {
      var uName = body.username || '';
      if (!uName) return NextResponse.json({ success: false, error: 'Username necessario' });
      var id = await hikerGetUserId(key, uName);
      return NextResponse.json({ success: !!id, userId: id, username: uName });
    }

    return NextResponse.json({ success: false, error: 'Accao HikerAPI desconhecida: ' + action });
  }

  // ===== UPLOAD-POST (Content Publishing) =====
  if (tool === 'uploadpost') {
    var upKey = apiKey || config.uploadPostApiKey;
    if (!upKey) return NextResponse.json({ success: false, error: 'SEM_UPLOADPOST_KEY: Regista-te em upload-post.com e poe a API key. Cria conta em https://upload-post.com' });

    if (action === 'post') {
      var platform = body.platform || 'instagram';
      var caption = body.caption || '';
      var mediaUrl = body.mediaUrl || '';
      var mediaData = body.mediaData || '';
      var profileId = body.profileId || '';
      var publishAt = body.publishAt || '';

      if (!mediaUrl && !mediaData) {
        return NextResponse.json({ success: false, error: 'Precisas enviar uma foto ou video (mediaUrl ou mediaData)' });
      }

      return NextResponse.json(await upPost(upKey, { platform, caption, mediaUrl, mediaData, profileId, publishAt }));
    }

    if (action === 'post_status') {
      var postId = body.postId || '';
      if (!postId) return NextResponse.json({ success: false, error: 'Post ID necessario' });
      return NextResponse.json(await upGetPostStatus(upKey, postId));
    }

    if (action === 'list_profiles') {
      return NextResponse.json(await upListProfiles(upKey));
    }

    if (action === 'list_platforms') {
      return NextResponse.json(await upListPlatforms(upKey));
    }

    return NextResponse.json({ success: false, error: 'Accao Upload-Post desconhecida: ' + action });
  }

  // ===== MANYCHAT (Auto-Reply DMs) =====
  if (tool === 'manychat') {
    var mcKey = apiKey || config.manychatApiKey;
    if (!mcKey) return NextResponse.json({ success: false, error: 'SEM_MANYCHAT_KEY: Regista-te em manychat.com e poe a API key. Cria conta gratis em https://manychat.com' });

    if (action === 'send_dm') {
      var platform2 = body.platform || 'instagram';
      var userId4 = body.userId || '';
      var message = body.message || '';
      if (!userId4 || !message) return NextResponse.json({ success: false, error: 'UserId e mensagem necessarios' });
      return NextResponse.json(await mcSendDM(mcKey, { platform: platform2, userId: userId4, message }));
    }

    if (action === 'get_conversations') {
      return NextResponse.json(await mcGetConversations(mcKey, body.platform));
    }

    if (action === 'trigger_flow') {
      var flowId = body.flowId || '';
      if (!flowId) return NextResponse.json({ success: false, error: 'Flow ID necessario' });
      return NextResponse.json(await mcTriggerFlow(mcKey, { platform: body.platform || 'instagram', userId: body.userId || '', flowId }));
    }

    return NextResponse.json({ success: false, error: 'Accao ManyChat desconhecida: ' + action });
  }

  // ===== N8N WEBHOOK =====
  if (tool === 'n8n') {
    var webhookUrl = body.webhookUrl || config.n8nWebhookUrl;
    if (!webhookUrl) return NextResponse.json({ success: false, error: 'SEM_N8N_URL: Configura o URL do webhook N8N (self-hosted no VPS)' });
    return NextResponse.json(await n8nTrigger(webhookUrl, body.payload || body));
  }

  return NextResponse.json({ success: false, error: 'Ferramenta desconhecida. Usa: hikerapi, uploadpost, manychat, ou n8n' });
}
