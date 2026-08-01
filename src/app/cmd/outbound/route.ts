// ============================================================
//  Aura OUTBOUND MESSAGING — Iniciar conversas novas
//  Instagram: HikerAPI (pesquisa + DM outbound)
//  Facebook: ManyChat (se disponivel) ou Zernio broadcast
// ============================================================

import { NextResponse } from 'next/server';
import {
  hikerSearchUsers,
  hikerGetUser,
  hikerGetFollowers,
  hikerSendDM,
  hikerSendDMByUsername,
  hikerGetComments,
  mcSendDM,
} from '@/lib/external-apis';
import { HIKERAPI_KEY, MANYCHAT_KEY, IG_USERNAME, OR_KEY, OR_URL, OR_FALLBACK_MODEL } from '@/lib/config';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

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

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== STATUS CHECK =====
  if (action === 'status') {
    return NextResponse.json({
      success: true,
      type: 'outbound_status',
      instagram: {
        hikerapi: !!HIKERAPI_KEY ? 'configured' : 'missing',
        capabilities: HIKERAPI_KEY ? ['search_users', 'get_followers', 'send_dm_outbound', 'get_comments'] : [],
      },
      facebook: {
        manychat: !!MANYCHAT_KEY ? 'configured' : 'missing',
        note: MANYCHAT_KEY ? 'ManyChat disponivel para FB outbound' : 'Facebook outbound requer MANYCHAT_API_KEY',
      },
      available_actions: [
        'search_users - Pesquisar utilizadores no Instagram',
        'find_followers - Buscar seguidores de uma conta',
        'send_dm - Enviar DM outbound (userId ou username)',
        'search_and_dm - Pesquisar + enviar DM automaticamente',
        'followers_and_dm - Seguidores de alvo + enviar DM',
        'commenters_to_dm - Comentadores de post -> enviar DM',
        'status - Verificar capacidades',
      ],
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

  // ===== SEND OUTBOUND DM =====
  if (action === 'send_dm') {
    var plat = body.platform || 'instagram';
    var recipId = body.userId || body.recipientUserId || '';
    var uname = body.username || '';
    var msgText = body.message || '';

    if (!msgText) {
      msgText = await generateOutboundMessage('saudacao amigavel para utilizador de Instagram em Angola');
    }

    if (plat === 'instagram') {
      if (!HIKERAPI_KEY) return NextResponse.json({ success: false, error: 'HIKERAPI_KEY nao configurada no Vercel' });
      var dmResult;
      if (uname && !recipId) {
        dmResult = await hikerSendDMByUsername(HIKERAPI_KEY, uname, msgText);
      } else if (recipId) {
        dmResult = await hikerSendDM(HIKERAPI_KEY, { recipientUserId: recipId, text: msgText });
      } else {
        return NextResponse.json({ success: false, error: 'userId ou username necessario' });
      }
      if (!dmResult.success) return NextResponse.json({ success: false, error: 'Erro ao enviar DM: ' + dmResult.error });
      return NextResponse.json({
        success: true, type: 'outbound_dm_sent', platform: 'instagram',
        recipient: uname || recipId, message: msgText, data: dmResult.data,
      });
    }

    if (plat === 'facebook') {
      if (MANYCHAT_KEY && recipId) {
        var fbResult = await mcSendDM(MANYCHAT_KEY, { platform: 'facebook', userId: recipId, message: msgText });
        if (fbResult.success) {
          return NextResponse.json({ success: true, type: 'outbound_dm_sent', platform: 'facebook', method: 'manychat', recipient: recipId, message: msgText });
        }
        return NextResponse.json({ success: false, error: 'ManyChat falhou: ' + fbResult.error });
      }
      return NextResponse.json({
        success: false,
        error: 'Facebook outbound DM necessita ManyChat API key. Zernio so responde a conversas existentes.',
        solution: '1. Cria conta em manychat.com (gratis)\n2. Conecta tua pagina do Facebook\n3. Settings > API > copia a key\n4. Adiciona MANYCHAT_API_KEY no Vercel',
      });
    }

    return NextResponse.json({ success: false, error: 'Plataforma nao suportada: ' + plat });
  }

  // ===== SEARCH AND DM (Pipeline completa) =====
  if (action === 'search_and_dm') {
    var sQuery = body.query || 'marketing Angola';
    var sCount = body.count || 3;
    var sMsg = body.message || '';

    if (!HIKERAPI_KEY) return NextResponse.json({ success: false, error: 'HIKERAPI_KEY nao configurada' });

    var searchRes = await findRandomInstagramUsers(sQuery, sCount);
    if (!searchRes.success || !searchRes.users || searchRes.users.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum utilizador encontrado: ' + (searchRes.error || 'tente outra query') });
    }

    var results: any[] = [];
    for (var i = 0; i < searchRes.users.length; i++) {
      var usr = searchRes.users[i];
      if (!usr.pk) { results.push({ username: usr.username, success: false, error: 'Sem ID' }); continue; }
      var text = sMsg || await generateOutboundMessage('saudacao para @' + usr.username + ' interessado em ' + sQuery);
      var sendRes = await hikerSendDM(HIKERAPI_KEY, { recipientUserId: usr.pk, text: text });
      results.push({ username: usr.username, full_name: usr.full_name, success: sendRes.success, message: text, error: sendRes.success ? undefined : sendRes.error });
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

    if (!HIKERAPI_KEY) return NextResponse.json({ success: false, error: 'HIKERAPI_KEY nao configurada' });

    var fRes = await findRandomFollowers(tUname, fdCount);
    if (!fRes.success || !fRes.users || fRes.users.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhum seguidor: ' + (fRes.error || 'sem seguidores acessiveis') });
    }

    var fRes2: any[] = [];
    for (var j = 0; j < fRes.users.length; j++) {
      var fu = fRes.users[j];
      if (!fu.pk) { fRes2.push({ username: fu.username, success: false, error: 'Sem ID' }); continue; }
      var ftxt = fdMsg || await generateOutboundMessage('saudacao para @' + fu.username + ' seguidor de @' + tUname);
      var fsr = await hikerSendDM(HIKERAPI_KEY, { recipientUserId: fu.pk, text: ftxt });
      fRes2.push({ username: fu.username, full_name: fu.full_name, success: fsr.success, message: ftxt, error: fsr.success ? undefined : fsr.error });
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
      var csr = await hikerSendDM(HIKERAPI_KEY, { recipientUserId: cUid, text: ctxt });
      cResults.push({ username: cUname, success: csr.success, message: ctxt, error: csr.success ? undefined : csr.error });
      if (k < toDm.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }

    return NextResponse.json({
      success: true, type: 'outbound_commenters_dm', platform: 'instagram',
      mediaId: mId, total_attempted: cResults.length,
      total_sent: cResults.filter(function(r) { return r.success; }).length,
      results: cResults,
    });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
