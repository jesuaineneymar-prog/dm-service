// ============================================================
//  Aura OUTBOUND MESSAGING — Iniciar conversas novas
//  Motor principal: Zernio (IG + FB)
//  Pesquisa: Zernio Audience + ScrapingBee
//  Fallback: ManyChat, Meta Graph API
// ============================================================

import { NextResponse } from 'next/server';
import { zernioListAccounts, zernioSendOutboundDM, zernioGetAudience, zernioGetContacts } from '@/lib/zernio';
import { sbGetIGComments, sbGetIGProfile } from '@/lib/external-apis';
import { MANYCHAT_KEY, IG_USERNAME, OR_KEY, OR_URL, OR_FALLBACK_MODEL, UPLOADPOST_KEY, BROWSERLESS_ENDPOINT } from '@/lib/config';
import { requireAuth } from '@/lib/auth';
import { metaSendDM } from '@/lib/meta-graph';

export var maxDuration = 300;

// === Zernio Account IDs ===
var IG_ACCOUNT_ID = '6a6a51f5df17280d93d8a106';
var FB_ACCOUNT_ID = '6a6a51bcdf17280d93d89e06';
var _zernioAccountsLoaded = false;
var _zernioAccounts: { ig: string; fb: string } = { ig: IG_ACCOUNT_ID, fb: FB_ACCOUNT_ID };

async function getZernioAccounts() {
  if (_zernioAccountsLoaded) return _zernioAccounts;
  try {
    var result = await zernioListAccounts();
    if (result.success && result.data?.accounts) {
      for (var i = 0; i < result.data.accounts.length; i++) {
        var acc = result.data.accounts[i];
        if (acc.platform === 'instagram') { _zernioAccounts.ig = acc._id; IG_ACCOUNT_ID = acc._id; }
        if (acc.platform === 'facebook') { _zernioAccounts.fb = acc._id; FB_ACCOUNT_ID = acc._id; }
      }
    }
  } catch (e: any) { console.error('Zernio accounts refresh:', e.message); }
  _zernioAccountsLoaded = true;
  return _zernioAccounts;
}

// === HELPER: Gerar mensagem personalizada com IA ===
async function generateOutboundMessage(context: string): Promise<string> {
  if (!OR_KEY) return 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
  try {
    var res = await fetch(OR_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OR_FALLBACK_MODEL,
        messages: [
          { role: 'system', content: 'Es uma agencia de marketing digital em Angola (Mwango Brain). Manda uma mensagem curta e amigavel em portugues. Maximo 2 frases. Nao menciones que es IA. Se natural e casual.' },
          { role: 'user', content: 'Gera uma mensagem de saudacao/outreach para: ' + context },
        ],
        max_tokens: 100,
      }),
    });
    if (!res.ok) return 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
    var data = await res.json();
    return data.choices?.[0]?.message?.content || 'Ola! Tudo bem? Vi teu perfil e achei interessante!';
  } catch (e: any) { return 'Ola! Tudo bem? Vi teu perfil e achei interessante!'; }
}

// === HELPER: Buscar audience via Zernio ===
async function findUsersViaZernio(accountId: string, count: number) {
  var audienceRes = await zernioGetAudience(accountId, { type: 'followers', limit: count * 3 });
  if (!audienceRes.success) return { success: false, error: audienceRes.error };
  var items = audienceRes.data?.data || audienceRes.data?.items || audienceRes.data;
  if (!Array.isArray(items)) return { success: false, error: 'Formato de audience inesperado' };
  var shuffled = items.sort(function() { return 0.5 - Math.random(); });
  return { success: true, users: shuffled.slice(0, count).map(function(u: any) {
    return { pk: String(u.id || u.pk || u.igSid || ''), username: u.username || '', full_name: u.fullName || u.full_name || '', profile_pic_url: u.profilePicUrl || u.profile_pic_url || '' };
  }) };
}

// === HELPER: Buscar contatos via Zernio ===
async function findContactsViaZernio(count: number) {
  var contactsRes = await zernioGetContacts({ limit: count * 3 });
  if (!contactsRes.success) return { success: false, error: contactsRes.error };
  var items = contactsRes.data?.data || contactsRes.data?.contacts || contactsRes.data;
  if (!Array.isArray(items)) return { success: false, error: 'Formato de contatos inesperado' };
  var shuffled = items.sort(function() { return 0.5 - Math.random(); });
  return { success: true, users: shuffled.slice(0, count).map(function(u: any) {
    return { pk: String(u.id || u.pk || u.igSid || u.recipientId || ''), username: u.username || u.name || '', full_name: u.fullName || u.name || '', profile_pic_url: u.profilePicUrl || '' };
  }) };
}

// === HELPER: Enviar DM via Zernio ===
async function sendViaZernio(platform: string, recipientId: string, message: string, recipientUsername?: string) {
  var accountId = platform === 'facebook' ? FB_ACCOUNT_ID : IG_ACCOUNT_ID;
  return await zernioSendOutboundDM({ accountId, recipientId, message, platform, recipientUsername });
}

// === HELPER: Enviar DM via Meta Graph API (proactive) ===
async function sendViaMetaGraph(platform: 'instagram' | 'facebook', recipientId: string, message: string) {
  return await metaSendDM({ platform, recipientId, message, skipPacing: true });
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
      success: true, type: 'outbound_status',
      instagram: { zernio: accounts.ig ? 'connected' : 'not_connected', zernio_account_id: accounts.ig || null, capabilities: ['send_dm_outbound (zernio)', 'get_audience (zernio)', 'get_contacts (zernio)'] },
      facebook: { zernio: accounts.fb ? 'connected' : 'not_connected', zernio_account_id: accounts.fb || null, meta_graph: 'available', capabilities: ['send_dm_outbound (zernio)', 'send_dm_proactive (meta_graph)'] },
      scraping: { scrapingbee: 'available', capabilities: ['scrape_profile', 'scrape_comments', 'google_search'] },
      available_actions: ['send_dm', 'fb_send_dm', 'search_and_dm', 'audience_and_dm', 'contacts_and_dm', 'status'],
    });
  }

  // ===== SEND OUTBOUND DM =====
  if (action === 'send_dm') {
    var plat = body.platform || 'instagram';
    var recipId = body.userId || body.recipientUserId || '';
    var uname = body.username || '';
    var msgText = body.message || '';
    if (!msgText) msgText = await generateOutboundMessage('saudacao amigavel para utilizador de ' + plat + ' em Angola');

    if (plat === 'instagram') {
      if (!uname && !recipId) return NextResponse.json({ success: false, error: 'username ou userId necessario' });
      var zernioResult = await sendViaZernio('instagram', recipId || '', msgText, uname || undefined);
      if (zernioResult.success) return NextResponse.json({ success: true, type: 'outbound_dm_sent', platform: 'instagram', method: zernioResult.method || 'zernio', recipient: uname || recipId, message: msgText, data: zernioResult.data });
      return NextResponse.json({ success: false, error: 'Zernio falhou: ' + (zernioResult.error || '') });
    }

    if (plat === 'facebook') {
      if (!recipId) return NextResponse.json({ success: false, error: 'Facebook outbound necessita userId numerico' });
      var fbResult = await sendViaZernio('facebook', recipId, msgText);
      if (fbResult.success) return NextResponse.json({ success: true, type: 'outbound_dm_sent', platform: 'facebook', method: fbResult.method || 'zernio', recipient: recipId, message: msgText, data: fbResult.data });
      // Try Meta Graph as fallback
      var metaResult = await sendViaMetaGraph('facebook', recipId, msgText);
      if (metaResult.success) return NextResponse.json({ success: true, type: 'outbound_dm_sent', platform: 'facebook', method: 'meta_graph', recipient: recipId, message: msgText, data: metaResult.data });
      return NextResponse.json({ success: false, error: 'Facebook DM falhou: ' + (fbResult.error || '') });
    }

    return NextResponse.json({ success: false, error: 'Plataforma nao suportada: ' + plat });
  }

  // ===== FACEBOOK SEND DM (shortcut) =====
  if (action === 'fb_send_dm') {
    var fbRecipientId = body.userId || body.recipientUserId || '';
    var fbMessage = body.message || '';
    if (!fbRecipientId) return NextResponse.json({ success: false, error: 'userId necessario para Facebook DM' });
    if (!fbMessage) fbMessage = await generateOutboundMessage('saudacao amigavel para utilizador de Facebook em Angola');
    var fbRes = await sendViaZernio('facebook', fbRecipientId, fbMessage);
    if (fbRes.success) return NextResponse.json({ success: true, type: 'outbound_dm_sent', platform: 'facebook', method: 'zernio', recipient: fbRecipientId, message: fbMessage, data: fbRes.data });
    return NextResponse.json({ success: false, error: 'Facebook DM falhou: ' + (fbRes.error || '') });
  }

  // ===== SEARCH AND DM (via Zernio audience) =====
  if (action === 'search_and_dm') {
    var sCount = body.count || 3;
    var sMsg = body.message || '';
    var accounts = await getZernioAccounts();
    var searchRes = await findUsersViaZernio(accounts.ig, sCount);
    if (!searchRes.success || !searchRes.users || searchRes.users.length === 0) return NextResponse.json({ success: false, error: 'Nenhum utilizador encontrado: ' + (searchRes.error || 'sem audience disponivel') });

    var results: any[] = [];
    for (var i = 0; i < searchRes.users.length; i++) {
      var usr = searchRes.users[i];
      var text = sMsg || await generateOutboundMessage('saudacao para @' + usr.username + ' da Mwango Brain');
      var sendRes = await sendViaZernio('instagram', usr.pk, text, usr.username);
      results.push({ username: usr.username, full_name: usr.full_name, success: sendRes.success, method: sendRes.method || 'zernio', message: text, error: sendRes.success ? undefined : sendRes.error });
      if (i < searchRes.users.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }
    return NextResponse.json({ success: true, type: 'outbound_search_and_dm', platform: 'instagram', total_attempted: results.length, total_sent: results.filter(function(r) { return r.success; }).length, results });
  }

  // ===== AUDIENCE AND DM (followers via Zernio) =====
  if (action === 'audience_and_dm' || action === 'followers_and_dm') {
    var fdCount = body.count || 3;
    var fdMsg = body.message || '';
    var accounts2 = await getZernioAccounts();
    var fRes = await findUsersViaZernio(accounts2.ig, fdCount);
    if (!fRes.success || !fRes.users || fRes.users.length === 0) return NextResponse.json({ success: false, error: 'Nenhum seguidor: ' + (fRes.error || 'sem audience') });

    var fResults: any[] = [];
    for (var j = 0; j < fRes.users.length; j++) {
      var fu = fRes.users[j];
      var ftxt = fdMsg || await generateOutboundMessage('saudacao para @' + fu.username + ' seguidor nosso');
      var fsr = await sendViaZernio('instagram', fu.pk, ftxt, fu.username);
      fResults.push({ username: fu.username, full_name: fu.full_name, success: fsr.success, method: fsr.method || 'zernio', message: ftxt, error: fsr.success ? undefined : fsr.error });
      if (j < fRes.users.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }
    return NextResponse.json({ success: true, type: 'outbound_audience_and_dm', platform: 'instagram', total_attempted: fResults.length, total_sent: fResults.filter(function(r) { return r.success; }).length, results: fResults });
  }

  // ===== CONTACTS AND DM (people who chatted before) =====
  if (action === 'contacts_and_dm') {
    var ccCount = body.count || 3;
    var ccMsg = body.message || '';
    var cContacts = await findContactsViaZernio(ccCount);
    if (!cContacts.success || !cContacts.users || cContacts.users.length === 0) return NextResponse.json({ success: false, error: 'Nenhum contato: ' + (cContacts.error || 'sem contatos') });

    var ccResults: any[] = [];
    for (var ci = 0; ci < cContacts.users.length; ci++) {
      var cc = cContacts.users[ci];
      var cctxt = ccMsg || await generateOutboundMessage('seguir conversa com ' + cc.username);
      var ccsr = await sendViaZernio('instagram', cc.pk, cctxt, cc.username);
      ccResults.push({ username: cc.username, full_name: cc.full_name, success: ccsr.success, method: ccsr.method || 'zernio', message: cctxt, error: ccsr.success ? undefined : ccsr.error });
      if (ci < cContacts.users.length - 1) await new Promise(function(r) { setTimeout(r, 3000); });
    }
    return NextResponse.json({ success: true, type: 'outbound_contacts_and_dm', platform: 'instagram', total_attempted: ccResults.length, total_sent: ccResults.filter(function(r) { return r.success; }).length, results: ccResults });
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
