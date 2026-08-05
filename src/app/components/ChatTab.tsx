'use client';
import { useState, useEffect, useRef } from 'react';
import { uid, ft, apiCall, sg, ss, sd, getProspects } from './ui';

// ===== TAB 1: CHAT =====
export function ChatTab({ onLogout }: { onLogout: () => void }) {
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; ts: string }[]>(() => {
    try { var r = sg('jch', ''); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [auth, setAuthState] = useState(() => {
    try { var r = sg('jc', ''); return r ? JSON.parse(r) : { ig: false, fb: false, tt: false }; } catch(e) { return { ig: false, fb: false, tt: false }; }
  });
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);
  useEffect(() => { ss('jch', JSON.stringify(chatHistory.slice(-60))); }, [chatHistory]);
  useEffect(() => {
    var start = Date.now();
    var t = setInterval(() => { setUptime(Math.floor((Date.now() - start) / 1000)); }, 1000);
    return () => clearInterval(t);
  }, []);

  var connectedCount = (auth.ig ? 1 : 0) + (auth.fb ? 1 : 0) + (auth.tt ? 1 : 0);
  var prospectCount = getProspects().length;
  var fmtUp = () => { var m = Math.floor(uptime / 60); var s = uptime % 60; return m > 0 ? m + 'm' + s + 's' : s + 's'; };

  const getSessions = () => { try { var r = sg('jsessions', ''); return r ? JSON.parse(r) : {}; } catch(e) { return {}; } };
  const saveSessions = (s: any) => { ss('jsessions', JSON.stringify(s)); };

  const callJarvis = async (action: string, extra: any = {}) => {
    var creds = getSessions();
    var prosps = getProspects();
    var res = await fetch('/cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') },
      body: JSON.stringify({ action, credentials: creds, prospects: prosps, ...extra }),
    }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (res && res.sessions) saveSessions(res.sessions);
    return res;
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    var msg = input.trim(); setInput('');
    setChatHistory(h => [...h, { role: 'user', content: msg, ts: new Date().toISOString() }]);
    setLoading(true);

    var cmd = msg.toLowerCase().trim();
    var reply = '';

    if (cmd.includes('entra') || cmd.includes('login') || cmd.includes('conectar')) {
      var plats = 'all';
      if (cmd.includes('instagram') || cmd.includes(' ig')) plats = 'instagram';
      else if (cmd.includes('facebook') || cmd.includes(' fb')) plats = 'facebook';
      else if (cmd.includes('tiktok') || cmd.includes(' tt') || cmd.includes('tic')) plats = 'tiktok';
      reply = 'A tentar login no ' + (plats === 'all' ? 'todas as plataformas' : plats.toUpperCase()) + '...\nIsso pode demorar 10-20s.';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var res = await callJarvis('login', { platform: plats });
      if (!res) { reply = 'Erro de conexao.'; }
      else {
        var parts: string[] = [];
        if (res.results?.ig) { if (res.results.ig.success) { parts.push('Instagram: CONECTADO (' + (res.results.ig.userId || '') + ')'); setAuthState((a: any) => ({...a, ig: true})); } else parts.push('Instagram: FALHOU — ' + (res.results.ig.error || '?')); }
        if (res.results?.fb) { if (res.results.fb.success) { parts.push('Facebook: CONECTADO'); setAuthState((a: any) => ({...a, fb: true})); } else parts.push('Facebook: FALHOU — ' + (res.results.fb.error || '?')); }
        if (res.results?.tt) { if (res.results.tt.success) { parts.push('TikTok: CONECTADO'); setAuthState((a: any) => ({...a, tt: true})); } else parts.push('TikTok: FALHOU — ' + (res.results.tt.error || '?')); }
        reply = parts.join('\n');
      }
    }
    else if ((cmd.includes('ve') || cmd.includes('ler') || cmd.includes('verifica')) && cmd.includes('coment')) {
      var pl = 'instagram';
      if (cmd.includes('facebook') || cmd.includes('fb')) pl = 'facebook';
      if (cmd.includes('tiktok') || cmd.includes('tt')) pl = 'tiktok';
      reply = 'A buscar comentarios do ' + pl.toUpperCase() + '...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var res = await callJarvis('read_comments', { platform: pl });
      if (!res || !res.comments?.length) { reply = 'Sem comentarios encontrados.'; }
      else { var lines = res.comments.length + ' comentarios encontrados:\n'; for (var ci = 0; ci < Math.min(20, res.comments.length); ci++) { var c = res.comments[ci]; lines += '\n' + (ci+1) + '. @' + c.username + ': "' + c.text + '"'; } reply = lines; }
    }
    else if (cmd.includes('responde') && cmd.includes('coment')) {
      var pl2 = 'instagram';
      if (cmd.includes('facebook') || cmd.includes('fb')) pl2 = 'facebook';
      if (cmd.includes('tiktok') || cmd.includes('tt')) pl2 = 'tiktok';
      reply = 'A responder comentarios...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var cRes = await callJarvis('read_comments', { platform: pl2 });
      if (!cRes || !cRes.comments?.length) { reply = 'Sem comentarios para responder.'; }
      else {
        reply = 'A responder ' + cRes.comments.length + ' comentarios...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var rRes = await callJarvis('reply_comments', { comments: cRes.comments, platform: pl2 });
        if (rRes) { var rLines = rRes.totalReplied + '/' + cRes.comments.length + ' respondidos:\n'; for (var ri = 0; ri < rRes.results.length; ri++) { var r = rRes.results[ri]; rLines += '\n@' + r.username + ': ' + (r.success ? 'OK' : 'FALHOU'); } reply = rLines; }
      }
    }
    else if (cmd.includes('mandar mensagem') || cmd.includes('enviar mensagem') || cmd.includes('broadcast') || cmd.includes('envia dm')) {
      var prosps = getProspects().filter(p => p.status !== 'sent');
      if (prosps.length === 0) { reply = 'Sem prospects pendentes. Importa um CSV primeiro com o botao +.'; }
      else {
        var dmPlat = 'all';
        if (cmd.includes('instagram') || cmd.includes('ig')) dmPlat = 'instagram';
        else if (cmd.includes('facebook') || cmd.includes('fb')) dmPlat = 'facebook';
        else if (cmd.includes('tiktok') || cmd.includes('tt')) dmPlat = 'tiktok';
        var filtered = dmPlat === 'all' ? prosps : prosps.filter((p: any) => p.platform === dmPlat);
        if (filtered.length === 0) { reply = 'Sem prospects para ' + dmPlat.toUpperCase(); }
        else {
          reply = 'A enviar DMs para ' + filtered.length + ' prospects...';
          setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
          var quotedMsg = msg.match(/["']([^"']+)["']/);
          var dmRes = await callJarvis('send_dms', { platform: dmPlat, message: quotedMsg ? quotedMsg[1] : undefined, prospects: filtered });
          if (dmRes) {
            var dmLines = 'RESULTADO:\n' + dmRes.totalSent + ' DMs enviados.\n' + dmRes.totalFailed + ' falharam.\n';
            for (var di = 0; di < dmRes.results.length; di++) { var dr = dmRes.results[di]; dmLines += (dr.success ? 'OK' : 'X') + ' @' + dr.username + '\n'; }
            var allPros = getProspects();
            for (var dr2 of dmRes.results) { var idx = allPros.findIndex((p: any) => p.username === dr2.username); if (idx >= 0 && dr2.success) allPros[idx].status = 'sent'; }
            ss('jp', JSON.stringify(allPros));
            reply = dmLines;
          }
        }
      }
    }
    else if (cmd.includes('inbox') || cmd.includes('mensagens recebidas')) {
      reply = 'A verificar inbox...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var iRes = await callJarvis('inbox', { platform: 'all' });
      if (!iRes || !iRes.messages?.length) { reply = 'Inbox vazio.'; }
      else { var iLines = iRes.total + ' mensagens:\n'; for (var ii = 0; ii < Math.min(15, iRes.messages.length); ii++) { var im = iRes.messages[ii]; iLines += '\n@' + im.username + ': "' + im.text + '"'; } reply = iLines; }
    }
    else if (cmd.includes('prospect')) {
      var pp = getProspects();
      reply = pp.length === 0 ? 'Nenhum prospect.' : pp.length + ' prospects:\n' + pp.slice(0, 15).map((p: any, i: number) => (i+1) + '. @' + p.username + ' (' + p.platform + ') [' + p.status + ']').join('\n');
    }
    else if (cmd.includes('configurar') && (cmd.includes('hiker') || cmd.includes('upload') || cmd.includes('api') || cmd.includes('chave'))) {
      var keyMatch = msg.match(/(?:chave|key|token)[:\s]+([a-zA-Z0-9_\-]{10,})/);
      var keyVal = keyMatch ? keyMatch[1] : '';
      var toolName = cmd.includes('hiker') ? 'hiker' : cmd.includes('upload') ? 'uploadpost' : cmd.includes('many') ? 'manychat' : 'n8n';
      if (keyVal) { ss('jk_' + toolName, keyVal); reply = 'API key guardada para ' + toolName.toUpperCase() + '.'; }
      else { reply = 'Formato: "configurar hiker key SUA_CHAVE"'; }
    }
    else if (cmd.includes('publica') || cmd.includes('postar')) {
      var upKey = sg('jk_uploadpost', '');
      if (!upKey) { reply = 'Precisas da Upload-Post API. "configurar uploadpost key SUA_CHAVE"'; }
      else {
        reply = 'A publicar...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var platform = cmd.includes('facebook') ? 'facebook' : cmd.includes('tiktok') ? 'tiktok' : 'instagram';
        var upRes = await fetch('/api/tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: 'uploadpost', action: 'post', apiKey: upKey, platform, caption: msg.replace(/^(jarvis\s*)?/i, '').replace(/(publica|postar)\s*(no\s*)?(instagram|facebook|tiktok)?\s*/i, '').trim() }) }).then(r => r.ok ? r.json() : null);
        reply = upRes?.success ? 'Publicado! ID: ' + (upRes.data?.id || 'OK') : 'Falhou: ' + (upRes?.error || '?');
      }
    }
    else if (cmd.includes('perfil') || cmd.includes('profile')) {
      var hkKey = sg('jk_hiker', '');
      if (!hkKey) { reply = 'Precisas da HikerAPI. "configurar hiker key SUA_CHAVE"'; }
      else {
        var uMatch = msg.match(/@?([a-zA-Z0-9_.]{1,30})/);
        var tgtUser = uMatch ? uMatch[1] : 'mwangobrain';
        reply = 'A buscar perfil...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var hkRes = await fetch('/api/tools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: 'hikerapi', action: 'get_user', apiKey: hkKey, username: tgtUser }) }).then(r => r.ok ? r.json() : null);
        if (hkRes?.success && hkRes.data) { var d = hkRes.data; reply = '@' + (d.username || tgtUser) + '\nNome: ' + (d.full_name || '-') + '\nSeguidores: ' + (d.follower_count || '?') + '\nPosts: ' + (d.media_count || '?'); }
        else { reply = 'Erro: ' + (hkRes?.error || '?'); }
      }
    }
    else if (cmd.includes('plataforma') || cmd.includes('status')) {
      reply = 'ESTADO\n\nIG: ' + (auth.ig ? 'CONECTADO' : 'DESCONECTADO') + '\nFB: ' + (auth.fb ? 'CONECTADO' : 'DESCONECTADO') + '\nTT: ' + (auth.tt ? 'CONECTADO' : 'DESCONECTADO') + '\nProspects: ' + getProspects().length;
    }
    else if (cmd.includes('conectar upload') || cmd.includes('gerar link')) {
      reply = 'A gerar link OAuth...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var connectRes = await callJarvis('up_connect');
      reply = connectRes?.success ? 'LINK: ' + connectRes.access_url : 'Erro: ' + (connectRes?.error || '?');
    }
    else if (cmd.includes('contas conectadas')) {
      reply = 'A verificar...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var accRes = await callJarvis('up_accounts');
      reply = accRes?.success ? accRes.totalConnected + ' plataforma(s) conectada(s).' : 'Erro.';
    }
    else if (cmd.includes('publica em tudo') || cmd.includes('cross-post')) {
      var crossMsg = msg.replace(/^(jarvis\s*)?/i, '').replace(/(publica|publicar|post|mete)\s+(em tudo|cross-post)\s*/i, '').trim();
      if (!crossMsg) { reply = 'Diz o que publicar. Ex: "publica em tudo Promocao 50% off!"'; }
      else {
        reply = 'A publicar...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var crossRes = await callJarvis('up_publish_all', { message: crossMsg, title: crossMsg });
        reply = crossRes?.success ? 'Publicado em: ' + (crossRes.platforms || []).join(', ') : 'Falhou.';
      }
    }
    else if (cmd.includes('agendar')) {
      var schedMsg = msg.replace(/^(jarvis\s*)?/i, '').replace(/(agendar|schedule)\s*/i, '').trim();
      var dateMatch = msg.match(/(?:para|as|at)\s+(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2})/);
      var schedDateStr = dateMatch ? dateMatch[1].replace('/', '-') : '';
      if (!schedMsg || !schedDateStr) { reply = 'Formato: "agendar MENSAGEM para 2026-08-01 15:00"'; }
      else {
        reply = 'A agendar...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var schedRes = await callJarvis('up_schedule_create', { message: schedMsg, target: schedDateStr });
        reply = schedRes?.success ? 'Agendado para ' + schedDateStr : 'Falhou.';
      }
    }
    else if (cmd.includes('agendados') || cmd.includes('ver agenda')) {
      reply = 'A buscar...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var schedList = await callJarvis('up_schedule_list');
      var jobs = schedList?.data && Array.isArray(schedList.data) ? schedList.data : [];
      reply = jobs.length === 0 ? 'Sem posts agendados.' : jobs.length + ' agendados:\n' + jobs.slice(0, 10).map((j: any, i: number) => (i+1) + '. ' + (j.title || '?').slice(0, 50)).join('\n');
    }
    else if (cmd.includes('historico') || cmd.includes('history')) {
      reply = 'A buscar historico...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var histRes = await callJarvis('up_history');
      var posts = histRes?.data && Array.isArray(histRes.data) ? histRes.data : [];
      reply = posts.length === 0 ? 'Sem historico.' : 'Ultimos posts:\n' + posts.slice(0, 10).map((p: any, i: number) => (i+1) + '. ' + (p.title || '?').slice(0, 50)).join('\n');
    }
    // ===== ZERNIO DM COMMANDS =====
    else if (cmd.includes('dm') && (cmd.includes('inbox') || cmd.includes('mensagens') || cmd.includes('conversas'))) {
      reply = 'A buscar DMs via Zernio...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var zPlat = '';
      if (cmd.includes('instagram') || cmd.includes('ig')) zPlat = 'instagram';
      else if (cmd.includes('facebook') || cmd.includes('fb')) zPlat = 'facebook';
      var zConv = await apiCall('/cmd/zernio', { action: 'list_conversations', platform: zPlat || undefined });
      if (!zConv || !zConv.success) { reply = 'Erro ao buscar DMs: ' + (zConv?.error || 'sem resposta'); }
      else {
        var convs = zConv.conversations?.data || zConv.conversations || [];
        if (!Array.isArray(convs) && convs.conversations) convs = convs.conversations;
        if (convs.length === 0) { reply = 'Sem conversas no inbox ' + (zPlat ? '(' + zPlat + ')' : '') + '.'; }
        else {
          reply = convs.length + ' conversas encontradas:\n';
          for (var zi = 0; zi < Math.min(15, convs.length); zi++) {
            var zc = convs[zi];
            reply += '\n' + (zi+1) + '. ' + (zc.participant?.name || zc.participant?.username || zc.id?.slice(0, 12) || '?');
            if (zc.lastMessage?.text) reply += ': "' + zc.lastMessage.text.slice(0, 60) + '"';
            if (zc.platform) reply += ' [' + zc.platform + ']';
          }
          reply += '\n\nDiz "responde dm <numero>" para responder a uma conversa.';
        }
      }
    }
    else if (cmd.includes('contas zernio') || cmd.includes('zernio contas') || cmd.includes('contas conectadas')) {
      reply = 'A buscar contas conectadas no Zernio...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var zAcc = await apiCall('/cmd/zernio', { action: 'list_accounts' });
      if (!zAcc || !zAcc.success) { reply = 'Erro: ' + (zAcc?.error || 'sem resposta'); }
      else {
        var accs = zAcc.accounts?.data || zAcc.accounts || [];
        if (!Array.isArray(accs) && accs.accounts) accs = accs.accounts;
        if (accs.length === 0) { reply = 'Nenhuma conta conectada. Diz "conectar zernio <plataforma>".'; }
        else {
          reply = accs.length + ' contas conectadas no Zernio:\n';
          for (var ai = 0; ai < accs.length; ai++) {
            var a = accs[ai];
            reply += '\n' + (ai+1) + '. ' + (a.platform || '?') + ': @' + (a.username || a.handle || a.name || '?') + ' (ID: ' + (a.id || a.accountId || '?').slice(0, 12) + ')';
          }
        }
      }
    }
    else if (cmd.includes('responde dm') || cmd.includes('responder dm')) {
      // Reply to a DM via Zernio
      var dmParts = msg.match(/responde?\s*dm\s*(\d+)\s*(.*)/i) || [];
      if (dmParts.length < 3) { reply = 'Uso: "responde dm 1 Olá! Como posso ajudar?"'; }
      else {
        var convIdx = parseInt(dmParts[1]) - 1;
        var dmText = dmParts[2];
        setChatHistory(h => [...h, { role: 'assistant', content: 'A enviar DM...', ts: new Date().toISOString() }]);
        // First get conversations
        var zC = await apiCall('/cmd/zernio', { action: 'list_conversations' });
        var zConvs = zC?.conversations?.data || zC?.conversations || [];
        if (!Array.isArray(zConvs) && zConvs.conversations) zConvs = zConvs.conversations;
        if (convIdx >= 0 && convIdx < zConvs.length) {
          var targetConv = zConvs[convIdx];
          var targetAccId = targetConv.accountId || targetConv.account?.id || '';
          var sendRes = await apiCall('/cmd/zernio', { action: 'send_dm', conversationId: targetConv.id, accountId: targetAccId, message: dmText });
          reply = sendRes?.success ? 'DM enviado com sucesso para ' + (targetConv.participant?.name || targetConv.participant?.username || '?') + '!' : 'Falhou: ' + (sendRes?.error || '?');
        } else { reply = 'Numero de conversa invalido.'; }
      }
    }
    else if (cmd.includes('conectar zernio') || cmd.includes('zernio conectar')) {
      var zPlat2 = 'instagram';
      if (cmd.includes('facebook') || cmd.includes('fb')) zPlat2 = 'facebook';
      reply = 'A gerar link de conexao ' + zPlat2.toUpperCase() + '...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var zConn = await apiCall('/cmd/zernio', { action: 'connect', platform: zPlat2 });
      if (!zConn?.success) { reply = 'Erro: ' + (zConn?.error || '?'); }
      else { reply = 'Abre este link para conectar o teu ' + zPlat2.toUpperCase() + ' ao Zernio:\n' + (zConn.authUrl || zConn.data?.authUrl || '?'); }
    }
    else if (cmd.includes('auto dm') || cmd.includes('comment-to-dm') || cmd.includes('automacao dm')) {
      reply = 'A criar automacao comment-to-DM...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var autoMsg = msg.match(/["']([^"']+)["']/);
      var autoText = autoMsg ? autoMsg[1] : 'Obrigado pelo comentario! A Mwango Brain agradece o teu interesse. Como podemos ajudar?';
      var autoAccId = sg('zernio_ig_account', '');
      if (!autoAccId) {
        var zA = await apiCall('/cmd/zernio', { action: 'list_accounts' });
        var zAccs2 = zA?.accounts?.data || zA?.accounts || [];
        if (!Array.isArray(zAccs2) && zAccs2.accounts) zAccs2 = zAccs2.accounts;
        var igAcc = zAccs2.find((a: any) => a.platform === 'instagram');
        if (igAcc) { autoAccId = igAcc.id || igAcc.accountId || ''; ss('zernio_ig_account', autoAccId); }
      }
      if (!autoAccId) { reply = 'Nenhuma conta Instagram conectada. Diz "conectar zernio instagram" primeiro.'; }
      else {
        var autoRes = await apiCall('/cmd/zernio', { action: 'create_comment_automation', accountId: autoAccId, message: autoText });
        reply = autoRes?.success ? 'Automacao criada! Quem comentar nos teus posts vai receber automaticamente: "' + autoText + '"' : 'Falhou: ' + (autoRes?.error || '?');
      }
    }
    // ===== TIKTOK DM COMMANDS =====
    else if (cmd.includes('tiktok') && (cmd.includes('inbox') || cmd.includes('dm') || cmd.includes('conversas'))) {
      reply = 'A buscar DMs do TikTok...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var ttConv = await apiCall('/cmd/tiktok', { action: 'get_conversations' });
      if (!ttConv?.success) { reply = 'Erro ao buscar DMs TikTok: ' + (ttConv?.error || 'verifica se a MANYCHAT_API_KEY esta configurada'); }
      else {
        var ttConvs = ttConv.data?.conversations || ttConv.data || [];
        if (!Array.isArray(ttConvs)) ttConvs = [];
        if (ttConvs.length === 0) { reply = 'Sem conversas TikTok.'; }
        else {
          reply = ttConvs.length + ' conversas TikTok:\n';
          for (var tti = 0; tti < Math.min(15, ttConvs.length); tti++) {
            var tc = ttConvs[tti];
            reply += '\n' + (tti+1) + '. ' + (tc.name || tc.participant?.username || tc.id?.slice(0, 12) || '?');
            if (tc.lastMessage?.text) reply += ': "' + tc.lastMessage.text.slice(0, 60) + '"';
          }
        }
      }
    }
    else if (cmd.includes('tiktok') && (cmd.includes('welcome') || cmd.includes('mensagem inicial'))) {
      var ttMsg = msg.match(/["']([^"']+)["']/);
      var ttWelcomeText = ttMsg ? ttMsg[1] : 'Ola! Bem-vindo a Mwango Brain. Como podemos ajudar?';
      reply = 'A configurar mensagem de boas-vindas TikTok...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var ttWel = await apiCall('/cmd/tiktok', { action: 'set_welcome', message: ttWelcomeText });
      reply = ttWel?.success ? 'Mensagem de boas-vindas TikTok configurada!' : 'Erro: ' + (ttWel?.error || '?');
    }
    else if (cmd.includes('tiktok') && cmd.includes('status')) {
      reply = 'A verificar estado TikTok...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var ttStatus = await apiCall('/cmd/tiktok', { action: 'get_status' });
      if (ttStatus?.success) {
        var s = ttStatus.data;
        reply = 'ESTADO TIKTOK\n';
        reply += '  DMs: ' + s.dms + '\n';
        reply += '  Auto-reply: ' + s.auto_reply + '\n';
        reply += '  Welcome msg: ' + s.welcome_message + '\n';
        reply += '  Comments: ' + s.comments + '\n';
        reply += '  Posting: ' + s.posting + '\n';
      } else { reply = 'Erro: ' + (ttStatus?.error || '?'); }
    }
    // ===== AUTONOMOUS SYSTEM COMMANDS =====
    else if (cmd.includes('modo autonomo') || cmd.includes('ativar autonomia') || cmd.includes('sistema autonomo')) {
      reply = 'A activar sistema autonomo...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var autoRes = await apiCall('/cmd/autonomous', { action: 'full_cycle' });
      if (!autoRes?.success) { reply = 'Erro ao activar sistema: ' + (autoRes?.error || '?'); }
      else {
        var d = autoRes.data;
        var autoLines = 'SISTEMA AUTONOMO ACTIVO\n\n';
        autoLines += 'Monitorizacao DMs:\n';
        autoLines += '  - Novas mensagens: ' + (d.monitor?.newMessages || 0) + '\n';
        autoLines += '  - Respostas automaticas: ' + (d.monitor?.autoReplied || 0) + '\n';
        autoLines += '  - Notificacoes criadas: ' + (d.monitor?.notifications || 0) + '\n';
        autoLines += '\nTikTok DMs:\n';
        autoLines += '  - Novas mensagens: ' + (d.tiktok?.newMessages || 0) + '\n';
        autoLines += '  - Respostas automaticas: ' + (d.tiktok?.autoReplied || 0) + '\n';
        if (d.tiktok?.errors?.length > 0) autoLines += '  - Erros: ' + d.tiktok.errors.join(', ') + '\n';
        autoLines += '\nFollow-ups:\n';
        autoLines += '  - Processados: ' + (d.followUps?.processed || 0) + '\n';
        autoLines += '  - Enviados: ' + (d.followUps?.sent || 0) + '\n';
        autoLines += '  - Novos criados: ' + (d.autoCreatedFollowUps || 0) + '\n';
        if (d.monitor?.errors?.length > 0) autoLines += '\nErros: ' + d.monitor.errors.join(', ');
        reply = autoLines;
      }
    }
    else if (cmd.includes('ver notificacoes') || cmd.includes('notificacoes') || cmd.includes('alertas')) {
      reply = 'A buscar notificacoes...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var notifRes = await apiCall('/cmd/autonomous', { action: 'get_notifications', unreadOnly: false });
      if (!notifRes?.success || !notifRes.data?.length) { reply = 'Sem notificacoes.'; }
      else {
        reply = notifRes.data.length + ' notificacoes:\n';
        for (var ni = 0; ni < Math.min(15, notifRes.data.length); ni++) {
          var n = notifRes.data[ni];
          reply += '\n' + (ni+1) + '. ' + (n.isRead ? ' ' : '🔴 ') + '[' + (n.platform || 'ALL') + '] ' + n.title;
          if (n.message) reply += '\n   "' + n.message.slice(0, 80) + '"';
        }
      }
    }
    else if (cmd.includes('follow-ups') || cmd.includes('followups') || cmd.includes('seguimentos')) {
      reply = 'A processar follow-ups automaticos...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var fuRes = await apiCall('/cmd/autonomous', { action: 'process_followups' });
      if (!fuRes?.success) { reply = 'Erro: ' + (fuRes?.error || '?'); }
      else {
        reply = 'FOLLOW-UPS\n\n';
        reply += 'Processados: ' + (fuRes.data?.processed || 0) + '\n';
        reply += 'Enviados: ' + (fuRes.data?.sent || 0) + '\n';
        if (fuRes.data?.errors?.length > 0) reply += 'Erros: ' + fuRes.data.errors.join(', ');
      }
    }
    else if (cmd.includes('monitorizar') || cmd.includes('monitor') || cmd.includes('verificar dm')) {
      reply = 'A monitorizar DMs...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var monRes = await apiCall('/cmd/autonomous', { action: 'monitor' });
      if (!monRes?.success) { reply = 'Erro: ' + (monRes?.error || '?'); }
      else {
        var md = monRes.data;
        reply = 'MONITOR DMs\n\n';
        reply += 'Novas mensagens: ' + (md.newMessages || 0) + '\n';
        reply += 'Auto-respostas: ' + (md.autoReplied || 0) + '\n';
        reply += 'Notificacoes: ' + (md.notifications || 0) + '\n';
        if (md.errors?.length > 0) reply += 'Erros: ' + md.errors.join(', ');
      }
    }
    else if (cmd.includes('logs') || cmd.includes('historico automacao') || cmd.includes('actividade')) {
      var logRes = await apiCall('/cmd/autonomous', { action: 'get_logs', limit: 20 });
      if (!logRes?.success || !logRes.data?.length) { reply = 'Sem logs de automacao.'; }
      else {
        reply = 'LOGS DE AUTOMACAO:\n';
        for (var li = 0; li < Math.min(15, logRes.data.length); li++) {
          var l = logRes.data[li];
          reply += '\n' + (li+1) + '. [' + (l.status === 'success' ? 'OK' : 'X') + '] ' + l.type + ' - ' + l.action + ' (' + (l.platform || '') + ') @' + (l.targetName || '');
        }
      }
    }
    else if (cmd.includes('sair') || cmd.includes('logout')) { sd('ja'); sd('jch'); sd('jsessions'); onLogout(); return; }
    else {
      try {
        var messages: any[] = [];
        var histSlice = chatHistory.slice(-10);
        for (var m of histSlice) { if (m.role === 'user' || m.role === 'assistant') messages.push({ role: m.role, content: m.content }); }
        messages.push({ role: 'user', content: msg });
        var token = sg('jt', '');
        var aiRes = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ messages }) });
        var aiData = await aiRes.json();
        reply = aiData.success ? aiData.reply : 'Erro ao gerar resposta.';
      } catch(e) { reply = 'Erro de conexao. Tenta novamente.'; }
    }
    if (reply) setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
    setLoading(false);
  };

  const importCSV = (text: string) => {
    var lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;
    var headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    var iU = headers.indexOf('username') !== -1 ? headers.indexOf('username') : headers.indexOf('handle');
    if (iU === -1) iU = headers.indexOf('user');
    var iN = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('nome');
    var iP = headers.indexOf('platform') !== -1 ? headers.indexOf('platform') : headers.indexOf('plataforma');
    var iF = headers.indexOf('followers') !== -1 ? headers.indexOf('followers') : headers.indexOf('seguidores');
    var existing = getProspects();
    var existSet = new Set(existing.map((p: any) => p.username));
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      var username = (cols[iU] || '').replace('@', '');
      if (!username || existSet.has(username)) continue;
      var plat = cols[iP] || 'instagram';
      if (plat.indexOf('tiktok') >= 0) plat = 'tiktok';
      else if (plat.indexOf('facebook') >= 0 || plat.indexOf('fb') >= 0) plat = 'facebook';
      else plat = 'instagram';
      existing.push({ id: uid(), username, name: iN >= 0 ? (cols[iN] || '') : '', platform: plat, followers: iF >= 0 ? parseInt(cols[iF]) || 0 : 0, status: 'pending', importedAt: new Date().toISOString() });
      existSet.add(username);
    }
    ss('jp', JSON.stringify(existing));
    return existing.length;
  };

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 10px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#ff2d2d', lineHeight: 1.2 }}>{prospectCount}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600 }}>Prospects</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#ff2d2d', lineHeight: 1.2 }}>{connectedCount}/3</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600 }}>Plataformas</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#ff2d2d', lineHeight: 1.2 }}>{fmtUp()}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600 }}>Activo</div></div>
        </div>
      </div>
      {/* CHAT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {chatHistory.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10, animation: 'fadeIn .2s ease' }}>
              <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 16, background: m.role === 'user' ? 'rgba(255,45,45,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (m.role === 'user' ? 'rgba(255,45,45,0.2)' : 'rgba(255,255,255,0.06)'), color: '#e8e8ec', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {m.role === 'assistant' && <div style={{ color: '#ff2d2d', fontSize: 10, fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>Aura</div>}
                {m.content}
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, marginTop: 4 }}>{ft(m.ts)}</div>
              </div>
            </div>
          ))}
          {loading && <div style={{ padding: '12px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', fontSize: 13, animation: 'blink 1.5s infinite', marginBottom: 10 }}>A processar...</div>}
          <div ref={endRef} />
        </div>
      </div>
      {/* INPUT */}
      <div style={{ padding: '10px 16px 34px', background: 'linear-gradient(to top, rgba(0,0,0,0.98) 70%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 480, margin: '0 auto' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { var file = e.target.files?.[0]; if (!file) return; var fileName = file.name; var reader = new FileReader(); reader.onload = ev => { var text = ev.target?.result as string; var count = importCSV(text); setChatHistory(h => [...h, { role: 'system', content: 'CSV importado: ' + fileName + ' (' + count + ' prospects)', ts: new Date().toISOString() }]); }; reader.readAsText(file); e.target.value = ''; }} />
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(); }} placeholder="Pergunte ou instrua o Aura..." style={{ width: '100%', height: 48, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 26, padding: '0 48px 0 20px', color: '#e8e8ec', fontSize: 14, outline: 'none', fontFamily: "-apple-system,sans-serif", transition: 'all .3s', boxSizing: 'border-box' as const }} />
            <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', right: 12, width: 28, height: 28, background: 'rgba(255,45,45,0.15)', border: 'none', borderRadius: '50%', color: '#ff2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', fontWeight: 300 }}>+</button>
          </div>
          <button onClick={send} disabled={loading || !input.trim()} style={{ width: 48, height: 48, background: '#ff2d2d', border: 'none', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,45,45,0.35)', flexShrink: 0, transition: 'transform .15s' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ transform: 'rotate(-45deg) translateY(-1px)' }}><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
