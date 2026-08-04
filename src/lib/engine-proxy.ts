// ============================================================
//  Aura Engine Proxy — Chamadas HTTP para o Python aura-engine
//  O Python engine (instagrapi + Graph API) corre como serviço
//  separado no Railway e expõe a API em /api/*
// ============================================================

var ENGINE_URL = process.env.AURA_ENGINE_URL || '';

/** Verifica se o engine proxy está configurado */
export function isEngineConfigured(): boolean {
  return !!ENGINE_URL;
}

/** Chamada genérica ao engine */
export async function engineRequest(
  endpoint: string,
  body: Record<string, any> = {},
  method: string = 'POST'
): Promise<any> {
  if (!ENGINE_URL) {
    return { success: false, error: 'AURA_ENGINE_URL nao configurada no Next.js (env var)' };
  }

  var url = ENGINE_URL + '/api/' + endpoint;
  try {
    var opts: any = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000), // 60s timeout
    };
    if (method === 'POST' && Object.keys(body).length > 0) {
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(url, opts);
    var data = await res.json();
    return data;
  } catch (e: any) {
    console.error('[engine-proxy] Erro ao chamar ' + endpoint + ':', e.message);
    return { success: false, error: 'Engine nao disponivel: ' + e.message };
  }
}

// === Posts ===
export async function engineCreatePost(platform: string, caption: string, imageUrl?: string, aiGenerate?: boolean, context?: string, scheduledAt?: string) {
  return engineRequest('posts/create', {
    platform, caption, image_url: imageUrl,
    ai_generate_caption: aiGenerate, context,
    scheduled_at: scheduledAt,
  });
}

export async function engineListPosts(platform?: string) {
  return engineRequest('posts/list', { platform });
}

export async function engineFetchPosts(platform: string) {
  return engineRequest('posts/fetch', { platform });
}

// === Stories ===
export async function engineCreateStory(platform: string, imageUrl: string, caption?: string) {
  return engineRequest('stories/create', { platform, image_url: imageUrl, caption });
}

// === DMs ===
export async function engineSendDM(platform: string, target: string, message?: string, context?: string, aiGenerate?: boolean) {
  return engineRequest('dm/send', {
    platform, target, message, context, ai_generate: aiGenerate !== false,
  });
}

export async function engineBulkDM(platform: string, targets: string[], message?: string, context?: string, delay?: number) {
  return engineRequest('dm/bulk', {
    platform, targets, message, context, delay: delay || 15,
  });
}

export async function engineGetInbox(platform: string, limit?: number) {
  return engineRequest('dm/inbox', { platform, limit: limit || 20 });
}

export async function engineReplyDM(threadId: string, message: string, platform: string, aiGenerate?: boolean, context?: string) {
  return engineRequest('dm/reply', {
    thread_id: threadId, message, platform, ai_generate: aiGenerate !== false, context,
  });
}

// === Comments ===
export async function engineListComments(platform: string, postId: string) {
  return engineRequest('comments/list', { platform, post_id: postId });
}

export async function engineReplyComment(platform: string, postId: string, commentId: string, replyText?: string, aiGenerate?: boolean) {
  return engineRequest('comments/reply', {
    platform, post_id: postId, comment_id: commentId,
    reply_text: replyText, ai_generate: aiGenerate !== false,
  });
}

// === Scheduling ===
export async function engineCreateSchedule(taskType: string, platform: string, payload: any, scheduledAt: string) {
  return engineRequest('schedule/create', {
    task_type: taskType, platform, payload, scheduled_at: scheduledAt,
  });
}

export async function engineListSchedules() {
  return engineRequest('schedule/list', {});
}

export async function engineDeleteSchedule(taskId: number) {
  return engineRequest('schedule/delete', { task_id: taskId });
}

// === Leads ===
export async function engineListLeads(platform?: string, status?: string) {
  return engineRequest('leads/list', { platform, status });
}

export async function engineAddLead(platform: string, username: string, notes?: string, tags?: string[]) {
  return engineRequest('leads/add', {
    platform, username, notes: notes || '', tags: JSON.stringify(tags || []),
  });
}

export async function engineDeleteLead(leadId: number) {
  return engineRequest('leads/delete', { lead_id: leadId });
}

// === Campaigns ===
export async function engineCreateCampaign(name: string, platform: string, targetList: string[], messageTemplate?: string, context?: string) {
  return engineRequest('campaigns/create', {
    name, platform, target_list: targetList,
    message_template: messageTemplate || '', context: context || '',
  });
}

export async function engineListCampaigns() {
  return engineRequest('campaigns/list', {});
}

export async function engineLaunchCampaign(campaignId: number) {
  return engineRequest('campaigns/launch', { campaign_id: campaignId });
}

// === Analytics ===
export async function engineGetAnalytics() {
  return engineRequest('analytics', {});
}

// === Dashboard ===
export async function engineGetDashboard() {
  return engineRequest('dashboard', {});
}

// === AI ===
export async function engineAIGenerate(promptType: string, context: string, extra?: string) {
  return engineRequest('ai/generate', {
    prompt_type: promptType, context, extra: extra || '',
  });
}

// === User Lookup ===
export async function engineUserLookup(platform: string, username: string) {
  return engineRequest('user/lookup', { platform, username });
}

export async function engineGetFollowers(username: string, amount?: number) {
  return engineRequest('user/followers', { username, amount: amount || 100 });
}

// === Session ===
export async function engineImportCookies(platform: string, cookies: any) {
  return engineRequest('import_cookies', {
    platform, cookies: typeof cookies === 'string' ? cookies : JSON.stringify(cookies),
  });
}

export async function engineKeepAlive(platform: string) {
  return engineRequest('keep_alive', { platform });
}

export async function engineReloginIG() {
  return engineRequest('ig/relogin', {});
}

// === Health ===
export async function engineHealth() {
  return engineRequest('health', {}, 'GET');
}
