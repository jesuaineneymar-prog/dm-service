// ============================================================
//  Aura EXTERNAL TOOLS API
//  Integrates ScrapingBee, Upload-Post, ManyChat, N8N, SerpAPI
//  All REAL actions, zero simulation
// ============================================================

import { NextResponse } from 'next/server';
import {
  sbScrape, sbGetIGProfile, sbGetIGComments, sbGetFBPage,
  sbGoogleSearch, sbScrapeSocial,
  upPost, upGetPostStatus, upListProfiles, upListPlatforms,
  mcSendDM, mcGetConversations, mcTriggerFlow,
  n8nTrigger,
  serpSearch, serpTrends, serpNews, serpContentIdeas,
  getExternalConfig,
} from '@/lib/external-apis';
import {
  steelIGSendDM, steelFBSendDM, steelBulkDM,
  steelCreateLoginSession, steelCheckLogin,
  steelSocialDMStatus, steelClearSessions, steelScreenshot,
} from '@/lib/steel-social-dm';
import {
  metaSendDM, metaBulkDM, metaGetConversations, metaGetPageInfo, metaGraphStatus,
} from '@/lib/meta-graph';
import { MANYCHAT_KEY, SCRAPING_BEE_KEY } from '@/lib/config';
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

  // ===== SCRAPINGBEE (Web Scraping — replaces HikerAPI) =====
  if (tool === 'scrapingbee' || tool === 'scrape') {
    if (action === 'scrape_url') {
      var url = body.url || '';
      if (!url) return NextResponse.json({ success: false, error: 'URL necessaria' });
      return NextResponse.json(await sbScrape(url, {
        render_js: body.render_js,
        premium_proxy: body.premium_proxy !== false,
        country_code: body.country_code,
        wait: body.wait,
        extract_rules: body.extract_rules,
      }));
    }

    if (action === 'ig_profile') {
      var username = body.username || '';
      if (!username) return NextResponse.json({ success: false, error: 'Username necessario' });
      return NextResponse.json(await sbGetIGProfile(username));
    }

    if (action === 'ig_comments') {
      var postUrl = body.postUrl || body.url || '';
      if (!postUrl) return NextResponse.json({ success: false, error: 'Post URL necessario' });
      return NextResponse.json(await sbGetIGComments(postUrl));
    }

    if (action === 'fb_page') {
      var page = body.page || body.username || '';
      if (!page) return NextResponse.json({ success: false, error: 'Page name necessario' });
      return NextResponse.json(await sbGetFBPage(page));
    }

    if (action === 'google_search') {
      var query = body.query || '';
      if (!query) return NextResponse.json({ success: false, error: 'Query necessaria' });
      return NextResponse.json(await sbGoogleSearch(query, body.num));
    }

    if (action === 'social_profile') {
      var platform = body.platform || 'instagram';
      var user = body.username || '';
      if (!user) return NextResponse.json({ success: false, error: 'Username necessario' });
      return NextResponse.json(await sbScrapeSocial(platform, user));
    }

    return NextResponse.json({ success: false, error: 'Accao ScrapingBee desconhecida: ' + action });
  }

  // ===== UPLOAD-POST (Content Publishing) =====
  if (tool === 'uploadpost') {
    var upKey = apiKey || config.uploadPostApiKey;
    if (!upKey) return NextResponse.json({ success: false, error: 'SEM_UPLOADPOST_KEY: Regista-te em upload-post.com' });

    if (action === 'post') {
      var platform = body.platform || 'instagram';
      var caption = body.caption || '';
      var mediaUrl = body.mediaUrl || '';
      var mediaData = body.mediaData || '';
      var profileId = body.profileId || '';
      var publishAt = body.publishAt || '';
      if (!mediaUrl && !mediaData) return NextResponse.json({ success: false, error: 'Precisas enviar uma foto ou video' });
      return NextResponse.json(await upPost(upKey, { platform, caption, mediaUrl, mediaData, profileId, publishAt }));
    }

    if (action === 'post_status') {
      var postId = body.postId || '';
      if (!postId) return NextResponse.json({ success: false, error: 'Post ID necessario' });
      return NextResponse.json(await upGetPostStatus(upKey, postId));
    }

    if (action === 'list_profiles') return NextResponse.json(await upListProfiles(upKey));
    if (action === 'list_platforms') return NextResponse.json(await upListPlatforms(upKey));

    return NextResponse.json({ success: false, error: 'Accao Upload-Post desconhecida: ' + action });
  }

  // ===== MANYCHAT (Auto-Reply DMs) =====
  if (tool === 'manychat') {
    var mcKey = apiKey || MANYCHAT_KEY;
    if (!mcKey) return NextResponse.json({ success: false, error: 'SEM_MANYCHAT_KEY' });

    if (action === 'send_dm') {
      var mcPlatform = body.platform || 'instagram';
      var mcUserId = body.userId || '';
      var mcMessage = body.message || '';
      if (!mcUserId || !mcMessage) return NextResponse.json({ success: false, error: 'UserId e mensagem necessarios' });
      return NextResponse.json(await mcSendDM(mcKey, { platform: mcPlatform, userId: mcUserId, message: mcMessage }));
    }

    if (action === 'get_conversations') return NextResponse.json(await mcGetConversations(mcKey, body.platform));

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
    if (!webhookUrl) return NextResponse.json({ success: false, error: 'SEM_N8N_URL' });
    return NextResponse.json(await n8nTrigger(webhookUrl, body.payload || body));
  }

  // ===== SERPAPI (Google Search / Trends / News) =====
  if (tool === 'serpapi') {
    if (action === 'search') {
      var searchQuery = body.query || '';
      if (!searchQuery) return NextResponse.json({ success: false, error: 'Query necessaria' });
      return NextResponse.json(await serpSearch(searchQuery, { engine: body.engine, num: body.num, location: body.location, hl: body.hl || 'pt', tbm: body.tbm }));
    }
    if (action === 'trends') {
      var trendQuery = body.query || '';
      if (!trendQuery) return NextResponse.json({ success: false, error: 'Query de tendencia necessaria' });
      return NextResponse.json(await serpTrends(trendQuery, { geo: body.geo, date: body.date, hl: body.hl }));
    }
    if (action === 'news') {
      var newsQuery = body.query || '';
      if (!newsQuery) return NextResponse.json({ success: false, error: 'Query de noticia necessaria' });
      return NextResponse.json(await serpNews(newsQuery, { location: body.location, hl: body.hl }));
    }
    if (action === 'content_ideas') {
      var topic = body.topic || '';
      if (!topic) return NextResponse.json({ success: false, error: 'Topico necessario' });
      return NextResponse.json(await serpContentIdeas(topic, body.platform));
    }
    return NextResponse.json({ success: false, error: 'Accao SerpAPI desconhecida: ' + action });
  }

  // ===== STEEL.DEV (IG + FB DMs via anti-detection browser) =====
  if (tool === 'steel') {
    if (action === 'status') return NextResponse.json({ success: true, data: await steelSocialDMStatus() });
    if (action === 'ig_send_dm') {
      var igUser = body.username || '';
      var igMsg = body.message || '';
      if (!igUser || !igMsg) return NextResponse.json({ success: false, error: 'Username e mensagem necessarios' });
      return NextResponse.json(await steelIGSendDM({ username: igUser, message: igMsg }));
    }
    if (action === 'fb_send_dm') {
      var fbUser = body.username || '';
      var fbMsg = body.message || '';
      if (!fbUser || !fbMsg) return NextResponse.json({ success: false, error: 'Username e mensagem necessarios' });
      return NextResponse.json(await steelFBSendDM({ username: fbUser, message: fbMsg }));
    }
    if (action === 'bulk_dm') {
      var dmPlatform = body.platform || 'instagram';
      if (dmPlatform !== 'instagram' && dmPlatform !== 'facebook') return NextResponse.json({ success: false, error: 'Plataforma deve ser instagram ou facebook' });
      var users = body.users || [];
      if (!Array.isArray(users) || users.length === 0) return NextResponse.json({ success: false, error: 'Array de users necessario' });
      return NextResponse.json(await steelBulkDM({ platform: dmPlatform, users, defaultMessage: body.defaultMessage || '', delayBetweenUsers: body.delayBetweenUsers || 5000 }));
    }
    if (action === 'ig_login_session') return NextResponse.json(await steelCreateLoginSession('instagram'));
    if (action === 'fb_login_session') return NextResponse.json(await steelCreateLoginSession('facebook'));
    if (action === 'check_login') {
      var clPlatform = body.platform || 'instagram';
      return NextResponse.json(await steelCheckLogin(clPlatform));
    }
    if (action === 'clear_sessions') { await steelClearSessions(body.platform); return NextResponse.json({ success: true }); }
    if (action === 'screenshot') {
      var ssPlatform = body.platform || 'instagram';
      if (ssPlatform !== 'instagram' && ssPlatform !== 'facebook') return NextResponse.json({ success: false, error: 'Plataforma invalida' });
      return NextResponse.json(await steelScreenshot(ssPlatform, body.url));
    }
    return NextResponse.json({ success: false, error: 'Accao Steel desconhecida: ' + action });
  }

  // ===== META GRAPH API (Proactive DMs — com human pacing 10-15 min) =====
  if (tool === 'meta') {
    if (action === 'setup_token') {
      var metaToken = body.token || '';
      if (!metaToken) return NextResponse.json({ success: false, error: 'Token necessario' });
      var { metaSetupToken } = await import('@/lib/meta-graph');
      return NextResponse.json(await metaSetupToken(metaToken));
    }
    if (action === 'status') return NextResponse.json({ success: true, data: await metaGraphStatus() });
    if (action === 'send_dm') {
      var metaPlatform = body.platform || 'instagram';
      var metaRecipientId = body.recipientId || '';
      var metaMessage = body.message || '';
      if (!metaRecipientId || !metaMessage) return NextResponse.json({ success: false, error: 'recipientId e mensagem necessarios' });
      if (metaPlatform !== 'instagram' && metaPlatform !== 'facebook') return NextResponse.json({ success: false, error: 'Plataforma invalida' });
      return NextResponse.json(await metaSendDM({ platform: metaPlatform, recipientId: metaRecipientId, message: metaMessage, skipPacing: body.skipPacing }));
    }
    if (action === 'bulk_dm') {
      var bdmPlatform = body.platform || 'instagram';
      var bdmRecipients = body.recipients || [];
      if (!Array.isArray(bdmRecipients) || bdmRecipients.length === 0) return NextResponse.json({ success: false, error: 'recipients necessario' });
      if (bdmRecipients.length > 100) return NextResponse.json({ success: false, error: 'Maximo 100 recipients por batch' });
      return NextResponse.json(await metaBulkDM({ platform: bdmPlatform, recipients: bdmRecipients, defaultMessage: body.defaultMessage || '', delayMs: body.delayMs, skipPacing: body.skipPacing || false }));
    }
    if (action === 'get_conversations') return NextResponse.json(await metaGetConversations(body.platform || 'instagram', body.limit || 25));
    if (action === 'page_info') return NextResponse.json(await metaGetPageInfo());
    return NextResponse.json({ success: false, error: 'Accao Meta desconhecida: ' + action });
  }

  return NextResponse.json({ success: false, error: 'Ferramenta desconhecida. Usa: scrapingbee, uploadpost, manychat, n8n, serpapi, steel, meta' });
}