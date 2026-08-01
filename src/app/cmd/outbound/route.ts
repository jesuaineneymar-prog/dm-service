// ============================================================
//  Aura OUTBOUND MESSAGING — Iniciar conversas novas
//  Motor principal: Zernio (IG + FB) com HikerAPI para pesquisa
//  Fallback: Upload-Post para Instagram DMs
// ============================================================

import { NextResponse } from 'next/server';
import {
  hikerSearchUsers,
  hikerGetUser,
  hikerGetFollowers,
  hikerSendDM,
  hikerSendDMByUsername,
  hikerGetComments,
} from '@/lib/external-apis';
import { zernioListAccounts, zernioSendOutboundDM } from '@/lib/zernio';
import { HIKERAPI_KEY, MANYCHAT_KEY, IG_USERNAME, OR_KEY, OR_URL, OR_FALLBACK_MODEL, UPLOADPOST_KEY } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

// === Zernio IDs ===
// Hardcoded to avoid extra API call (Vercel Hobby has 10s timeout)
var ZERNIO_PROFILE_ID = '6a6a5130412ea007831275dd';
var IG_ACCOUNT_ID = '6a6a51f5df17280d93d8a106';
var FB_ACCOUNT_ID = '6a6a51bcdf17280d93d89e06';
var _zernioAccountsLoaded = false;
var _zernioAccounts: { ig: string; fb: string } = { ig: IG_ACCOUNT_ID, fb: FB_ACCOUNT_ID };

async function getZernioAccounts() {
  if (_zernioAccountsLoaded) return _zernioAccounts;
  // Try to get fresh IDs from API (background refresh)
  try {
    var result = await zernioListAccounts();
    if (result.success && result.data?.accounts) {
      for (var i = 0; i < result.data.accounts.length; i++) {
        var acc = result.data.accounts[i];
        if (acc.platform === 'instagram') { _zernioAccounts.ig = acc._id; IG_ACCOUNT_ID = acc._id; }
        if (acc.platform === 'facebook') { _zernioAccounts.fb = acc._id; FB_ACCOUNT_ID = acc._id; }
      }
    }
  } catch (e: any) {
    console.error('Failed to refresh Zernio accounts:', e.message);
  }
  _zernioAccountsLoaded = true;
  return _zernioAccounts;
}

// === HELPER: Gerar mensagem personalizada com IA ===
async function generateOutboundMessage(context: string): Promise<string> {
  if (!OR_KEY) return 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
  try {
    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + OR_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OR_FALLBACK_MODEL,
      messages: [{
        role: 'system',
        content: 'Es uma agencia de marketing digital em Angola (Mwango Brain). Manda uma mensagem curta e amigavel em portugues. Maximo 2 frases. Nao menciones que es IA. Se natural e casual.',
      }, {
        role: 'user',
        content: 'Gera uma mensagem de saudacao/outreach para: ' + context,
      }],
      max_tokens: 100,
    }),
    });
    if (!res.ok) return 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
    var data = await res.json();
    return data.choices?.[0]?.message?.content || 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
  } catch (e: any) {
    return 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
  }
}

// === HELPER: Buscar usuarios aleatorios no Instagram ===
async function findRandomInstagramUsers(query: string, count: number) {
  if (!HIKERAPI_KEY) return { success: false, error: 'HIKERAPI_KEY nao configurada' };

  var searchResult = await hikerSearchUsers(HIKERAPI_KEY, query);
  if (!searchResult.success || !searchResult.data) {
    return { success: false, error: 'Erro na pesquisa: ' + (searchResult.error || 'desconhecido') };
  }

  var users = searchResult.data.users || searchResult.data.results || searchResult.data;
  if (!Array.isArray(users)) {
    users = users?.users || users?.data || [];
  }

  if (!Array.isArray(users) || users.length === 0) {
    return { success: false, error: 'Nenhum utilizador encontrado para "' + query + '"' };
  }

  var eligible = (users as any[]).filter(function(u: any) {
    return !u.is_private;
  });
  if (eligible.length === 0) eligible = (users as any[]);

  var shuffled = eligible.sort(function() { return 0.5 - Math.random(); });
  var selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return {
    success: true,
    users: selected.map(function(u: any) {
      return {
        pk: String(u.pk || u.id || u.user_id || ''),
        username: u.username || '',
        full_name: u.full_name || '',
        profile_pic_url: u.profile_pic_url || '',
        follower_count: u.follower_count || 0,
      };
    }),
  };
}

// === HELPER: Buscar seguidores de uma conta ===
async function findRandomFollowers(targetUsername: string, count: number) {
  if (!HIKERAPI_KEY) return { success: false, error: 'HIKERAPI_KEY nao configurada' };

  var targetUser = await hikerGetUser(HIKERAPI_KEY, targetUsername);
  if (!targetUser.success || !targetUser.data) {
    return { success: false, error: 'Nao consegui encontrar @' + targetUsername };
  }
  var targetId = targetUser.data.pk || targetUser.data.id;
  if (!targetId) return { success: false, error: 'Nao consegui extrair ID de @' + targetUsername };

  var followersResult = await hikerGetFollowers(HIKERAPI_KEY, String(targetId), count * 3);
  if (!followersResult.success || !followersResult.data) {
    return { success: false, error: 'Erro ao buscar seguidores: ' + (followersResult.error || 'desconhecido') };
  }

  var followers = followersResult.data.users || followersResult.data.results || followersResult.data;
  if (!Array.isArray(followers)) followers = followers?.users || [];
  if (!Array.isArray(followers) || followers.length === 0) {
    return { success: false, error: 'Nenhum seguidor encontrado para @' + targetUsername };
  }

  var shuffled = (followers as any[]).sort(function() { return 0.5 - Math.random(); });
  var selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return {
    success: true,
    users: selected.map(function(u: any) {
      return {
        pk: String(u.pk || u.id || u.user_id || ''),
        username: u.username || '',
        full_name: u.full_name || '',
        profile_pic_url: u.profile_pic_url || '',
      };
    }),
  };
}

// === HELPER: Enviar DM via Zernio (hardcoded IDs — no extra API call) ===
async function sendViaZernio(platform: string, recipientId: string, message: string, recipientUsername?: string) {
  var accountId = platform === 'facebook' ? FB_ACCOUNT_ID : IG_ACCOUNT_ID;
  var result = await zernioSendOutboundDM({
    accountId: accountId,
    recipientId: recipientId,
    message: message,
    platform: platform,
    recipientUsername: recipientUsername,
  });
  return result;
}

// === HELPER: Enviar DM via HikerAPI (fallback IG) ===
async function sendViaHikerAPI(recipientId: string, username: string, message: string) {
  if (!HIKERAPI_KEY) return { success: false, error: 'HIKERAPI_KEY nao configurada' };
  if (username && !recipientId) {
    return await hikerSendDMByUsername(HIKERAPI_KEY, username, message, UPLOADPOST_KEY);
  }
  return await hikerSendDM(HIKERAPI_KEY, { recipientUserId: recipientId, text: message, uploadPostKey: UPLOADPOST_KEY });
}

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== STATUS CHECK =====
  if (action === 'status') {
    var accounts = await getZernioAccounts();
    return NextResponse.json({
      success: true,
      type: 'outbound_status',
      instagram: {
        zernio: accounts.ig ? 'connected' : 'not_connected',
        hikerapi: !!HIKERAPI_KEY ? 'configured' : 'missing',
        zernio_account_id: accounts.ig || null,
        capabilities: [
          'search_users (hikerapi)',
          'get_followers (hikerapi)',
          'send_dm_outbound (zernio + hikerapi)',
          'get_comments (hikerapi)',
        ],
      },
      facebook: {
        zernio: accounts.fb ? 'connected' : 'not_connected',
        zernio_account_id: accounts.fb || null,
        manychat: !!MANYCHAT_KEY ? 'configured' : 'missing',
        capabilities: accounts.fb ? ['send_dm_outbound (zernio)'] : [],
      },
      available_actions: [
        'search_users - Pesquisar utilizadores no Instagram',
        'find_followers - Buscar seguidores de uma conta',
        'send_dm - Enviar DM outbound (Zernio + fallbacks)',
        'search_and_dm - Pesquisar + enviar DM automaticamente',
        'followers_and_dm - Seguidores de alvo + enviar DM',
        'commenters_to_dm - Comentadores de post -> enviar DM',
        'auto_comment_dm - COMENTAR-TO-DM: Aura comeca conversa com quem comentou',
        'manychat_send - Enviar DM via ManyChat (IG, FB, TikTok)',
        'fb_send_dm - Enviar DM outbound no Facebook via Zernio',
        'status - Verificar capacidades',
      ],
      manychat: {
        configured: !!MANYCHAT_KEY,
        key_prefix: MANYCHAT_KEY ? MANYCHAT_KEY.slice(0, 8) + '...' : 'not_set',
        capabilities: [
          'send_ig_dm - Instagram DM',
          'send_fb_dm - Facebook DM',
          'send_tt_dm - TikTok DM',
          'trigger_flow - Ativar fluxo de automacao',
          'list_flows - Listar fluxos',
        ],
      },
    });
  }

  // ===== SEARCH USERS (Instagram) =====
  if (action === 'search_users') {
    var query = body.query || 'Angola';
    var searchCount = body.count || 10;
    var result = await findRandomInstagramUsers(query, searchCount);
    if (!result.success) return NextResponse.json({ success: false, error: result.error });
    return NextResponse.json({
      success: true, type: 'outbound_search_results', platform: 'instagram',
      query: query, users_found: result.users.length, users: result.users,
    });
  }

  // ===== FIND RANDOM FOLLOWERS =====
  if (action === 'find_followers') {
    var tUser = body.username || IG_USERNAME || '';
    var fCount = body.count || 10;
    var fResult = await findRandomFollowers(tUser, fCount);
    if (!fResult.success) return NextResponse.json({ success: false, error: fResult.error });
    return NextResponse.json({
      success: true, type: 'outbound_followers', platform: 'instagram',
      target: tUser, followers_found: fResult.users.length, users: fResult.users,
    });
  }

  // ===== SEND OUTBOUND DM (multi-engine) =====
  if (action === 'send_dm') {
    var plat = body.platform || 'instagram';
    var recipId = body.userId || body.recipientUserId || '';
    var uname = body.username || '';
    var msgText = body.message || '';
    var method = body.method || 'zernio'; // zernio | hikerapi | auto

    if (!msgText) {
      msgText = await generateOutboundMessage('saudacao amigavel para utilizador de ' + plat + ' em Angola');
    }

    if (plat === 'instagram') {
      // Try Zernio first (most reliable for Business accounts)
      if (method === 'zernio' || method === 'auto') {
        // When using Zernio with username, skip HikerAPI resolution
        // Zernio's create_conversation accepts participantUsername directly
        if (method === 'zernio' && uname && !recipId) {
          // Pass empty string as ID, Zernio will use participantUsername instead
          recipId = '';
        } else if (uname && !recipId) {
          // Auto mode: resolve via HikerAPI
          if (HIKERAPI_KEY) {
            var resolveRes = await hikerGetUser(HIKERAPI_KEY, uname);
            if (resolveRes.success && resolveRes.data) {
              recipId = String(resolveRes.data.pk || resolveRes.data.id || '');
            }
          }
          if (!recipId) {
            return NextResponse.json({ success: false, error: 'Nao consegui resolver @' + uname + ' para ID. Tenta com userId numerico.' });
          }
        }
        var zernioResult = await sendViaZernio('instagram', recipId, msgText, uname);
        if (zernioResult.success) {
          return NextResponse.json({
            success: true, type: 'outbound_dm_sent', platform: 'instagram',
            method: zernioResult.method || 'zernio',
            recipient: uname || recipId, message: msgText, data: zernioResult.data,
          });
        }
        // Zernio failed, try HikerAPI as fallback
        if (method === 'auto') {
          var hikerFallback = await sendViaHikerAPI(recipId, uname, msgText);
          if (hikerFallback.success) {
            return NextResponse.json({
              success: true, type: 'outbound_dm_sent', platform: 'instagram',
              method: 'hikerapi_fallback', recipient: uname || recipId, message: msgText, data: hikerFallback.data,
            });
          }
          return NextResponse.json({
            success: false,
            error: 'Zernio e HikerAPI falharam. Zernio: ' + (zernioResult.error || '') + ' | HikerAPI: ' + (hikerFallback.error || ''),
          });
        }
        return NextResponse.json({ success: false, error: 'Zernio falhou: ' + (zernioResult.error || '') });
      }

      // HikerAPI only
      if (method === 'hikerapi') {
        var dmResult = await sendViaHikerAPI(recipId, uname, msgText);
        if (!dmResult.success) return NextResponse.json({ success: false, error: 'Erro HikerAPI: ' + dmResult.error });
        return NextResponse.json({
          success: true, type: 'outbound_dm_sent', platform: 'instagram',
          method: 'hikerapi', recipient: uname || recipId, message: msgText, data: dmResult.data,
        });
      }
    }

    // ===== FACEBOOK OUTBOUND via Zernio =====
    if (plat === 'facebook') {
      if (!recipId) {
        return NextResponse.json({ success: false, error: 'Facebook outbound necessita userId numerico (recipientUserId). Exemplo: userId do Facebook da pessoa.' });
      }
      var fbZernioResult = await sendViaZernio('facebook', recipId, msgText);
      if (fbZernioResult.success) {
        return NextResponse.json({
          success: true, type: 'outbound_dm_sent', platform: 'facebook',
          method: fbZernioResult.method || 'zernio',
          recipient: recipId, message: msgText, data: fbZernioResult.data,
        });
      }
      // ManyChat fallback
      if (MANYCHAT_KEY) {
        var { mcSendDM } = await import('@/lib/external-apis');
        var fbMcResult = await mcSendDM(MANYCHAT_KEY, { platform: 'facebook', userId: recipId, message: msgText });
        if (fbMcResult.success) {
          return NextResponse.json({
            success: true, type: 'outbound_dm_sent', platform: 'facebook',
            method: 'manychat', recipient: recipId, message: msgText, data: fbMcResult.data,
          });
        }
      }
      return NextResponse.json({
        success: false,
        error: 'Facebook DM falhou via Zernio: ' + (fbZernioResult.error || '') +
          (!MANYCHAT_KEY ? ' | ManyChat nao configurado (adiciona MANYCHAT_API_KEY no Vercel)' : ''),
      });
    }

    return NextResponse.json({ success: false, error: 'Plataforma nao suportada: ' + plat });
  }

  // ===== FACEBOOK SEND DM (shortcut) =====
  if (action === 'fb_send_dm') {
    var fbRecipientId = body.userId || body.recipientUserId || '';
    var fbMessage = body.message || '';
    if (!fbRecipientId) {
      return NextResponse.json({ success: false, error: 'userId necessario para Facebook DM' });
    }
    if (!fbMessage) {
      fbMessage = await generateOutboundMessage('saudacao amigavel para utilizador de Facebook em Angola');
    }
    var fbResult = await sendViaZernio('facebook', fbRecipientId, fbMessage);
    if (fbResult.success) {
      return NextResponse.json({
        success: true, type: 'outbound_dm_sent', platform: 'facebook',
        method: fbResult.method || 'zernio',
        recipient: fbRecipientId, message: fbMessage, data: fbResult.data,
      });
    }
    return NextResponse.json({ success: false, error: 'Facebook DM falhou: ' + (fbResult.error || '') });
  }

  // ===== SEARCH AND DM (Pipeline completa — Instagram) =====
  if (action === 'search_and_dm') {
    var sQuery = body.query || 'marketing Angola';
    var sCount = body.count || 3;
    var sMsg = body.message || '';
    var sMethod = body.method || 'auto';

    var searchRes = await findRandomInstagramUsers(sQuery, sCount);
    if (!searchRes.success || !searchRes.users || searchRes.users.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum utilizador encontrado: ' + (searchRes.error || 'tente outra query') });
    }

    var results: any[] = [];
    for (var i = 0; i < searchRes.users.length; i++) {
      var usr = searchRes.users[i];
      if (!usr.pk) { results.push({ username: usr.username, success: false, error: 'Sem ID' }); continue; }
      var text = sMsg || await generateOutboundMessage('saudacao para @' + usr.username + ' interessado em ' + sQuery);

      // Try Zernio first
      var sendRes = await sendViaZernio('instagram', usr.pk, text);
      if (!sendRes.success && (sMethod === 'auto' || sMethod === 'hikerapi')) {
        sendRes = await sendViaHikerAPI(usr.pk, usr.username, text);
      }

      results.push({
        username: usr.username, full_name: usr.full_name,
        success: sendRes.success, method: sendRes.method || 'unknown',
        message: text, error: sendRes.success ? undefined : sendRes.error,
      });
      if (i < searchRes.users.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }

    return NextResponse.json({
      success: true, type: 'outbound_search_and_dm', platform: 'instagram',
      query: sQuery, total_attempted: results.length,
      total_sent: results.filter(function(r) { return r.success; }).length,
      results: results,
    });
  }

  // ===== FOLLOWERS AND DM =====
  if (action === 'followers_and_dm') {
    var tUname = body.username || body.target || IG_USERNAME || '';
    var fdCount = body.count || 3;
    var fdMsg = body.message || '';
    var fdMethod = body.method || 'auto';

    var fRes = await findRandomFollowers(tUname, fdCount);
    if (!fRes.success || !fRes.users || fRes.users.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum seguidor: ' + (fRes.error || 'sem seguidores acessiveis') });
    }

    var fRes2: any[] = [];
    for (var j = 0; j < fRes.users.length; j++) {
      var fu = fRes.users[j];
      if (!fu.pk) { fRes2.push({ username: fu.username, success: false, error: 'Sem ID' }); continue; }
      var ftxt = fdMsg || await generateOutboundMessage('saudacao para @' + fu.username + ' seguidor de @' + tUname);

      // Try Zernio first
      var fsr = await sendViaZernio('instagram', fu.pk, ftxt);
      if (!fsr.success && (fdMethod === 'auto' || fdMethod === 'hikerapi')) {
        fsr = await sendViaHikerAPI(fu.pk, fu.username, ftxt);
      }

      fRes2.push({
        username: fu.username, full_name: fu.full_name,
        success: fsr.success, method: fsr.method || 'unknown',
        message: ftxt, error: fsr.success ? undefined : fsr.error,
      });
      if (j < fRes.users.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }

    return NextResponse.json({
      success: true, type: 'outbound_followers_and_dm', platform: 'instagram',
      target: tUname, total_attempted: fRes2.length,
      total_sent: fRes2.filter(function(r) { return r.success; }).length,
      results: fRes2,
    });
  }

  // ===== COMMENTERS TO DM =====
  if (action === 'commenters_to_dm') {
    var mId = body.mediaId || '';
    var cCount = body.count || 5;
    var cMsg = body.message || '';
    var cMethod = body.method || 'auto';

    if (!HIKERAPI_KEY) return NextResponse.json({ success: false, error: 'HIKERAPI_KEY nao configurada' });
    if (!mId) return NextResponse.json({ success: false, error: 'mediaId necessario' });

    var commRes = await hikerGetComments(HIKERAPI_KEY, mId, cCount * 2);
    if (!commRes.success || !commRes.data) {
      return NextResponse.json({ success: false, error: 'Erro ao buscar comentarios: ' + (commRes.error || '') });
    }
    var comms = commRes.data.comments || commRes.data;
    if (!Array.isArray(comms) || comms.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum comentario encontrado' });
    }

    var cResults: any[] = [];
    var cShuffled = (comms as any[]).sort(function() { return 0.5 - Math.random(); });
    var toDm = cShuffled.slice(0, Math.min(cCount, cShuffled.length));

    for (var k = 0; k < toDm.length; k++) {
      var c = toDm[k];
      var cUid = String(c.user?.pk || c.user?.id || c.user_id || '');
      var cUname = c.user?.username || c.username || 'unknown';
      if (!cUid) { cResults.push({ username: cUname, success: false, error: 'Sem ID' }); continue; }
      var ctxt = cMsg || await generateOutboundMessage('responder ao comentario de @' + cUname);

      var csr = await sendViaZernio('instagram', cUid, ctxt);
      if (!csr.success && (cMethod === 'auto' || cMethod === 'hikerapi')) {
        csr = await sendViaHikerAPI(cUid, cUname, ctxt);
      }

      cResults.push({
        username: cUname, success: csr.success, method: csr.method || 'unknown',
        message: ctxt, error: csr.success ? undefined : csr.error,
      });
      if (k < toDm.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }

    return NextResponse.json({
      success: true, type: 'outbound_commenters_dm', platform: 'instagram',
      mediaId: mId, total_attempted: cResults.length,
      total_sent: cResults.filter(function(r) { return r.success; }).length,
      results: cResults,
    });
  }

  // ===== COMMENT-TO-DM AUTOMATICO (Aura comeca conversa) =====
  if (action === 'auto_comment_dm') {
    var aMediaId = body.mediaId || '';
    var aMessage = body.message || '';
    var aCount = body.count || 10;

    if (!aMediaId && HIKERAPI_KEY) {
      // Se nao passou mediaId, buscar o post mais recente
      var selfU = IG_USERNAME || '';
      if (selfU) {
        var selfRes = await hikerGetUser(HIKERAPI_KEY, selfU);
        if (selfRes.success && selfRes.data) {
          var selfMedias = selfRes.data?.medias || selfRes.data?.media?.data || [];
          if (Array.isArray(selfMedias) && selfMedias.length > 0) {
            aMediaId = String(selfMedias[0].id || selfMedias[0].pk || '');
          }
        }
      }
    }

    if (!aMediaId) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum mediaId fornecido e nao consegui encontrar posts recentes. Passa mediaId manualmente.',
      });
    }

    // Buscar comentarios
    var aCommRes = await hikerGetComments(HIKERAPI_KEY, aMediaId, aCount * 2);
    if (!aCommRes.success) {
      return NextResponse.json({ success: false, error: 'Erro ao buscar comentarios: ' + (aCommRes.error || '') });
    }
    var aComms = aCommRes.data?.comments || aCommRes.data;
    if (!Array.isArray(aComms) || aComms.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum comentario encontrado neste post' });
    }

    var aResults: any[] = [];
    for (var ai = 0; ai < aComms.length && aResults.length < aCount; ai++) {
      var ac = aComms[ai];
      var acUid = String(ac.user?.pk || ac.user?.id || '');
      var acUname = ac.user?.username || '';
      var acText = ac.text || ac.content || '';
      if (!acUid || !acUname) continue;

      var acMsg = aMessage || await generateOutboundMessage('responder ao comentario de @' + acUname + ': ' + acText);
      var acResult = await sendViaZernio('instagram', acUid, acMsg, acUname);

      aResults.push({
        username: acUname,
        comment: acText.slice(0, 80),
        dmSent: acMsg.slice(0, 80),
        success: acResult.success,
        method: acResult.method || 'zernio',
        error: acResult.success ? undefined : acResult.error,
      });

      if (ai < aComms.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }

    return NextResponse.json({
      success: true,
      type: 'auto_comment_to_dm',
      description: 'Aura iniciou conversas com comentadores automaticamente!',
      mediaId: aMediaId,
      total_commenters: aResults.length,
      dms_sent: aResults.filter(function(r) { return r.success; }).length,
      results: aResults,
    });
  }

  // ===== MANYCHAT SEND (via ManyChat API) =====
  if (action === 'manychat_send') {
    var mcPlatform = body.platform || 'instagram';
    var mcSubId = body.subscriberId || '';
    var mcMsg = body.message || '';

    if (!MANYCHAT_KEY) return NextResponse.json({ success: false, error: 'ManyChat nao configurado' });
    if (!mcSubId) return NextResponse.json({ success: false, error: 'subscriberId necessario para ManyChat' });
    if (!mcMsg) mcMsg = await generateOutboundMessage('saudacao via ManyChat');

    var { mcSendInstagramDM, mcSendFacebookDM, mcSendTikTokDM } = await import('@/lib/manychat');
    var mcResult: any;
    if (mcPlatform === 'facebook') {
      mcResult = await mcSendFacebookDM({ subscriberId: mcSubId, message: mcMsg });
    } else if (mcPlatform === 'tiktok') {
      mcResult = await mcSendTikTokDM({ subscriberId: mcSubId, message: mcMsg });
    } else {
      mcResult = await mcSendInstagramDM({ subscriberId: mcSubId, message: mcMsg });
    }

    if (mcResult.success) {
      return NextResponse.json({
        success: true, type: 'manychat_dm_sent',
        platform: mcPlatform, subscriberId: mcSubId, message: mcMsg,
        data: mcResult.data,
      });
    }
    return NextResponse.json({ success: false, error: 'ManyChat falhou: ' + (mcResult.error || '') });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
