'use client';
import { useState, useEffect, useRef } from 'react';

// ===== CONSTANTS =====
const PASS = 'Jarvis99!';
const OR_KEY = process.env.NEXT_PUBLIC_OR_KEY || '';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_MODEL = 'google/gemini-2.0-flash-exp:free';
const OR_FALLBACK = 'meta-llama/llama-3.2-3b-instruct:free';

// ===== HELPERS =====
const sg = (k: string, d?: string) => { try { var v = localStorage?.getItem(k); return v || d || ''; } catch(e) { return d || ''; } };
const ss = (k: string, v: string) => { try { localStorage?.setItem(k, v); } catch(e) {} };
const sd = (k: string) => { try { localStorage?.removeItem(k); } catch(e) {} };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ft = (d: string) => { var dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }); };

// ===== PARTICLES =====
function Particles() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 8 + 's';
      p.style.animationDuration = (Math.random() * 4 + 6) + 's';
      const sz = Math.random() * 2 + 1;
      p.style.width = sz + 'px'; p.style.height = sz + 'px';
      el.appendChild(p);
    }
    return () => { el.innerHTML = ''; };
  }, []);
  return <div ref={ref} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }} />;
}

// ===== HEXAGON SVG =====
function HexLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" stroke="#ff4444" strokeWidth="2.5" fill="rgba(255,68,68,0.06)" />
      <polygon points="50,18 78,33 78,67 50,82 22,67 22,33" stroke="rgba(255,68,68,0.25)" strokeWidth="1" fill="none" />
      <text x="50" y="58" textAnchor="middle" fill="#ff4444" fontSize="20" fontWeight="800" fontFamily="-apple-system,sans-serif">J</text>
    </svg>
  );
}



// ===== LOGIN SCREEN =====
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [booting, setBooting] = useState(false);
  const [step, setStep] = useState(0);
  const lines = ['A verificar credenciais...', 'A inicializar modulo...', 'A conectar APIs...', 'A preparar sessoes...', 'Sistema pronto.'];

  const tryLogin = async () => {
    if (code !== PASS) { setErr(true); setTimeout(() => setErr(false), 1500); return; }
    setBooting(true);
    for (let i = 0; i < lines.length; i++) { setStep(i); await new Promise(r => setTimeout(r, 400)); }
    ss('ja', 'active');
    onLogin();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <Particles />

      {/* Corner brackets */}
      {[
        { top: 12, left: 12, w: 30, h: 30, br: '2px solid rgba(255,68,68,0.15)', bb: 'none', bt: 'none', bl: 'none' },
        { top: 12, right: 12, w: 30, h: 30, br: 'none', bb: 'none', bt: 'none', bl: '2px solid rgba(255,68,68,0.15)' },
        { bottom: 12, left: 12, w: 30, h: 30, br: 'none', bb: '2px solid rgba(255,68,68,0.15)', bt: 'none', bl: 'none' },
        { bottom: 12, right: 12, w: 30, h: 30, br: 'none', bb: 'none', bt: '2px solid rgba(255,68,68,0.15)', bl: 'none' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', ...s, borderTop: s.bt || s.br, borderRight: s.br, borderBottom: s.bb || s.br, borderLeft: s.bl || s.br }} />
      ))}

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 340, padding: '0 24px' }}>
        {/* Logo */}
        <HexLogo size={48} />
        <div style={{ fontFamily: "-apple-system,'SF Pro Display',sans-serif", fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: 4, marginTop: 16 }}>JARVIS</div>
        <div style={{ fontSize: 9, color: '#666', letterSpacing: 3, textTransform: 'uppercase', marginTop: 6 }}>ASSISTENTE AUTONOMO</div>

        {booting ? (
          <div style={{ marginTop: 40, fontFamily: "'SF Mono',Menlo,monospace", fontSize: 11, textAlign: 'left' }}>
            {lines.map((l, i) => (
              <div key={i} style={{ color: i <= step ? '#4ade80' : 'rgba(255,255,255,0.2)', marginBottom: 4, transition: 'color .3s' }}>
                {i <= step ? '>' : 'o'} {l}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 36, width: '100%' }}>
            <div style={{ fontSize: 11, color: '#888', letterSpacing: 1.5, marginBottom: 8, fontWeight: 500 }}>PASSWORD</div>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') tryLogin(); }}
              placeholder="Enter your password"
              type="password"
              style={{
                width: '100%', height: 48, background: 'rgba(20,20,22,0.8)',
                border: '1px solid rgba(255,68,68,0.2)', borderRadius: 10,
                padding: '0 16px', color: '#fff', fontSize: 15, outline: 'none',
                fontFamily: "-apple-system,sans-serif", transition: 'border .3s',
                boxShadow: '0 0 20px rgba(139,0,0,0.1)'
              }}
            />
            {err && <div style={{ color: '#ff9800', fontSize: 11, marginTop: 8 }}>Password incorrecta</div>}
            <button
              onClick={tryLogin}
              style={{
                width: '100%', height: 48, marginTop: 24,
                background: '#f5f5f7', border: 'none', borderRadius: 24,
                fontSize: 14, fontWeight: 600, color: '#1a1a1a',
                letterSpacing: 1, cursor: 'pointer', fontFamily: "-apple-system,sans-serif",
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)', transition: 'background .15s'
              }}
            >LOGIN</button>
          </div>
        )}

        <div style={{ position: 'fixed', bottom: 16, fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: 2 }}>LUANDA // ANGOLA // mwangobrain.com</div>
      </div>
    </div>
  );
}

// ===== DASHBOARD =====
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string; ts: string }[]>(() => {
    try { var r = sg('jch', ''); return r ? JSON.parse(r) : []; } catch(e) { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState('');
  const [uptime, setUptime] = useState(0);
  const [auth, setAuthState] = useState(() => {
    try { var r = sg('jc', ''); return r ? JSON.parse(r) : { ig: false, fb: false, tt: false }; } catch(e) { return { ig: false, fb: false, tt: false }; }
  });
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);
  useEffect(() => { ss('jch', JSON.stringify(chatHistory.slice(-60))); }, [chatHistory]);
  useEffect(() => {
    var t = setInterval(() => { setClock(new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }, 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    var start = Date.now();
    var t = setInterval(() => { setUptime(Math.floor((Date.now() - start) / 1000)); }, 1000);
    return () => clearInterval(t);
  }, []);

  var connectedCount = (auth.ig ? 1 : 0) + (auth.fb ? 1 : 0) + (auth.tt ? 1 : 0);
  var prospectCount = (() => { try { var r = sg('jp', ''); var arr = r ? JSON.parse(r) : []; return arr.length; } catch(e) { return 0; } })();
  var fmtUp = () => { var m = Math.floor(uptime / 60); var s = uptime % 60; return m > 0 ? m + 'm' + s + 's' : s + 's'; };

  // Get stored platform sessions
  const getSessions = () => { try { var r = sg('jsessions', ''); return r ? JSON.parse(r) : {}; } catch(e) { return {}; } };
  const saveSessions = (s: any) => { ss('jsessions', JSON.stringify(s)); };

  // Call the real API
  const callJarvis = async (action: string, extra: any = {}) => {
    var creds = getSessions();
    var prosps = getProspects();
    var res = await fetch('/cmd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // ===== REAL COMMAND: ENTRAR NAS PLATAFORMAS =====
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
        if (res.results?.ig) {
          if (res.results.ig.success) { parts.push('Instagram: CONECTADO (' + (res.results.ig.userId || '') + ')'); setAuthState(a => ({...a, ig: true})); }
          else parts.push('Instagram: FALHOU — ' + (res.results.ig.error || '?'));
        }
        if (res.results?.fb) {
          if (res.results.fb.success) { parts.push('Facebook: CONECTADO'); setAuthState(a => ({...a, fb: true})); }
          else parts.push('Facebook: FALHOU — ' + (res.results.fb.error || '?'));
        }
        if (res.results?.tt) {
          if (res.results.tt.success) { parts.push('TikTok: CONECTADO'); setAuthState(a => ({...a, tt: true})); }
          else parts.push('TikTok: FALHOU — ' + (res.results.tt.error || '?'));
        }
        reply = parts.join('\n');
      }
    }

    // ===== REAL COMMAND: VER COMENTARIOS =====
    else if ((cmd.includes('ve') || cmd.includes('ler') || cmd.includes('verifica')) && cmd.includes('coment')) {
      var pl = 'instagram';
      if (cmd.includes('facebook') || cmd.includes('fb')) pl = 'facebook';
      if (cmd.includes('tiktok') || cmd.includes('tt')) pl = 'tiktok';

      reply = 'A buscar comentarios do ' + pl.toUpperCase() + '...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);

      var res = await callJarvis('read_comments', { platform: pl });
      if (!res || !res.comments?.length) { reply = 'Sem comentarios encontrados. Publica algo primeiro ou verifica mais tarde.'; }
      else {
        var lines = res.comments.length + ' comentarios encontrados:\n';
        for (var ci = 0; ci < Math.min(20, res.comments.length); ci++) {
          var c = res.comments[ci];
          lines += '\n' + (ci+1) + '. @' + c.username + ': "' + c.text + '"';
        }
        lines += '\n\nDiz "responde comentarios" para responder automaticamente.';
        reply = lines;
      }
    }

    // ===== REAL COMMAND: RESPONDER COMENTARIOS =====
    else if (cmd.includes('responde') && cmd.includes('coment')) {
      var pl2 = 'instagram';
      if (cmd.includes('facebook') || cmd.includes('fb')) pl2 = 'facebook';
      if (cmd.includes('tiktok') || cmd.includes('tt')) pl2 = 'tiktok';

      reply = 'A buscar comentarios do ' + pl2.toUpperCase() + ' para responder...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);

      // First get comments
      var cRes = await callJarvis('read_comments', { platform: pl2 });
      if (!cRes || !cRes.comments?.length) { reply = 'Sem comentarios para responder.'; }
      else {
        reply = 'A responder ' + cRes.comments.length + ' comentarios com IA...\n(Podem demorar alguns segundos)';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);

        var rRes = await callJarvis('reply_comments', { comments: cRes.comments, platform: pl2 });
        if (rRes) {
          var rLines = rRes.totalReplied + '/' + cRes.comments.length + ' comentarios respondidos:\n';
          for (var ri = 0; ri < rRes.results.length; ri++) {
            var r = rRes.results[ri];
            rLines += '\n@' + r.username + ': ' + (r.success ? 'OK' : 'FALHOU');
            if (r.success) rLines += ' -> "' + r.reply + '"';
          }
          reply = rLines;
        }
      }
    }

    // ===== REAL COMMAND: ENVIAR DMs / BROADCAST =====
    else if (cmd.includes('mandar mensagem') || cmd.includes('enviar mensagem') || cmd.includes('manda mensagem') || cmd.includes('broadcast') || cmd.includes('envia dm')) {
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
          reply = 'A enviar DMs para ' + filtered.length + ' prospects do ' + (dmPlat === 'all' ? 'todas plataformas' : dmPlat.toUpperCase()) + '...\nCada DM tem 5s de intervalo (human pacing).';
          setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);

          var quotedMsg = msg.match(/["']([^"']+)["']/);
          var dmRes = await callJarvis('send_dms', { platform: dmPlat, message: quotedMsg ? quotedMsg[1] : undefined, prospects: filtered });
          if (dmRes) {
            var dmLines = 'RESULTADO DO BROADCAST:\n';
            dmLines += dmRes.totalSent + ' DMs enviados com sucesso.\n';
            dmLines += dmRes.totalFailed + ' falharam.\n\n';
            for (var di = 0; di < dmRes.results.length; di++) {
              var dr = dmRes.results[di];
              dmLines += (dr.success ? 'OK' : 'X') + ' @' + dr.username + ' (' + dr.platform + ')' + (dr.error ? ' — ' + dr.error : '') + '\n';
            }
            // Update prospect statuses
            var allPros = getProspects();
            for (var dr2 of dmRes.results) {
              var idx = allPros.findIndex((p: any) => p.username === dr2.username);
              if (idx >= 0 && dr2.success) allPros[idx].status = 'sent';
            }
            ss('jp', JSON.stringify(allPros));
            reply = dmLines;
          }
        }
      }
    }

    // ===== REAL COMMAND: VER INBOX =====
    else if (cmd.includes('inbox') || cmd.includes('mensagens recebidas') || cmd.includes('ver dm')) {
      reply = 'A verificar inbox...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);

      var iRes = await callJarvis('inbox', { platform: 'all' });
      if (!iRes || !iRes.messages?.length) { reply = 'Inbox vazio. Nenhuma mensagem recebida.'; }
      else {
        var iLines = iRes.total + ' mensagens no inbox:\n';
        for (var ii = 0; ii < Math.min(15, iRes.messages.length); ii++) {
          var im = iRes.messages[ii];
          iLines += '\n@' + im.username + ' (' + im.platform + '): "' + im.text + '"';
        }
        reply = iLines;
      }
    }

    // ===== COMMAND: VER PROSPECTS =====
    else if (cmd.includes('prospect')) {
      var pp = getProspects();
      reply = pp.length === 0 ? 'Nenhum prospect. Usa o + para importar CSV.' : pp.length + ' prospects no sistema.\n' + pp.slice(0, 15).map((p: any, i: number) => (i+1) + '. @' + p.username + ' (' + p.platform + ') [' + p.status + ']').join('\n') + (pp.length > 15 ? '\n...e ' + (pp.length - 15) + ' mais.' : '');
    }

    // ===== COMMAND: CONFIGURE API KEY =====
    else if (cmd.includes('configurar') && (cmd.includes('hiker') || cmd.includes('upload') || cmd.includes('manychat') || cmd.includes('n8n') || cmd.includes('chave') || cmd.includes('api'))) {
      var keyMatch = msg.match(/(?:chave|key|token)[:\s]+([a-zA-Z0-9_\-]{10,})/);
      var keyVal = keyMatch ? keyMatch[1] : '';
      var toolName = '';
      if (cmd.includes('hiker')) toolName = 'hiker';
      else if (cmd.includes('upload') || cmd.includes('post')) toolName = 'uploadpost';
      else if (cmd.includes('manychat') || cmd.includes('many')) toolName = 'manychat';
      else if (cmd.includes('n8n') || cmd.includes('webhook')) toolName = 'n8n';

      if (keyVal && toolName) {
        ss('jk_' + toolName, keyVal);
        reply = 'API key guardada para ' + toolName.toUpperCase() + '. Esta ferramenta esta agora activa.';
      } else {
        reply = 'Para configurar, escreve:\n"configurar hiker key SUA_CHAVE"\n"configurar uploadpost key SUA_CHAVE"\n"configurar manychat key SUA_CHAVE"\n"configurar n8n URL_DO_WEBHOOK"\n\nContas gratuitas:\n- hikerapi.com (100 req gratis)\n- upload-post.com\n- manychat.com (1000 conversas gratis)';
      }
    }

    // ===== COMMAND: PUBLICAR CONTEUDO (Upload-Post) =====
    else if (cmd.includes('publica') || cmd.includes('postar') || cmd.includes('mete no') || cmd.includes('public')) {
      var upKey = sg('jk_uploadpost', '');
      if (!upKey) {
        reply = 'Precisas da Upload-Post API para publicar.\n1. Cria conta gratis: https://upload-post.com\n2. Configura: "configurar uploadpost key SUA_API_KEY"\n3. Depois poe a foto e a caption.';
      } else {
        reply = 'A publicar via Upload-Post...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var platform = 'instagram';
        if (cmd.includes('facebook') || cmd.includes('fb')) platform = 'facebook';
        if (cmd.includes('tiktok') || cmd.includes('tt')) platform = 'tiktok';
        var upRes = await fetch('/api/tools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'uploadpost', action: 'post', apiKey: upKey, platform, caption: msg.replace(/^(jarvis\s*)?/i, '').replace(/(publica|postar|mete no)\s*(no\s*)?(instagram|facebook|tiktok|ig|fb|tt)?\s*(e\s+)?/i, '').trim() }),
        }).then(r => r.ok ? r.json() : null);
        if (upRes?.success) reply = 'Publicado com sucesso! Post ID: ' + (upRes.data?.id || upRes.data?.postId || 'OK');
        else reply = 'Falhou: ' + (upRes?.error || 'erro desconhecido');
      }
    }

    // ===== COMMAND: VER PERFIL INSTAGRAM (HikerAPI) =====
    else if (cmd.includes('perfil') || cmd.includes('profile') || (cmd.includes('instagram') && cmd.includes('quem'))) {
      var hkKey = sg('jk_hiker', '');
      if (!hkKey) {
        reply = 'Precisas da HikerAPI para ver perfis do Instagram.\n1. Cria conta gratis: https://hikerapi.com (100 req gratis)\n2. Configura: "configurar hiker key SUA_API_KEY"';
      } else {
        var uMatch = msg.match(/@?([a-zA-Z0-9_.]{1,30})/);
        var tgtUser = uMatch ? uMatch[1] : 'jesuainecristiano78';
        reply = 'A buscar perfil de @' + tgtUser + '...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var hkRes = await fetch('/api/tools', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'hikerapi', action: 'get_user', apiKey: hkKey, username: tgtUser }),
        }).then(r => r.ok ? r.json() : null);
        if (hkRes?.success && hkRes.data) {
          var d = hkRes.data;
          reply = 'PERFIL: @' + (d.username || tgtUser) + '\nNome: ' + (d.full_name || d.fullName || '-') + '\nBio: ' + ((d.biography || d.bio || '-').slice(0, 200)) + '\nSeguidores: ' + (d.follower_count || d.followerCount || '?') + '\nA seguir: ' + (d.following_count || d.followingCount || '?') + '\nPosts: ' + (d.media_count || d.mediaCount || '?') + '\nID: ' + (d.pk || d.id || '-');
        } else {
          reply = 'Erro: ' + (hkRes?.error || 'nao encontrou o perfil');
        }
      }
    }

    // ===== COMMAND: VER COMENTARIOS (HikerAPI) =====
    else if ((cmd.includes('coment') || cmd.includes('comments')) && cmd.includes('ver')) {
      var hkKey2 = sg('jk_hiker', '');
      if (!hkKey2) {
        reply = 'Precisas da HikerAPI. Configura: "configurar hiker key SUA_CHAVE"';
      } else {
        var midMatch = msg.match(/(post|media|id)[:\s]+(\d+)/);
        var targetMediaId = midMatch ? midMatch[2] : '';
        if (!targetMediaId) {
          reply = 'Precisas do ID do post. Exemplo: "ver comentarios do post 3456789012345678901"';
        } else {
          reply = 'A buscar comentarios...';
          setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
          var cRes = await fetch('/api/tools', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'hikerapi', action: 'get_comments', apiKey: hkKey2, mediaId: targetMediaId }),
          }).then(r => r.ok ? r.json() : null);
          if (cRes?.success && cRes.data) {
            var comments = Array.isArray(cRes.data) ? cRes.data : cRes.data.comments || cRes.data.items || [];
            if (comments.length === 0) { reply = 'Sem comentarios neste post.'; }
            else {
              var lines2 = comments.length + ' comentarios:\n';
              for (var ci = 0; ci < Math.min(20, comments.length); ci++) {
                var c = comments[ci];
                lines2 += '\n' + (ci+1) + '. @' + (c.username || c.user?.username || '?') + ': "' + (c.text || c.content || '?') + '"';
              }
              reply = lines2;
            }
          } else { reply = 'Erro: ' + (cRes?.error || 'nao conseguiu buscar comentarios'); }
        }
      }
    }

    // ===== COMMAND: PROCURAR USUARIOS (HikerAPI) =====
    else if (cmd.includes('procurar') && (cmd.includes('usuario') || cmd.includes('user') || cmd.includes('conta'))) {
      var hkKey3 = sg('jk_hiker', '');
      if (!hkKey3) {
        reply = 'Precisas da HikerAPI. Configura: "configurar hiker key SUA_CHAVE"';
      } else {
        var searchQ = msg.replace(/^(jarvis\s*)?/i, '').replace(/(procurar|buscar|encontrar)\s*(usuario|user|conta)?\s*(do\s+)?(instagram\s+)?/i, '').trim();
        if (!searchQ) { reply = 'Diz o que procuras. Ex: "procurar mwango brain"'; }
        else {
          reply = 'A procurar "' + searchQ + '"...';
          setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
          var sRes = await fetch('/api/tools', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'hikerapi', action: 'search_users', apiKey: hkKey3, query: searchQ }),
          }).then(r => r.ok ? r.json() : null);
          if (sRes?.success && sRes.data) {
            var users = Array.isArray(sRes.data) ? sRes.data : sRes.data.users || sRes.data.results || [];
            if (users.length === 0) { reply = 'Nenhum resultado para "' + searchQ + '"'; }
            else {
              var sLines = users.length + ' resultados:\n';
              for (var si = 0; si < Math.min(10, users.length); si++) {
                var u = users[si];
                sLines += '\n' + (si+1) + '. @' + (u.username || '?') + ' — ' + (u.full_name || u.fullName || '-') + ' (' + (u.follower_count || u.followerCount || '?') + ' seguidores)';
              }
              reply = sLines;
            }
          } else { reply = 'Erro: ' + (sRes?.error || 'nao conseguiu procurar'); }
        }
      }
    }

    // ===== COMMAND: STATUS =====
    else if (cmd.includes('plataforma') || cmd.includes('status')) {
      var hk = sg('jk_hiker', '') ? 'ATIVO' : 'NAO CONFIGURADO';
      var up = sg('jk_uploadpost', '') ? 'ATIVO' : 'NAO CONFIGURADO';
      var mc = sg('jk_manychat', '') ? 'ATIVO' : 'NAO CONFIGURADO';
      var n8 = sg('jk_n8n', '') ? 'ATIVO' : 'NAO CONFIGURADO';
      reply = 'ESTADO DO SISTEMA\n\nPlataformas (Login directo):\n  Instagram: ' + (auth.ig ? 'CONECTADO' : 'DESCONECTADO') + '\n  Facebook: ' + (auth.fb ? 'CONECTADO' : 'DESCONECTADO') + '\n  TikTok: ' + (auth.tt ? 'CONECTADO' : 'DESCONECTADO') + '\n\nFerramentas externas:\n  HikerAPI (Instagram): ' + hk + '\n  Upload-Post (Publicacao): ' + up + '\n  ManyChat (DMs): ' + mc + '\n  N8N (Workflows): ' + n8 + '\n\nProspects: ' + getProspects().length;
    }

    // ===== UPLOAD-POST: CONECTAR PLATAFORMAS (OAuth) =====
    else if (cmd.includes('conectar upload') || cmd.includes('ligar upload') || (cmd.includes('gerar') && cmd.includes('link')) || cmd === 'oauth') {
      reply = 'A gerar link de conexao OAuth...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var connectRes = await callJarvis('up_connect');
      if (connectRes?.success && connectRes.access_url) {
        reply = 'LINK DE CONEXAO GERADO!\n\nAbre este link no teu navegador:\n' + connectRes.access_url + '\n\nValidade: ' + (connectRes.duration || '48h') + '\n\nPassos:\n1. Abre o link\n2. Clica em "Connect Instagram" e faz login\n3. Clica em "Connect Facebook" e faz login\n4. Clica em "Connect TikTok" e faz login\n5. Quando terminares, diz "contas conectadas" para eu verificar.\n\nDepois disso, eu consigo publicar em todas as plataformas via API!';
      } else {
        reply = 'Erro ao gerar link: ' + (connectRes?.error || 'desconhecido');
      }
    }

    // ===== UPLOAD-POST: VER CONTAS CONECTADAS =====
    else if (cmd.includes('contas conectadas') || cmd.includes('contas ligadas') || cmd.includes('estado das contas') || cmd.includes('ver contas')) {
      reply = 'A verificar contas conectadas...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var accRes = await callJarvis('up_accounts');
      if (accRes?.success) {
        if (accRes.totalConnected === 0) {
          reply = 'Nenhuma plataforma conectada ainda.\n\nDiz "conectar upload" para eu gerar o link de OAuth.\nDepois abre o link no navegador e conecta Instagram, Facebook e TikTok.';
        } else {
          var accLines = accRes.totalConnected + ' plataforma(s) conectada(s):\n\n';
          for (var ai = 0; ai < accRes.accounts.length; ai++) {
            var a = accRes.accounts[ai];
            accLines += (ai+1) + '. ' + a.platform.toUpperCase() + ': @' + a.handle + (a.displayName ? ' (' + a.displayName + ')' : '') + (a.needsReauth ? ' [PRECISA RE-AUTENTICAR]' : '') + '\n';
          }
          accLines += '\nPronto para publicar em todas as plataformas conectadas!';
          reply = accLines;
        }
      } else {
        reply = 'Erro ao verificar: ' + (accRes?.error || 'desconhecido');
      }
    }

    // ===== UPLOAD-POST: INFO DA CONTA =====
    else if (cmd.includes('minha conta upload') || (cmd.includes('info') && cmd.includes('upload'))) {
      var meRes = await callJarvis('up_me');
      if (meRes?.success && meRes.data) {
        var md = meRes.data;
        reply = 'CONTA UPLOAD-POST\n\nEmail: ' + (md.email || '-') + '\nPlano: ' + (md.plan || '-') + '\nToken: valido';
      } else {
        reply = 'Erro ao buscar info: ' + (meRes?.error || 'desconhecido');
      }
    }

    // ===== UPLOAD-POST: PUBLICAR EM TODAS AS PLATAFORMAS =====
    else if (cmd.includes('publica em tudo') || cmd.includes('publicar em tudo') || cmd.includes('post em tudo') || cmd.includes('cross-post')) {
      var crossMsg = msg.replace(/^(jarvis\s*)?/i, '').replace(/(publica|publicar|post|mete)\s+(em tudo|em todas|tudo|cross-post)\s*/i, '').trim();
      if (!crossMsg) { reply = 'Diz o que queres publicar. Ex: "publica em tudo Promocao especial 50% off!"'; }
      else {
        reply = 'A publicar em todas as plataformas conectadas...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var crossRes = await callJarvis('up_publish_all', { message: crossMsg, title: crossMsg });
        if (crossRes?.success) {
          reply = 'Publicado com sucesso!\nPlataformas: ' + (crossRes.platforms || []).join(', ') + '\nResultado: ' + JSON.stringify(crossRes.result).slice(0, 200);
        } else {
          reply = 'Falhou: ' + (crossRes?.error || 'Nenhuma plataforma conectada. Diz "conectar upload" primeiro.');
        }
      }
    }

    // ===== UPLOAD-POST: AGENDAR POST =====
    else if (cmd.includes('agendar') || cmd.includes('schedule')) {
      var schedMsg = msg.replace(/^(jarvis\s*)?/i, '').replace(/(agendar|schedule)\s*/i, '').trim();
      var dateMatch = msg.match(/(?:para|as|at)\s+(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2})/);
      var schedDateStr = dateMatch ? dateMatch[1].replace('/', '-') : '';
      if (!schedMsg || !schedDateStr) {
        reply = 'Formato: "agendar SUA MENSAGEM para 2026-08-01 15:00"\n\nExemplo: "agendar Promocao de verao para 2026-08-01 15:00"';
      } else {
        reply = 'A agendar post para ' + schedDateStr + '...';
        setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
        var schedRes = await callJarvis('up_schedule_create', { message: schedMsg, target: schedDateStr });
        if (schedRes?.success) {
          reply = 'Agendado com sucesso!\nMensagem: ' + schedMsg + '\nData: ' + schedDateStr + '\nPlataformas: ' + (schedRes.platforms || []).join(', ');
        } else {
          reply = 'Falhou: ' + (schedRes?.error || 'erro desconhecido');
        }
      }
    }

    // ===== UPLOAD-POST: VER AGENDA =====
    else if (cmd.includes('agendados') || cmd.includes('agendadas') || cmd.includes('ver agenda')) {
      reply = 'A buscar posts agendados...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var schedList = await callJarvis('up_schedule_list');
      if (schedList?.success && schedList.data) {
        var jobs = Array.isArray(schedList.data) ? schedList.data : schedList.data.jobs || schedList.data.scheduled || [];
        if (jobs.length === 0) { reply = 'Sem posts agendados.'; }
        else {
          var jLines = jobs.length + ' posts agendados:\n';
          for (var ji = 0; ji < Math.min(10, jobs.length); ji++) {
            var j = jobs[ji];
            jLines += '\n' + (ji+1) + '. ' + (j.title || j.content || '?').slice(0, 60) + '\n   Data: ' + (j.scheduled_date || j.date || '?') + ' | ID: ' + (j.job_id || j.id || '?');
          }
          reply = jLines;
        }
      } else { reply = 'Erro: ' + (schedList?.error || 'desconhecido'); }
    }

    // ===== UPLOAD-POST: HISTORICO =====
    else if (cmd.includes('historico') || cmd.includes('historico upload') || cmd.includes('history')) {
      reply = 'A buscar historico...';
      setChatHistory(h => [...h, { role: 'assistant', content: reply, ts: new Date().toISOString() }]);
      var histRes = await callJarvis('up_history');
      if (histRes?.success && histRes.data) {
        var posts = Array.isArray(histRes.data) ? histRes.data : histRes.data.posts || histRes.data.history || [];
        if (posts.length === 0) { reply = 'Sem historico de posts.'; }
        else {
          var hLines = 'ULTIMOS ' + Math.min(10, posts.length) + ' POSTS:\n';
          for (var hi = 0; hi < Math.min(10, posts.length); hi++) {
            var hp = posts[hi];
            hLines += '\n' + (hi+1) + '. ' + (hp.title || hp.content || '?').slice(0, 60) + '\n   Status: ' + (hp.status || '?') + ' | Plataformas: ' + (hp.platforms || '?');
          }
          reply = hLines;
        }
      } else { reply = 'Erro: ' + (histRes?.error || 'desconhecido'); }
    }

    // ===== UPLOAD-POST: FILA/QUEUE =====
    else if (cmd.includes('fila') || cmd.includes('queue') || cmd.includes('proximo post')) {
      var queueRes = await callJarvis('up_queue');
      if (queueRes?.success) {
        reply = 'FILA DE PUBLICACAO:\n' + JSON.stringify(queueRes.data, null, 2).slice(0, 500);
      } else { reply = 'Erro: ' + (queueRes?.error || 'desconhecido'); }
    }

    // ===== UPLOAD-POST: FACEBOOK PAGES =====
    else if (cmd.includes('paginas facebook') || cmd.includes('fb pages') || cmd.includes('minhas paginas')) {
      var pgRes = await callJarvis('up_fb_pages');
      if (pgRes?.success) {
        var pages = Array.isArray(pgRes.data) ? pgRes.data : pgRes.data.pages || [];
        if (pages.length === 0) { reply = 'Sem paginas do Facebook conectadas. Conecta o Facebook primeiro dizendo "conectar upload".'; }
        else {
          var pLines = pages.length + ' paginas do Facebook:\n';
          for (var pi2 = 0; pi2 < pages.length; pi2++) {
            var pg = pages[pi2];
            pLines += '\n' + (pi2+1) + '. ' + (pg.name || pg.page_name || '?') + ' (ID: ' + (pg.page_id || pg.id || '?') + ')';
          }
          reply = pLines;
        }
      } else { reply = 'Erro: ' + (pgRes?.error || 'desconhecido'); }
    }

    // ===== COMMAND: SAIR =====
    else if (cmd.includes('sair') || cmd.includes('logout')) {
      sd('ja'); sd('jch'); sd('jsessions'); onLogout(); return;
    }

    // ===== DEFAULT: AI CHAT =====
    else {
      try {
        var sysPrompt = 'Es o JARVIS da Mwango Brain. FALAS PORTUGUES DE ANGOLA, frases curtas (2-3 linhas). Nunca digas que es IA. Agencia: mwangobrain.com, Luanda, Angola. Criador: Jesuaine Cristiano. Plataformas: Instagram, Facebook, TikTok. Responde de forma util e directa.';
        var messages: any[] = [{ role: 'system', content: sysPrompt }];
        var histSlice = chatHistory.slice(-10);
        for (var m of histSlice) { if (m.role === 'user' || m.role === 'assistant') messages.push({ role: m.role, content: m.content }); }
        messages.push({ role: 'user', content: msg });

        var res = await fetch(OR_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://jvfinal.vercel.app', 'X-Title': 'JARVIS' }, body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: 400, temperature: 0.7 }) });
        if (!res.ok) {
          var res2 = await fetch(OR_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + OR_KEY, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://jvfinal.vercel.app', 'X-Title': 'JARVIS' }, body: JSON.stringify({ model: OR_FALLBACK, messages, max_tokens: 400, temperature: 0.7 }) });
          var data2 = await res2.json(); reply = data2.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || 'Erro.';
        } else {
          var data = await res.json(); reply = data.choices?.[0]?.message?.content?.replace(/^\*+[^*]+\*+\s*/g, '').trim() || 'Sem resposta.';
        }
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
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <Particles />

      {/* HEADER */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff2d2d', boxShadow: '0 0 10px rgba(255,45,45,0.5)' }} />
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#fff' }}>JARVIS</span>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#ff2d2d', lineHeight: 1.2 }}>{prospectCount} itens</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600 }}>Prospects</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#ff2d2d', lineHeight: 1.2 }}>{connectedCount}/3</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600 }}>Plataformas</div></div>
          <div style={{ textAlign: 'center' }}><div style={{ fontSize: 15, fontWeight: 700, color: '#ff2d2d', lineHeight: 1.2 }}>{fmtUp()}</div><div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 600 }}>Activo</div></div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Operacional</span>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Sair</button>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 120px', position: 'relative', zIndex: 1, WebkitOverflowScrolling: 'touch' }}>
        {/* CHAT MESSAGES */}
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          {chatHistory.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10, animation: 'fadeIn .2s ease' }}>
              <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 16, background: m.role === 'user' ? 'rgba(255,45,45,0.12)' : 'rgba(255,255,255,0.04)', border: '1px solid ' + (m.role === 'user' ? 'rgba(255,45,45,0.2)' : 'rgba(255,255,255,0.06)'), color: '#e8e8ec', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {m.role === 'assistant' && <div style={{ color: '#ff2d2d', fontSize: 10, fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>JARVIS</div>}
                {m.content}
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, marginTop: 4 }}>{ft(m.ts)}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ padding: '12px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', fontSize: 13, animation: 'blink 1.5s infinite', marginBottom: 10 }}>
              A processar...
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* BOTTOM INPUT (fixed) */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '12px 16px 34px', background: 'linear-gradient(to top, rgba(0,0,0,0.98) 70%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 480, margin: '0 auto' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={e => {
                var file = e.target.files?.[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = ev => {
                  var text = ev.target?.result as string;
                  var count = importCSV(text);
                  setChatHistory(h => [...h, { role: 'system', content: 'CSV importado: ' + file.name + ' (' + count + ' prospects)', ts: new Date().toISOString() }]);
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(); }}
              placeholder="Pergunte ou instrua o Jarvis com um comando..."
              style={{
                width: '100%', height: 48, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 26,
                padding: '0 48px 0 20px', color: '#e8e8ec', fontSize: 14, outline: 'none',
                fontFamily: "-apple-system,sans-serif", transition: 'all .3s'
              }}
            />
            <button onClick={() => fileRef.current?.click()} style={{
              position: 'absolute', right: 12, width: 28, height: 28,
              background: 'rgba(255,45,45,0.15)', border: 'none', borderRadius: '50%',
              color: '#ff2d2d', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, cursor: 'pointer', fontWeight: 300
            }}>+</button>
          </div>
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            style={{
              width: 48, height: 48, background: '#ff2d2d', border: 'none', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(255,45,45,0.35)', flexShrink: 0, transition: 'transform .15s'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ transform: 'rotate(-45deg) translateY(-1px)' }}>
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* HOME INDICATOR (iOS style) */}
      <div style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: 'rgba(255,255,255,0.3)', borderRadius: 100, zIndex: 100 }} />

    </div>
  );
}



// ===== DATA =====
function getProspects(): any[] { try { var r = sg('jp', ''); return r ? JSON.parse(r) : []; } catch(e) { return []; } }

// ===== MAIN =====
export default function JarvisApp() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { var s = sg('ja', ''); if (s) setAuthed(true); setLoading(false); }, []);

  if (loading) return <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>A carregar...</div></div>;

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return <Dashboard onLogout={() => setAuthed(false)} />;
}
