// ============================================================
//  Aura Engine API — Proxy unificado para o Python aura-engine
//  Todos os 13 funcionalidades passam por aqui
//  POST /api/engine { action, ...params }
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  isEngineConfigured,
  engineCreatePost, engineListPosts, engineFetchPosts,
  engineCreateStory,
  engineSendDM, engineBulkDM, engineGetInbox, engineReplyDM,
  engineListComments, engineReplyComment,
  engineCreateSchedule, engineListSchedules, engineDeleteSchedule,
  engineListLeads, engineAddLead, engineDeleteLead,
  engineCreateCampaign, engineListCampaigns, engineLaunchCampaign,
  engineGetAnalytics, engineGetDashboard,
  engineAIGenerate, engineUserLookup, engineGetFollowers,
  engineImportCookies, engineKeepAlive, engineReloginIG,
  engineHealth,
} from '@/lib/engine-proxy';

export var maxDuration = 300;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;

  if (!isEngineConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'AURA_ENGINE_URL nao configurada. Adiciona esta env var no Railway apontando para o servico Python (ex: http://aura-engine.railway.internal:8000)',
    });
  }

  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  try {
    // === 1. PUBLICAR POSTS ===
    if (action === 'publish_post') {
      if (!body.platform || !body.caption) {
        return NextResponse.json({ success: false, error: 'platform e caption necessarios' });
      }
      var result = await engineCreatePost(
        body.platform, body.caption, body.image_url,
        body.ai_generate_caption, body.context, body.scheduled_at
      );
      return NextResponse.json(result);
    }

    // === 2. LISTAR POSTS (do engine DB) ===
    if (action === 'list_posts') {
      var result = await engineListPosts(body.platform);
      return NextResponse.json(result);
    }

    // === 3. FETCH POSTS (da plataforma) ===
    if (action === 'fetch_posts') {
      if (!body.platform) return NextResponse.json({ success: false, error: 'platform necessario' });
      var result = await engineFetchPosts(body.platform);
      return NextResponse.json(result);
    }

    // === 4. PUBLICAR STORIES ===
    if (action === 'publish_story') {
      if (!body.platform || !body.image_url) {
        return NextResponse.json({ success: false, error: 'platform e image_url necessarios' });
      }
      var result = await engineCreateStory(body.platform, body.image_url, body.caption);
      return NextResponse.json(result);
    }

    // === 5. ENVIAR DM ===
    if (action === 'send_dm') {
      if (!body.platform || !body.target) {
        return NextResponse.json({ success: false, error: 'platform e target necessarios' });
      }
      var result = await engineSendDM(body.platform, body.target, body.message, body.context, body.ai_generate);
      return NextResponse.json(result);
    }

    // === 6. BULK DM ===
    if (action === 'bulk_dm') {
      if (!body.platform || !Array.isArray(body.targets)) {
        return NextResponse.json({ success: false, error: 'platform e targets (array) necessarios' });
      }
      var result = await engineBulkDM(body.platform, body.targets, body.message, body.context, body.delay);
      return NextResponse.json(result);
    }

    // === 7. INBOX ===
    if (action === 'get_inbox') {
      if (!body.platform) return NextResponse.json({ success: false, error: 'platform necessario' });
      var result = await engineGetInbox(body.platform, body.limit);
      return NextResponse.json(result);
    }

    // === 8. RESPONDER DM ===
    if (action === 'reply_dm') {
      if (!body.thread_id || !body.platform) {
        return NextResponse.json({ success: false, error: 'thread_id e platform necessarios' });
      }
      var result = await engineReplyDM(body.thread_id, body.message || '', body.platform, body.ai_generate, body.context);
      return NextResponse.json(result);
    }

    // === 9. LISTAR COMENTARIOS ===
    if (action === 'list_comments') {
      if (!body.platform || !body.post_id) {
        return NextResponse.json({ success: false, error: 'platform e post_id necessarios' });
      }
      var result = await engineListComments(body.platform, body.post_id);
      return NextResponse.json(result);
    }

    // === 10. RESPONDER COMENTARIO ===
    if (action === 'reply_comment') {
      if (!body.platform || !body.post_id || !body.comment_id) {
        return NextResponse.json({ success: false, error: 'platform, post_id e comment_id necessarios' });
      }
      var result = await engineReplyComment(body.platform, body.post_id, body.comment_id, body.reply_text, body.ai_generate);
      return NextResponse.json(result);
    }

    // === 11. AGENDAR ===
    if (action === 'schedule') {
      if (!body.task_type || !body.platform || !body.scheduled_at) {
        return NextResponse.json({ success: false, error: 'task_type, platform e scheduled_at necessarios' });
      }
      var result = await engineCreateSchedule(body.task_type, body.platform, body.payload || {}, body.scheduled_at);
      return NextResponse.json(result);
    }

    // === 12. LISTAR AGENDAMENTOS ===
    if (action === 'list_schedules') {
      var result = await engineListSchedules();
      return NextResponse.json(result);
    }

    // === 13. APAGAR AGENDAMENTO ===
    if (action === 'delete_schedule') {
      if (!body.task_id) return NextResponse.json({ success: false, error: 'task_id necessario' });
      var result = await engineDeleteSchedule(body.task_id);
      return NextResponse.json(result);
    }

    // === 14. LISTAR LEADS ===
    if (action === 'list_leads') {
      var result = await engineListLeads(body.platform, body.status);
      return NextResponse.json(result);
    }

    // === 15. ADICIONAR LEAD ===
    if (action === 'add_lead') {
      if (!body.platform || !body.username) {
        return NextResponse.json({ success: false, error: 'platform e username necessarios' });
      }
      var result = await engineAddLead(body.platform, body.username, body.notes, body.tags);
      return NextResponse.json(result);
    }

    // === 16. APAGAR LEAD ===
    if (action === 'delete_lead') {
      if (!body.lead_id) return NextResponse.json({ success: false, error: 'lead_id necessario' });
      var result = await engineDeleteLead(body.lead_id);
      return NextResponse.json(result);
    }

    // === 17. CRIAR CAMPANHA ===
    if (action === 'create_campaign') {
      if (!body.name || !body.platform || !Array.isArray(body.target_list)) {
        return NextResponse.json({ success: false, error: 'name, platform e target_list necessarios' });
      }
      var result = await engineCreateCampaign(body.name, body.platform, body.target_list, body.message_template, body.context);
      return NextResponse.json(result);
    }

    // === 18. LISTAR CAMPANHAS ===
    if (action === 'list_campaigns') {
      var result = await engineListCampaigns();
      return NextResponse.json(result);
    }

    // === 19. LANCAR CAMPANHA ===
    if (action === 'launch_campaign') {
      if (!body.campaign_id) return NextResponse.json({ success: false, error: 'campaign_id necessario' });
      var result = await engineLaunchCampaign(body.campaign_id);
      return NextResponse.json(result);
    }

    // === 20. ANALYTICS ===
    if (action === 'analytics') {
      var result = await engineGetAnalytics();
      return NextResponse.json(result);
    }

    // === 21. DASHBOARD DATA ===
    if (action === 'dashboard') {
      var result = await engineGetDashboard();
      return NextResponse.json(result);
    }

    // === 22. AI GENERATE ===
    if (action === 'ai_generate') {
      if (!body.prompt_type || !body.context) {
        return NextResponse.json({ success: false, error: 'prompt_type e context necessarios' });
      }
      var result = await engineAIGenerate(body.prompt_type, body.context, body.extra);
      return NextResponse.json(result);
    }

    // === 23. USER LOOKUP ===
    if (action === 'user_lookup') {
      if (!body.platform || !body.username) {
        return NextResponse.json({ success: false, error: 'platform e username necessarios' });
      }
      var result = await engineUserLookup(body.platform, body.username);
      return NextResponse.json(result);
    }

    // === 24. GET FOLLOWERS ===
    if (action === 'get_followers') {
      if (!body.username) return NextResponse.json({ success: false, error: 'username necessario' });
      var result = await engineGetFollowers(body.username, body.amount);
      return NextResponse.json(result);
    }

    // === 25. IMPORT COOKIES ===
    if (action === 'import_cookies') {
      if (!body.platform || !body.cookies) {
        return NextResponse.json({ success: false, error: 'platform e cookies necessarios' });
      }
      var result = await engineImportCookies(body.platform, body.cookies);
      return NextResponse.json(result);
    }

    // === 26. KEEP ALIVE ===
    if (action === 'keep_alive') {
      if (!body.platform) return NextResponse.json({ success: false, error: 'platform necessario' });
      var result = await engineKeepAlive(body.platform);
      return NextResponse.json(result);
    }

    // === 27. IG RELOGIN ===
    if (action === 'ig_relogin') {
      var result = await engineReloginIG();
      return NextResponse.json(result);
    }

    // === 28. ENGINE HEALTH ===
    if (action === 'engine_health') {
      var result = await engineHealth();
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    console.error('[engine] Erro:', e);
    return NextResponse.json({ success: false, error: e.message });
  }
}

// GET para health check do engine
export async function GET(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var result = await engineHealth();
  return NextResponse.json(result);
}