// ============================================================
//  Aura EXTERNAL TOOLS API — /api/tools (mirror of /cmd/tools)
//  Integrates HikerAPI, Upload-Post, ManyChat, N8N, SerpAPI, Steel
//  All REAL actions, zero simulation
// ============================================================

import { NextResponse } from 'next/server';
import {
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
import { MANYCHAT_KEY } from '@/lib/config';
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

  // ===== HIKERAPI (removed — use Zernio or ScrapingBee) =====
  if (tool === 'hikerapi') {
    return NextResponse.json({ success: false, error: 'HikerAPI removido. Usa Zernio ou ScrapingBee.' });
  }

  // ===== UPLOAD-POST =====
  if (tool === 'uploadpost') {
    var upKey = apiKey || config.uploadPostApiKey;
    if (!upKey) return NextResponse.json({ success: false, error: 'SEM_UPLOADPOST_KEY' });
    if (action === 'post') { if (!body.mediaUrl && !body.mediaData) return NextResponse.json({ success: false, error: 'Media necessaria' }); return NextResponse.json(await upPost(upKey, { platform: body.platform || 'instagram', caption: body.caption || '', mediaUrl: body.mediaUrl, mediaData: body.mediaData, profileId: body.profileId, publishAt: body.publishAt })); }
    if (action === 'post_status') { if (!body.postId) return NextResponse.json({ success: false, error: 'Post ID necessario' }); return NextResponse.json(await upGetPostStatus(upKey, body.postId)); }
    if (action === 'list_profiles') { return NextResponse.json(await upListProfiles(upKey)); }
    if (action === 'list_platforms') { return NextResponse.json(await upListPlatforms(upKey)); }
    return NextResponse.json({ success: false, error: 'Accao Upload-Post desconhecida: ' + action });
  }

  // ===== MANYCHAT =====
  if (tool === 'manychat') {
    var mcKey = apiKey || MANYCHAT_KEY;
    if (!mcKey) return NextResponse.json({ success: false, error: 'SEM_MANYCHAT_KEY' });
    if (action === 'send_dm') { if (!body.userId || !body.message) return NextResponse.json({ success: false, error: 'UserId e mensagem necessarios' }); return NextResponse.json(await mcSendDM(mcKey, { platform: body.platform || 'instagram', userId: body.userId, message: body.message })); }
    if (action === 'get_conversations') { return NextResponse.json(await mcGetConversations(mcKey, body.platform)); }
    if (action === 'trigger_flow') { if (!body.flowId) return NextResponse.json({ success: false, error: 'Flow ID necessario' }); return NextResponse.json(await mcTriggerFlow(mcKey, { platform: body.platform || 'instagram', userId: body.userId || '', flowId: body.flowId })); }
    return NextResponse.json({ success: false, error: 'Accao ManyChat desconhecida: ' + action });
  }

  // ===== N8N =====
  if (tool === 'n8n') {
    var webhookUrl = body.webhookUrl || config.n8nWebhookUrl;
    if (!webhookUrl) return NextResponse.json({ success: false, error: 'SEM_N8N_URL' });
    return NextResponse.json(await n8nTrigger(webhookUrl, body.payload || body));
  }

  // ===== SERPAPI =====
  if (tool === 'serpapi') {
    if (action === 'search') { if (!body.query) return NextResponse.json({ success: false, error: 'Query necessaria' }); return NextResponse.json(await serpSearch(body.query, { engine: body.engine, num: body.num, location: body.location, hl: body.hl || 'pt', tbm: body.tbm })); }
    if (action === 'trends') { if (!body.query) return NextResponse.json({ success: false, error: 'Query necessaria' }); return NextResponse.json(await serpTrends(body.query, { geo: body.geo, date: body.date, hl: body.hl })); }
    if (action === 'news') { if (!body.query) return NextResponse.json({ success: false, error: 'Query necessaria' }); return NextResponse.json(await serpNews(body.query, { location: body.location, hl: body.hl })); }
    if (action === 'content_ideas') { if (!body.topic) return NextResponse.json({ success: false, error: 'Topico necessario' }); return NextResponse.json(await serpContentIdeas(body.topic, body.platform)); }
    return NextResponse.json({ success: false, error: 'Accao SerpAPI desconhecida: ' + action });
  }

  // ===== STEEL.DEV (IG + FB DMs) =====
  if (tool === 'steel') {
    if (action === 'status') { return NextResponse.json({ success: true, data: await steelSocialDMStatus() }); }
    if (action === 'ig_send_dm') { if (!body.username || !body.message) return NextResponse.json({ success: false, error: 'Username e mensagem necessarios' }); return NextResponse.json(await steelIGSendDM({ username: body.username, message: body.message })); }
    if (action === 'fb_send_dm') { if (!body.username || !body.message) return NextResponse.json({ success: false, error: 'Username e mensagem necessarios' }); return NextResponse.json(await steelFBSendDM({ username: body.username, message: body.message })); }
    if (action === 'bulk_dm') { var dp = body.platform || 'instagram'; if (dp !== 'instagram' && dp !== 'facebook') return NextResponse.json({ success: false, error: 'Plataforma invalida' }); if (!Array.isArray(body.users) || body.users.length === 0) return NextResponse.json({ success: false, error: 'Array de users necessario' }); return NextResponse.json(await steelBulkDM({ platform: dp, users: body.users, defaultMessage: body.defaultMessage || '', delayBetweenUsers: body.delayBetweenUsers || 5000 })); }
    if (action === 'ig_login_session') { return NextResponse.json(await steelCreateLoginSession('instagram')); }
    if (action === 'fb_login_session') { return NextResponse.json(await steelCreateLoginSession('facebook')); }
    if (action === 'check_login') { return NextResponse.json(await steelCheckLogin(body.platform || 'instagram')); }
    if (action === 'clear_sessions') { await steelClearSessions(body.platform); return NextResponse.json({ success: true }); }
    if (action === 'screenshot') { var sp = body.platform || 'instagram'; if (sp !== 'instagram' && sp !== 'facebook') return NextResponse.json({ success: false, error: 'Plataforma invalida' }); return NextResponse.json(await steelScreenshot(sp, body.url)); }
    return NextResponse.json({ success: false, error: 'Accao Steel desconhecida: ' + action });
  }

  return NextResponse.json({ success: false, error: 'Ferramenta desconhecida. Usa: uploadpost, manychat, n8n, serpapi, ou steel' });
}