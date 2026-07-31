'use client';
import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, BarChart3, Users, Sparkles, Clock, Send, Plus, Trash2, ChevronRight, Search, TrendingUp, Eye, Heart, Hash, Calendar, Zap, Globe, Camera, Video, FileText, RefreshCw, Settings, LogOut, Bot, Bell, Shield, Activity, Radio, Key, Mail, CheckCircle, XCircle, ChevronLeft, FileBarChart, FlaskConical, AlertTriangle } from 'lucide-react';

// ===== CONSTANTS =====
// Auth + AI agora via server-side (seguro — nenhuma key exposta)

// ===== HELPERS =====
const sg = (k: string, d?: string) => { try { var v = localStorage?.getItem(k); return v || d || ''; } catch(e) { return d || ''; } };
const ss = (k: string, v: string) => { try { localStorage?.setItem(k, v); } catch(e) { console.warn('JARVIS:', e); } };
const sd = (k: string) => { try { localStorage?.removeItem(k); } catch(e) { console.warn('JARVIS:', e); } };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ft = (d: string) => { var dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' }); };
const apiCall = async (endpoint: string, body: any) => {
  const token = sg('jt', '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 401) { sd('jt'); sd('ja'); window.location.reload(); return { error: 'Sessao expirada' }; }
  return res.json();
};

// ===== STYLES =====
const S: Record<string, any> = {
  card: { background: 'rgba(15,15,17,0.9)', border: '1px solid rgba(255,68,68,0.1)', borderRadius: 12, padding: 16 },
  input: { width: '100%', height: 44, background: 'rgba(20,20,22,0.8)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 10, padding: '0 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: "-apple-system,sans-serif", transition: 'border .3s', boxSizing: 'border-box' as const },
  btn: { height: 40, background: '#ff4444', border: 'none', borderRadius: 10, padding: '0 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif", transition: 'opacity .2s', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' as const },
  btnOutline: { height: 40, background: 'transparent', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 10, padding: '0 18px', color: '#ff4444', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif", transition: 'all .2s', display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' as const },
  textP: { color: '#fff' },
  textS: { color: '#888' },
  textW: { color: '#ff8c00' },
  textG: { color: '#4ade80' },
  badge: (color: string) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color, color: '#fff' }),
};

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

// ===== SPINNER =====
function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#888', fontSize: 13, padding: 20 }}><div style={{ width: 16, height: 16, border: '2px solid rgba(255,68,68,0.2)', borderTopColor: '#ff4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />A carregar...</div>;
}

function SpinnerInline() {
  return <div style={{ width: 14, height: 14, border: '2px solid rgba(255,68,68,0.2)', borderTopColor: '#ff4444', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} />;
}

// ===== LOGIN SCREEN =====
function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(false);
  const [booting, setBooting] = useState(false);
  const [step, setStep] = useState(0);
  const lines = ['A verificar credenciais...', 'A inicializar modulo...', 'A conectar APIs...', 'A preparar sessoes...', 'Sistema pronto.'];

  const tryLogin = async () => {
    if (!code) { setErr(true); setTimeout(() => setErr(false), 1500); return; }
    try {
      var res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: code }) });
      var data = await res.json();
      if (!data.success) { setErr(true); setTimeout(() => setErr(false), 1500); return; }
      ss('jt', data.token); // Guardar token de sessao
    } catch(e) { setErr(true); return; }
    setBooting(true);
    for (let i = 0; i < lines.length; i++) { setStep(i); await new Promise(r => setTimeout(r, 400)); }
    ss('ja', 'active');
    onLogin();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050505', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <Particles />
      {[
        { top: 12, left: 12, w: 30, h: 30, br: '2px solid rgba(255,68,68,0.15)', bb: 'none', bt: 'none', bl: 'none' },
        { top: 12, right: 12, w: 30, h: 30, br: 'none', bb: 'none', bt: 'none', bl: '2px solid rgba(255,68,68,0.15)' },
        { bottom: 12, left: 12, w: 30, h: 30, br: 'none', bb: '2px solid rgba(255,68,68,0.15)', bt: 'none', bl: 'none' },
        { bottom: 12, right: 12, w: 30, h: 30, br: 'none', bb: 'none', bt: '2px solid rgba(255,68,68,0.15)', bl: 'none' },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', ...s, borderTop: s.bt || s.br, borderRight: s.br, borderBottom: s.bb || s.br, borderLeft: s.bl || s.br }} />
      ))}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 340, padding: '0 24px' }}>
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
              placeholder="Introduz a tua senha"
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

// ===== DATA HELPER =====
function getProspects(): any[] { try { var r = sg('jp', ''); return r ? JSON.parse(r) : []; } catch(e) { return []; } }

// ===== TAB 1: CHAT =====
function ChatTab({ onLogout }: { onLogout: () => void }) {
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
      var parts = msg.match(/responde?\s*dm\s*(\d+)\s*(.*)/i) || [];
      if (parts.length < 3) { reply = 'Uso: "responde dm 1 Olá! Como posso ajudar?"'; }
      else {
        var convIdx = parseInt(parts[1]) - 1;
        var dmText = parts[2];
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
                {m.role === 'assistant' && <div style={{ color: '#ff2d2d', fontSize: 10, fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>JARVIS</div>}
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
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(); }} placeholder="Pergunte ou instrua o Jarvis..." style={{ width: '100%', height: 48, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 26, padding: '0 48px 0 20px', color: '#e8e8ec', fontSize: 14, outline: 'none', fontFamily: "-apple-system,sans-serif", transition: 'all .3s', boxSizing: 'border-box' as const }} />
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

// ===== TAB 2: ANALYTICS =====
function AnalyticsTab() {
  const [stats, setStats] = useState<any>(null);
  const [engagement, setEngagement] = useState<any[]>([]);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const fetchData = async () => {
    setLoading(true); setErr('');
    try {
      var [s, e, t] = await Promise.all([
        apiCall('/cmd/analytics', { action: 'get_stats' }),
        apiCall('/cmd/analytics', { action: 'get_engagement_history' }),
        apiCall('/cmd/analytics', { action: 'get_top_posts' }),
      ]);
      if (s.success) setStats(s.data);
      if (e.success) setEngagement(e.data || []);
      if (t.success) setTopPosts(t.data || []);
    } catch(e: any) { setErr('Erro ao carregar dados'); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  var pieData = [];
  if (stats) {
    var ig = stats.platforms?.ig?.followers || 0;
    var fb = stats.platforms?.fb?.handle ? 1 : 0;
    var tt = stats.platforms?.tt?.handle ? 1 : 0;
    if (ig > 0) pieData.push({ name: 'Instagram', value: ig, color: '#E1306C' });
    if (fb > 0) pieData.push({ name: 'Facebook', value: fb, color: '#1877F2' });
    if (tt > 0) pieData.push({ name: 'TikTok', value: tt, color: '#25F4EE' });
  }

  if (loading && !stats) return <Spinner />;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>📊 Analytics</div>
          <button onClick={fetchData} disabled={loading} style={{ ...S.btnOutline, padding: '0 12px', height: 34, fontSize: 12 }}><RefreshCw size={14} /></button>
        </div>

        {err && <div style={{ ...S.textW, fontSize: 12, textAlign: 'center' }}>{err}</div>}

        {/* STATS CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Total Seguidores', value: stats?.followers?.toLocaleString() || '0', icon: <Users size={16} /> },
            { label: 'Engajamento', value: stats?.engagementRate ? stats.engagementRate + '%' : '0%', icon: <TrendingUp size={16} /> },
            { label: 'Posts este mes', value: stats?.posts || '0', icon: <FileText size={16} /> },
            { label: 'DMs Enviados', value: '-', icon: <MessageSquare size={16} /> },
          ].map((c, i) => (
            <div key={i} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ ...S.textS, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{c.label}</span>
                <span style={{ color: '#ff4444' }}>{c.icon}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* ENGAGEMENT CHART */}
        {engagement.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Historico de Engajamento</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={engagement}>
                <XAxis dataKey="date" stroke="#555" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis stroke="#555" tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                <Line type="monotone" dataKey="metricValue" stroke="#ff4444" strokeWidth={2} dot={{ r: 3, fill: '#ff4444' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* PIE CHART */}
        {pieData.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Distribuicao por Plataforma</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, percent }: any) => name + ' ' + ((percent || 0) * 100).toFixed(0) + '%'}>
                  {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} stroke="#000" strokeWidth={1} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* TOP POSTS */}
        {topPosts.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Top Posts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topPosts.slice(0, 5).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.caption || 'Sem caption').slice(0, 60)}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ ...S.textS, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><Heart size={11} /> {p.likes || 0}</span>
                      <span style={{ ...S.textS, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><MessageSquare size={11} /> {p.comments || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== TAB 3: CRM =====
function CrmTab() {
  const [stats, setStats] = useState<any>(null);
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addUser, setAddUser] = useState('');
  const [addPlat, setAddPlat] = useState('instagram');

  const fetchData = async () => {
    setLoading(true);
    try {
      var [s, p] = await Promise.all([
        apiCall('/cmd/crm', { action: 'get_stats' }),
        apiCall('/cmd/crm', { action: 'list_prospects' }),
      ]);
      if (s.success) setStats(s.data);
      if (p.success) setProspects(p.data || []);
    } catch(e) { console.warn('JARVIS:', e); }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // One-time: migrate localStorage prospects to DB
    var localProspects = getProspects();
    if (localProspects.length > 0) {
      apiCall('/cmd/crm', { action: 'migrate_local', prospects: localProspects }).then(function(res: any) {
        if (res.success && res.data.migrated > 0) console.log('Migrados ' + res.data.migrated + ' prospects para a DB');
      });
    }
  }, []);

  const fetchMessages = async (prospectId: string) => {
    var res = await apiCall('/cmd/crm', { action: 'get_messages', prospectId });
    if (res.success) setMessages(res.data || []);
  };

  const handleImport = async () => {
    setImporting(true);
    await apiCall('/cmd/crm', { action: 'import_prospects', platform: 'instagram', source: 'followers' });
    await fetchData();
    setImporting(false);
  };

  const handleAdd = async () => {
    if (!addUser.trim()) return;
    var res = await apiCall('/cmd/crm', { action: 'add_prospect', username: addUser.replace('@', ''), platform: addPlat });
    if (res.success) { setShowAdd(false); setAddUser(''); await fetchData(); }
  };

  const updateStatus = async (id: string, status: string) => {
    await apiCall('/cmd/crm', { action: 'update_prospect', id, status });
    await fetchData();
  };

  const statusColor = (s: string) => {
    if (s === 'contacted' || s === 'contactado') return '#f59e0b';
    if (s === 'responded' || s === 'respondido') return '#4ade80';
    if (s === 'converted' || s === 'convertido') return '#3b82f6';
    if (s === 'lost' || s === 'perdido') return '#ef4444';
    return '#666';
  };

  const statusLabel = (s: string) => {
    if (s === 'contacted' || s === 'contactado') return 'Contactado';
    if (s === 'responded' || s === 'respondido') return 'Respondido';
    if (s === 'converted' || s === 'convertido') return 'Convertido';
    if (s === 'lost' || s === 'perdido') return 'Perdido';
    return 'Novo';
  };

  var filtered = prospects.filter((p: any) => !search || (p.username || '').toLowerCase().includes(search.toLowerCase()));

  if (loading && !stats) return <Spinner />;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>👥 CRM</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleImport} disabled={importing} style={{ ...S.btnOutline, padding: '0 12px', height: 34, fontSize: 11 }}>{importing ? 'A importar...' : 'Importar IG'}</button>
            <button onClick={() => setShowAdd(true)} style={{ ...S.btn, padding: '0 12px', height: 34, fontSize: 11 }}><Plus size={14} />Novo</button>
          </div>
        </div>

        {/* STATS */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total Prospects', value: stats.totalProspects || 0 },
              { label: 'Contactados', value: stats.byStatus?.contactado || stats.byStatus?.contacted || 0 },
              { label: 'Respondidos', value: stats.byStatus?.respondido || stats.byStatus?.responded || 0 },
              { label: 'Convertidos', value: stats.byStatus?.convertido || stats.byStatus?.converted || 0 },
            ].map((c, i) => (
              <div key={i} style={S.card}>
                <div style={{ ...S.textS, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#ff4444' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* SEARCH */}
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar username..." style={{ ...S.input, paddingLeft: 38 }} />
        </div>

        {/* TABLE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 && <div style={{ ...S.textS, fontSize: 13, textAlign: 'center', padding: 20 }}>Sem prospects</div>}
          {filtered.map((p: any) => (
            <div key={p.id} onClick={() => { setSelected(p); fetchMessages(p.id); }} style={{ ...S.card, cursor: 'pointer', padding: 12, display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color .2s' }}>
              {p.avatarUrl ? (
                <img src={p.avatarUrl} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4444', fontWeight: 700, fontSize: 14 }}>{(p.username || '?')[0].toUpperCase()}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>@{p.username || '?'}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{p.displayName || p.platform || ''}</div>
              </div>
              <span style={S.badge(statusColor(p.status))}>{statusLabel(p.status)}</span>
              <ChevronRight size={16} style={{ color: '#444' }} />
            </div>
          ))}
        </div>

        {/* DETAIL PANEL */}
        {selected && (
          <div style={{ ...S.card, position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', borderRadius: '16px 16px 0 0', zIndex: 50, maxHeight: '70vh', overflowY: 'auto', borderTop: '2px solid #ff4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>@{selected.username}</div>
              <button onClick={() => { setSelected(null); setMessages([]); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {['Novo', 'Contactado', 'Respondido', 'Convertido', 'Perdido'].map(s => (
                <button key={s} onClick={() => { updateStatus(selected.id, s.toLowerCase()); setSelected({ ...selected, status: s.toLowerCase() }); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: statusLabel(selected.status) === s ? '#ff4444' : 'rgba(255,255,255,0.06)', color: statusLabel(selected.status) === s ? '#fff' : '#888', transition: 'all .2s' }}>{s}</button>
              ))}
            </div>
            {messages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
                {messages.map((m: any, i: number) => (
                  <div key={i} style={{ padding: 8, borderRadius: 8, background: m.direction === 'outbound' ? 'rgba(255,68,68,0.08)' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{m.direction === 'outbound' ? 'Enviado' : 'Recebido'} · {ft(m.sentAt)}</div>
                    <div style={{ fontSize: 13, color: '#fff' }}>{m.content}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ ...S.textS, fontSize: 11 }}>{selected.bio || 'Sem bio'}</div>
          </div>
        )}

        {/* ADD MODAL */}
        {showAdd && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ ...S.card, width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Adicionar Prospect</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {['instagram', 'facebook', 'tiktok'].map(pl => (
                  <button key={pl} onClick={() => setAddPlat(pl)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: addPlat === pl ? '#ff4444' : 'rgba(255,255,255,0.06)', color: addPlat === pl ? '#fff' : '#888', textTransform: 'capitalize' }}>{pl}</button>
                ))}
              </div>
              <input value={addUser} onChange={e => setAddUser(e.target.value)} placeholder="@username" style={{ ...S.input, marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdd(false)} style={{ ...S.btnOutline, flex: 1 }}>Cancelar</button>
                <button onClick={handleAdd} style={{ ...S.btn, flex: 1 }}>Adicionar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== TAB 4: CONTENT =====
function ContentTab() {
  const [platform, setPlatform] = useState('instagram');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('profissional');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [hashTopic, setHashTopic] = useState('');
  const [hashCount, setHashCount] = useState(15);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashLoading, setHashLoading] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState<string | null>(null);
  const [pubPlatforms, setPubPlatforms] = useState<string[]>(['instagram']);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const generatePost = async () => {
    setGenerating(true);
    try {
      var body: any = { action: 'generate_post', platform, topic, tone, language: 'pt' };
      // Se ha media, converter para base64 e enviar
      if (mediaFile) {
        var reader = new FileReader();
        var base64 = await new Promise<string>((resolve) => { reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]); reader.readAsDataURL(mediaFile); });
        body.mediaData = base64;
        body.mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
      }
      var res = await apiCall('/cmd/content', body);
      if (res.success) setGenerated(res.data);
    } catch(e) { console.warn('JARVIS:', e); }
    setGenerating(false);
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    var file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Ficheiro muito grande (max 50MB)'); return; }
    setMediaFile(file);
    var url = URL.createObjectURL(file);
    setMediaPreview(url);
  };

  const removeMedia = () => { setMediaFile(null); setMediaPreview(null); if (mediaInputRef.current) mediaInputRef.current.value = ''; };

  const improveCaption = async () => {
    if (!generated?.caption) return;
    setGenerating(true);
    try {
      var res = await apiCall('/cmd/content', { action: 'improve_caption', caption: generated.caption, platform });
      if (res.success) setGenerated({ ...generated, caption: res.data.caption });
    } catch(e) { console.warn('JARVIS:', e); }
    setGenerating(false);
  };

  const generateHashtags = async () => {
    if (!hashTopic.trim()) return;
    setHashLoading(true);
    try {
      var res = await apiCall('/cmd/content', { action: 'generate_hashtags', topic: hashTopic, platform, count: hashCount });
      if (res.success) setHashtags(res.data || []);
    } catch(e) { console.warn('JARVIS:', e); }
    setHashLoading(false);
  };

  const fetchDrafts = async () => {
    setDraftsLoading(true);
    try {
      var res = await apiCall('/cmd/content', { action: 'list_drafts' });
      if (res.success) setDrafts(res.data || []);
    } catch(e) { console.warn('JARVIS:', e); }
    setDraftsLoading(false);
  };

  const publishDraft = async (id: string) => {
    setPublishing(id);
    try {
      await apiCall('/cmd/content', { action: 'publish_draft', id, platforms: pubPlatforms });
      await fetchDrafts();
      setShowPublish(null);
      setGenerated(null);
    } catch(e) { console.warn('JARVIS:', e); }
    setPublishing(null);
  };

  const deleteDraft = async (id: string) => {
    await apiCall('/cmd/content', { action: 'delete_draft', id });
    await fetchDrafts();
  };

  useEffect(() => { fetchDrafts(); }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>✨ Gerador de Conteudo</div>

        {/* GENERATE */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Criar Post</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {['instagram', 'facebook', 'tiktok', 'all'].map(pl => (
              <button key={pl} onClick={() => setPlatform(pl)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: platform === pl ? '#ff4444' : 'rgba(255,255,255,0.06)', color: platform === pl ? '#fff' : '#888', textTransform: 'capitalize' }}>{pl}</button>
            ))}
          </div>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topico do post..." style={{ ...S.input, marginBottom: 10 }} />
          <select value={tone} onChange={e => setTone(e.target.value)} style={{ ...S.input, marginBottom: 12, appearance: 'none', background: 'rgba(20,20,22,0.8) url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E") no-repeat right 14px center' }}>
            {['profissional', 'casual', 'criativo', 'engracado', 'inspirador'].map(t => <option key={t} value={t} style={{ background: '#1a1a1a' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>

          {/* MEDIA UPLOAD */}
          <input ref={mediaInputRef} type="file" accept="image/*,video/mp4,video/quicktime" style={{ display: 'none' }} onChange={handleMediaSelect} />
          {mediaPreview ? (
            <div style={{ position: 'relative', marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,68,68,0.2)' }}>
              {mediaFile?.type.startsWith('video') ? (
                <video src={mediaPreview} style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} muted />
              ) : (
                <img src={mediaPreview} style={{ width: '100%', maxHeight: 240, objectFit: 'cover' }} alt="preview" />
              )}
              <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                <div style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: 'rgba(0,0,0,0.7)', color: '#fff' }}>{(mediaFile?.size / 1024 / 1024).toFixed(1)}MB</div>
                <button onClick={removeMedia} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,0,0,0.8)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</button>
              </div>
            </div>
          ) : (
            <button onClick={() => mediaInputRef.current?.click()} style={{ width: '100%', height: 80, marginBottom: 12, background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,68,68,0.2)', borderRadius: 10, color: '#888', fontSize: 13, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Camera size={24} style={{ color: '#ff4444' }} />
              <span>Foto ou Video (max 50MB)</span>
            </button>
          )}
          <button onClick={generatePost} disabled={generating || !topic.trim()} style={{ ...S.btn, width: '100%' }}>{generating ? 'A gerar...' : 'Gerar Post'}</button>
        </div>

        {/* GENERATED */}
        {generated && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ ...S.badge('#ff4444') }}>{generated.platform || platform}</span>
              <span style={{ ...S.textS, fontSize: 11 }}>{(generated.caption || '').length} chars</span>
            </div>
            <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{generated.caption}</div>
            {generated.hashtags && generated.hashtags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {generated.hashtags.map((h: string, i: number) => (
                  <span key={i} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(255,68,68,0.1)', color: '#ff4444', fontWeight: 500 }}>{h}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard.writeText(generated.caption + (generated.hashtags ? '\n' + generated.hashtags.join(' ') : '')); }} style={{ ...S.btnOutline, flex: 1 }}>Copiar</button>
              <button onClick={improveCaption} disabled={generating} style={{ ...S.btnOutline, flex: 1 }}>Melhorar</button>
              <button onClick={() => setShowPublish('generated')} style={{ ...S.btn, flex: 1 }}>Publicar</button>
            </div>
          </div>
        )}

        {/* HASHTAGS */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Gerador de Hashtags</div>
          <input value={hashTopic} onChange={e => setHashTopic(e.target.value)} placeholder="Topico..." style={{ ...S.input, marginBottom: 10 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ ...S.textS, fontSize: 11, whiteSpace: 'nowrap' }}>{hashCount}</span>
            <input type="range" min="5" max="30" value={hashCount} onChange={e => setHashCount(parseInt(e.target.value))} style={{ flex: 1, accentColor: '#ff4444' }} />
          </div>
          <button onClick={generateHashtags} disabled={hashLoading || !hashTopic.trim()} style={{ ...S.btn, width: '100%', marginBottom: 12 }}>{hashLoading ? 'A gerar...' : 'Gerar Hashtags'}</button>
          {hashtags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {hashtags.map((h: string, i: number) => (
                <span key={i} onClick={() => { navigator.clipboard.writeText(h); }} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, background: 'rgba(255,68,68,0.1)', color: '#ff4444', fontWeight: 500, cursor: 'pointer' }}>{h}</span>
              ))}
            </div>
          )}
        </div>

        {/* DRAFTS */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Rascunhos</div>
            <button onClick={fetchDrafts} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><RefreshCw size={14} /></button>
          </div>
          {draftsLoading && <Spinner />}
          {drafts.length === 0 && !draftsLoading && <div style={{ ...S.textS, fontSize: 12, textAlign: 'center' }}>Sem rascunhos</div>}
          {drafts.map((d: any) => (
            <div key={d.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 12, color: '#fff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(d.caption || 'Sem caption').slice(0, 80)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={S.badge('rgba(255,68,68,0.2)')}>{d.platform || '?'}</span>
                  <span style={{ ...S.textS, fontSize: 10 }}>{new Date(d.createdAt).toLocaleDateString('pt-AO')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setShowPublish(d.id)} style={{ ...S.btn, padding: '0 10px', height: 28, fontSize: 10 }}>Pub</button>
                  <button onClick={() => deleteDraft(d.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PUBLISH MODAL */}
        {showPublish && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ ...S.card, width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Publicar</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {['instagram', 'facebook', 'tiktok'].map(pl => (
                  <label key={pl} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#fff' }}>
                    <input type="checkbox" checked={pubPlatforms.includes(pl)} onChange={e => { setPubPlatforms(e.target.checked ? [...pubPlatforms, pl] : pubPlatforms.filter(p => p !== pl)); }} style={{ accentColor: '#ff4444' }} />
                    {pl.toUpperCase()}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowPublish(null)} style={{ ...S.btnOutline, flex: 1 }}>Cancelar</button>
                <button onClick={() => publishDraft(showPublish)} disabled={!!publishing || pubPlatforms.length === 0} style={{ ...S.btn, flex: 1 }}>{publishing ? 'A publicar...' : 'Publicar'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== TAB 5: SCHEDULER =====
function SchedulerTab() {
  const [optimalTimes, setOptimalTimes] = useState<any>(null);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [schedStats, setSchedStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [timePlatform, setTimePlatform] = useState('instagram');
  const [schedContent, setSchedContent] = useState('');
  const [schedPlatforms, setSchedPlatforms] = useState(['instagram']);
  const [schedDate, setSchedDate] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      var [t, s, st] = await Promise.all([
        apiCall('/cmd/scheduler', { action: 'get_optimal_times' }),
        apiCall('/cmd/scheduler', { action: 'list_scheduled' }),
        apiCall('/cmd/scheduler', { action: 'get_schedule_stats' }),
      ]);
      if (t.success) setOptimalTimes(t.data);
      if (s.success) setScheduled(s.data || []);
      if (st.success) setSchedStats(st.data);
    } catch(e) { console.warn('JARVIS:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const schedulePost = async () => {
    if (!schedContent.trim()) return;
    setScheduling(true);
    var draftRes = await apiCall('/cmd/content', { action: 'generate_post', platform: schedPlatforms[0] || 'instagram', topic: schedContent, language: 'pt' });
    if (draftRes?.success && draftRes.data?.id) {
      await apiCall('/cmd/scheduler', { action: 'schedule_post', contentPostId: draftRes.data.id, platforms: schedPlatforms, scheduledFor: schedDate || undefined });
    }
    await fetchData();
    setSchedContent('');
    setSchedDate('');
    setScheduling(false);
  };

  const cancelScheduled = async (id: string) => {
    await apiCall('/cmd/scheduler', { action: 'cancel_scheduled', id });
    await fetchData();
  };

  var currentSlots = optimalTimes?.[timePlatform] || [];

  if (loading && !optimalTimes) return <Spinner />;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>⏰ Agendador</div>

        {/* STATS */}
        {schedStats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Pendentes', value: schedStats.pending || 0, color: '#f59e0b' },
              { label: 'Esta semana', value: schedStats.publishedThisWeek || 0, color: '#4ade80' },
              { label: 'Total', value: schedStats.total || 0, color: '#ff4444' },
            ].map((c, i) => (
              <div key={i} style={S.card}>
                <div style={{ ...S.textS, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* OPTIMAL TIMES */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 10 }}>Melhores Horarios</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['instagram', 'facebook', 'tiktok'].map(pl => (
              <button key={pl} onClick={() => setTimePlatform(pl)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: timePlatform === pl ? '#ff4444' : 'rgba(255,255,255,0.06)', color: timePlatform === pl ? '#fff' : '#888', textTransform: 'capitalize' }}>{pl}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {currentSlots.slice(0, 7).map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: s.recommended ? 'rgba(255,68,68,0.1)' : 'rgba(255,255,255,0.02)', border: '1px solid ' + (s.recommended ? 'rgba(255,68,68,0.3)' : 'rgba(255,255,255,0.06)') }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#fff' }}>{s.day} · {String(s.hour).padStart(2, '0')}:00</span>
                  {s.recommended && <span style={{ ...S.badge('#ff4444'), fontSize: 10 }}>Recomendado</span>}
                </div>
                {s.avgEngagement > 0 && <span style={{ ...S.textS, fontSize: 11 }}>Eng: {s.avgEngagement}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* QUICK SCHEDULE */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Agendar Post Rapido</div>
          <textarea value={schedContent} onChange={e => setSchedContent(e.target.value)} placeholder="Conteudo do post..." rows={3} style={{ ...S.input, minHeight: 60, resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            {['instagram', 'facebook', 'tiktok'].map(pl => (
              <label key={pl} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#fff' }}>
                <input type="checkbox" checked={schedPlatforms.includes(pl)} onChange={e => { setSchedPlatforms(e.target.checked ? [...schedPlatforms, pl] : schedPlatforms.filter(p => p !== pl)); }} style={{ accentColor: '#ff4444' }} />
                {pl.toUpperCase()}
              </label>
            ))}
          </div>
          <input type="datetime-local" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={{ ...S.input, marginBottom: 12, colorScheme: 'dark' }} />
          <button onClick={schedulePost} disabled={scheduling || !schedContent.trim()} style={{ ...S.btn, width: '100%' }}>{scheduling ? 'A agendar...' : 'Agendar'}</button>
        </div>

        {/* UPCOMING */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Posts Agendados</div>
            <button onClick={fetchData} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><RefreshCw size={14} /></button>
          </div>
          {scheduled.length === 0 && <div style={{ ...S.textS, fontSize: 12, textAlign: 'center', padding: 16 }}>Sem posts agendados</div>}
          {scheduled.map((s: any) => (
            <div key={s.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.content?.caption || 'Post sem caption'}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={S.badge('rgba(255,68,68,0.2)')}>{s.platforms || '?'}</span>
                  <span style={{ ...S.textS, fontSize: 10 }}>{new Date(s.scheduledFor).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
              <button onClick={() => cancelScheduled(s.id)} style={{ background: 'none', border: 'none', color: '#ff8c00', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== TAB 6: DMs =====
function DmTab() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [platform, setPlatform] = useState('all');
  const [apiKeys, setApiKeys] = useState({
    hiker: sg('jk_hiker', ''),
    uploadpost: sg('jk_uploadpost', ''),
    manychat: sg('jk_manychat', ''),
    n8n: sg('jk_n8n', ''),
  });
  const [showKeys, setShowKeys] = useState(false);
  const [keySaved, setKeySaved] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      var res = await apiCall('/cmd/zernio', { action: 'list_conversations', platform: platform !== 'all' ? platform : undefined, limit: 50 });
      if (res.success) {
        var convs = res.conversations?.data || res.conversations || [];
        if (!Array.isArray(convs) && convs.conversations) convs = convs.conversations;
        setConversations(convs);
      }
    } catch(e) { console.warn('JARVIS:', e); }
    setLoading(false);
  };

  const fetchAccounts = async () => {
    try {
      var res = await apiCall('/cmd/zernio', { action: 'list_accounts' });
      if (res.success) {
        var accs = res.accounts?.data || res.accounts || [];
        if (!Array.isArray(accs) && accs.accounts) accs = accs.accounts;
        setAccounts(accs);
      }
    } catch(e) { console.warn('JARVIS:', e); }
  };

  const openConversation = async (conv: any) => {
    setSelectedConv(conv);
    setMessages([]);
    try {
      var res = await apiCall('/cmd/zernio', { action: 'get_messages', conversationId: conv.id, limit: 30 });
      if (res.success) {
        var msgs = res.messages?.data || res.messages || [];
        if (!Array.isArray(msgs) && msgs.messages) msgs = msgs.messages;
        setMessages(msgs.reverse());
      }
      // Mark as read
      await apiCall('/cmd/zernio', { action: 'mark_read', conversationId: conv.id });
    } catch(e) { console.warn('JARVIS:', e); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selectedConv || sending) return;
    setSending(true);
    var text = replyText.trim();
    setReplyText('');
    try {
      var accId = selectedConv.accountId || selectedConv.account?.id || '';
      var res = await apiCall('/cmd/zernio', { action: 'send_dm', conversationId: selectedConv.id, accountId: accId, message: text });
      if (res.success) {
        setMessages(m => [...m, { id: uid(), text, isFromMe: true, createdAt: new Date().toISOString(), senderType: 'account' }]);
      }
    } catch(e) { console.warn('JARVIS:', e); }
    setSending(false);
  };

  const saveKey = (tool: string, val: string) => {
    ss('jk_' + tool, val);
    setApiKeys(k => ({ ...k, [tool]: val }));
    setKeySaved(tool);
    setTimeout(() => setKeySaved(''), 2000);
  };

  useEffect(() => { fetchConversations(); fetchAccounts(); }, [platform]);

  // Refresh conversations every 30s
  useEffect(() => { var t = setInterval(fetchConversations, 30000); return () => clearInterval(t); }, [platform]);

  var unreadTotal = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
  var platIcon = (p: string) => {
    if (!p) return <Radio size={12} />;
    if (p.includes('instagram')) return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>;
    if (p.includes('facebook')) return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
    return <Radio size={12} />;
  };
  var platColor = (p: string) => {
    if (!p) return '#888';
    if (p.includes('instagram')) return '#E1306C';
    if (p.includes('facebook')) return '#1877F2';
    if (p.includes('tiktok')) return '#25F4EE';
    return '#888';
  };
  var keyDefs = [
    { id: 'hiker', label: 'HikerAPI', desc: 'Dados de perfis Instagram (seguidores, stories)', color: '#ff8c00' },
    { id: 'uploadpost', label: 'Upload-Post', desc: 'Publicacao automatica em IG, FB, TikTok', color: '#4ade80' },
    { id: 'manychat', label: 'ManyChat', desc: 'Automacao de DMs via ManyChat', color: '#a78bfa' },
    { id: 'n8n', label: 'N8N Webhook', desc: 'Integracao com workflows N8N', color: '#38bdf8' },
  ];

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* LEFT PANEL — Conversation list */}
      <div style={{ width: 320, minWidth: 280, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(8,8,10,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Mail size={15} style={{ color: '#ff4444' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>DMs</span>
              {unreadTotal > 0 && <span style={{ ...S.badge('#ff4444'), fontSize: 10, padding: '1px 7px' }}>{unreadTotal}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowKeys(!showKeys)} style={{ background: 'none', border: 'none', color: showKeys ? '#ff4444' : '#666', cursor: 'pointer', padding: 3 }} title="API Keys"><Key size={14} /></button>
              <button onClick={fetchConversations} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 3 }}><RefreshCw size={14} /></button>
            </div>
          </div>
          {/* Platform filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'instagram', 'facebook', 'tiktok'].map(p => (
              <button key={p} onClick={() => setPlatform(p)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif",
                background: platform === p ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                color: platform === p ? '#ff4444' : '#666',
              }}>{p === 'all' ? 'Todos' : p === 'instagram' ? 'IG' : p === 'facebook' ? 'FB' : 'TT'}</button>
            ))}
          </div>
          {/* Connected accounts */}
          {accounts.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {accounts.map((a: any, i: number) => (
                <div key={a.id || i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', fontSize: 10, color: platColor(a.platform) }}>
                  {platIcon(a.platform)}
                  @{a.username || a.handle || a.name || '?'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* API Keys Panel */}
        {showKeys && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,68,68,0.02)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ff8c00', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Key size={12} />API Keys</div>
            {keyDefs.map(kd => (
              <div key={kd.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#ddd' }}>{kd.label}</span>
                  {apiKeys[kd.id as keyof typeof apiKeys] ? <CheckCircle size={12} style={{ color: '#4ade80' }} /> : <XCircle size={12} style={{ color: '#666' }} />}
                </div>
                <div style={{ fontSize: 9, color: '#666', marginBottom: 4 }}>{kd.desc}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="password"
                    value={apiKeys[kd.id as keyof typeof apiKeys]}
                    onChange={e => setApiKeys(k => ({ ...k, [kd.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveKey(kd.id, apiKeys[kd.id as keyof typeof apiKeys]); }}
                    placeholder={"Cole a " + kd.label + " key aqui..."}
                    style={{ flex: 1, height: 32, background: 'rgba(20,20,22,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0 10px', color: '#fff', fontSize: 11, outline: 'none', fontFamily: "-apple-system,sans-serif" }}
                  />
                  <button onClick={() => saveKey(kd.id, apiKeys[kd.id as keyof typeof apiKeys])} style={{ height: 32, padding: '0 12px', background: keySaved === kd.id ? '#4ade80' : 'rgba(255,68,68,0.15)', border: 'none', borderRadius: 8, color: keySaved === kd.id ? '#000' : '#ff4444', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif" }}>{keySaved === kd.id ? 'OK' : 'Guardar'}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <Spinner />}
          {!loading && conversations.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#555', fontSize: 12 }}>
              <Mail size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              Sem conversas
            </div>
          )}
          {conversations.map((conv: any, i: number) => {
            var isSelected = selectedConv?.id === conv.id;
            var name = conv.participant?.name || conv.participant?.username || conv.participant?.instagramUsername || conv.id?.slice(0, 12) || '?';
            var lastMsg = conv.lastMessage?.text || '';
            var lastTime = conv.lastMessage?.createdAt || conv.lastActivityAt || '';
            var unread = conv.unreadCount || 0;
            return (
              <div key={conv.id || i} onClick={() => openConversation(conv)} style={{
                padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isSelected ? 'rgba(255,68,68,0.08)' : 'transparent',
                borderLeft: isSelected ? '3px solid #ff4444' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: platColor(conv.platform), fontSize: 10 }}>{platIcon(conv.platform)}</span>
                    <span style={{ fontSize: 13, fontWeight: unread > 0 ? 700 : 500, color: '#fff' }}>{name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#555' }}>{lastTime ? ft(lastTime) : ''}</span>
                </div>
                <div style={{ fontSize: 11, color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastMsg}</div>
                {unread > 0 && <div style={{ position: 'absolute', right: 14, top: '50%', marginTop: -6, width: 18, height: 18, borderRadius: '50%', background: '#ff4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANEL — Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(5,5,7,0.4)' }}>
        {!selectedConv ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444', gap: 12 }}>
            <MessageSquare size={40} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 13, fontWeight: 500 }}>Selecciona uma conversa</div>
            <div style={{ fontSize: 11 }}>As mensagens aparecem aqui</div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,12,0.5)' }}>
              <button onClick={() => { setSelectedConv(null); setMessages([]); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}><ChevronLeft size={16} /></button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: platColor(selectedConv.platform), fontSize: 11 }}>{platIcon(selectedConv.platform)}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{selectedConv.participant?.name || selectedConv.participant?.username || selectedConv.participant?.instagramUsername || '?'}</span>
                </div>
                <div style={{ fontSize: 10, color: '#555' }}>{selectedConv.participant?.username ? '@' + selectedConv.participant.username : ''}</div>
              </div>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((msg: any, i: number) => {
                var isMe = msg.isFromMe || msg.senderType === 'account' || msg.direction === 'outgoing';
                return (
                  <div key={msg.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '75%', padding: '10px 14px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                      border: isMe ? '1px solid rgba(255,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.5 }}>{msg.text || ''}</div>
                      <div style={{ fontSize: 9, color: '#555', marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>{msg.createdAt ? ft(msg.createdAt) : ''}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>

            {/* Reply input */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(10,10,12,0.5)' }}>
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendReply(); }}
                placeholder="Escreve uma mensagem..."
                disabled={sending}
                style={{ flex: 1, height: 42, background: 'rgba(20,20,22,0.8)', border: '1px solid rgba(255,68,68,0.15)', borderRadius: 12, padding: '0 14px', color: '#fff', fontSize: 13, outline: 'none', fontFamily: "-apple-system,sans-serif" }}
              />
              <button onClick={sendReply} disabled={sending || !replyText.trim()} style={{
                width: 42, height: 42, borderRadius: 12, border: 'none',
                background: sending ? 'rgba(255,68,68,0.1)' : '#ff4444',
                color: sending ? '#666' : '#fff', cursor: sending ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Send size={16} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== TAB 7: SETTINGS =====
function SettingsTab() {
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState('');
  const [customSettings, setCustomSettings] = useState({
    agency_name: '',
    auto_reply_enabled: 'true',
    default_platform: 'instagram',
    report_frequency: 'weekly',
    dm_response_tone: 'profissional',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      var [info, sett] = await Promise.all([
        apiCall('/cmd/settings', { action: 'get_system_info' }),
        apiCall('/cmd/settings', { action: 'get_all' }),
      ]);
      if (info.success) setSysInfo(info.data);
      if (sett.success) {
        setSettings(sett.data);
        setCustomSettings(prev => ({
          ...prev,
          agency_name: sett.data.agency_name || 'Mwango Brain',
          auto_reply_enabled: sett.data.auto_reply_enabled || 'true',
          default_platform: sett.data.default_platform || 'instagram',
          report_frequency: sett.data.report_frequency || 'weekly',
          dm_response_tone: sett.data.dm_response_tone || 'profissional',
        }));
      }
    } catch(e) { console.warn('JARVIS:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const saveSettings = async () => {
    var res = await apiCall('/cmd/settings', { action: 'set_many', settings: customSettings });
    if (res.success) { setSaved('OK'); setTimeout(() => setSaved(''), 2000); await fetchData(); }
  };

  if (loading && !sysInfo) return <Spinner />;

  var envItems = sysInfo ? [
    { label: 'Turso DB', ok: sysInfo.hasTursoUrl },
    { label: 'HikerAPI', ok: sysInfo.hasHikerKey },
    { label: 'Upload-Post', ok: sysInfo.hasUploadPostKey },
    { label: 'Zernio DMs', ok: sysInfo.hasZernioKey },
    { label: 'OpenRouter IA', ok: sysInfo.hasOrKey },
    { label: 'Cron Secret', ok: sysInfo.hasCronSecret },
  ] : [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>⚙️ Configuracoes</div>

        {/* ENV STATUS */}
        {sysInfo && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Estado das APIs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {envItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                  {item.ok ? <CheckCircle size={14} style={{ color: '#4ade80' }} /> : <AlertTriangle size={14} style={{ color: '#ff8c00' }} />}
                  <span style={{ fontSize: 12, color: '#ccc' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ ...S.textS, fontSize: 11 }}>{sysInfo.region} · {sysInfo.nodeEnv}</span>
              {sysInfo.dbStats && <span style={{ ...S.textS, fontSize: 11 }}>{sysInfo.dbStats.prospects} prospects · {sysInfo.dbStats.scheduled} agendados</span>}
            </div>
          </div>
        )}

        {/* CUSTOM SETTINGS */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Preferencias</div>
            {saved && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Guardado!</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Nome da Agencia</div>
              <input value={customSettings.agency_name} onChange={e => setCustomSettings(s => ({ ...s, agency_name: e.target.value }))} style={S.input} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Plataforma Padrao</div>
              <select value={customSettings.default_platform} onChange={e => setCustomSettings(s => ({ ...s, default_platform: e.target.value }))} style={{ ...S.input, appearance: 'none' }}>
                {['instagram', 'facebook', 'tiktok'].map(p => <option key={p} value={p} style={{ background: '#1a1a1a' }}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Frequencia de Relatorios</div>
              <select value={customSettings.report_frequency} onChange={e => setCustomSettings(s => ({ ...s, report_frequency: e.target.value }))} style={{ ...S.input, appearance: 'none' }}>
                {['daily', 'weekly', 'biweekly', 'monthly'].map(f => <option key={f} value={f} style={{ background: '#1a1a1a' }}>{f === 'daily' ? 'Diario' : f === 'weekly' ? 'Semanal' : f === 'biweekly' ? 'Quinzenal' : 'Mensal'}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Tom de Resposta DMs</div>
              <select value={customSettings.dm_response_tone} onChange={e => setCustomSettings(s => ({ ...s, dm_response_tone: e.target.value }))} style={{ ...S.input, appearance: 'none' }}>
                {['profissional', 'casual', 'criativo', 'formal'].map(t => <option key={t} value={t} style={{ background: '#1a1a1a' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={customSettings.auto_reply_enabled === 'true'} onChange={e => setCustomSettings(s => ({ ...s, auto_reply_enabled: e.target.checked ? 'true' : 'false' }))} style={{ accentColor: '#ff4444', width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#fff' }}>Auto-resposta DMs activa</span>
            </div>
            <button onClick={saveSettings} style={{ ...S.btn, width: '100%' }}>Guardar Configuracoes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== TAB 8: REPORTS =====
function ReportsTab() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clientName, setClientName] = useState('Mwango Brain');
  const [period, setPeriod] = useState('30d');
  const [showGen, setShowGen] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      var res = await apiCall('/cmd/reports', { action: 'list' });
      if (res.success) setReports(res.data || []);
    } catch(e) { console.warn('JARVIS:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const generate = async () => {
    setGenerating(true);
    var days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 30;
    var start = new Date(Date.now() - days * 86400000).toISOString();
    var end = new Date().toISOString();
    await apiCall('/cmd/reports', { action: 'generate', clientName, periodStart: start, periodEnd: end });
    await fetchReports();
    setShowGen(false);
    setGenerating(false);
  };

  if (loading && reports.length === 0) return <Spinner />;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>📄 Relatorios</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchReports} style={{ ...S.btnOutline, padding: '0 12px', height: 34, fontSize: 12 }}><RefreshCw size={14} /></button>
            <button onClick={() => setShowGen(true)} style={{ ...S.btn, padding: '0 12px', height: 34, fontSize: 11 }}><Plus size={14} />Gerar</button>
          </div>
        </div>

        {/* GENERATE MODAL */}
        {showGen && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Novo Relatorio</div>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome do cliente" style={{ ...S.input, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {['7d', '30d', '90d'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: period === p ? '#ff4444' : 'rgba(255,255,255,0.06)', color: period === p ? '#fff' : '#888' }}>{p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowGen(false)} style={{ ...S.btnOutline, flex: 1 }}>Cancelar</button>
              <button onClick={generate} disabled={generating} style={{ ...S.btn, flex: 1 }}>{generating ? 'A gerar...' : 'Gerar'}</button>
            </div>
          </div>
        )}

        {/* REPORT LIST */}
        {reports.length === 0 && !loading && (
          <div style={{ ...S.textS, fontSize: 13, textAlign: 'center', padding: 40 }}>
            <FileBarChart size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            Sem relatorios gerados
          </div>
        )}
        {reports.map((r: any) => (
          <div key={r.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{r.clientName}</div>
              <span style={{ ...S.textS, fontSize: 10 }}>{new Date(r.generatedAt).toLocaleDateString('pt-AO')}</span>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{new Date(r.periodStart).toLocaleDateString('pt-AO')} — {new Date(r.periodEnd).toLocaleDateString('pt-AO')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[
                { label: 'Posts', value: r.postsPublished, color: '#ff4444' },
                { label: 'Likes', value: r.totalLikes, color: '#4ade80' },
                { label: 'DMs', value: r.totalDMs, color: '#38bdf8' },
              ].map((m, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: '#666' }}>{m.label}</div>
                </div>
              ))}
            </div>
            {r.summary && <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>{r.summary}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== TAB 9: A/B TESTING =====
function ABTestTab() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState('');
  const [abPlatform, setAbPlatform] = useState('instagram');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTests = async () => {
    setLoading(true);
    try {
      var res = await apiCall('/cmd/ab-test', { action: 'list' });
      if (res.success) setTests(res.data || []);
    } catch(e) { console.warn('JARVIS:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchTests(); }, []);

  const createTest = async () => {
    if (!topic.trim()) return;
    setCreating(true);
    await apiCall('/cmd/ab-test', { action: 'create', topic, platform: abPlatform });
    await fetchTests();
    setTopic('');
    setCreating(false);
  };

  const startTest = async (id: string) => {
    await apiCall('/cmd/ab-test', { action: 'start', id });
    await fetchTests();
  };

  const concludeTest = async (id: string) => {
    await apiCall('/cmd/ab-test', { action: 'conclude', id });
    await fetchTests();
  };

  const deleteTest = async (id: string) => {
    await apiCall('/cmd/ab-test', { action: 'delete', id });
    await fetchTests();
  };

  if (loading && tests.length === 0) return <Spinner />;

  var statusColor = (s: string) => {
    if (s === 'running') return '#4ade80';
    if (s === 'completed') return '#3b82f6';
    if (s === 'draft') return '#f59e0b';
    return '#666';
  };
  var statusLabel = (s: string) => {
    if (s === 'running') return 'A decorrer';
    if (s === 'completed') return 'Concluido';
    if (s === 'draft') return 'Rascunho';
    return s;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>🧪 A/B Testing</div>

        {/* CREATE */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Novo Teste</div>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Topico do post..." style={{ ...S.input, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['instagram', 'facebook', 'tiktok'].map(p => (
              <button key={p} onClick={() => setAbPlatform(p)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: abPlatform === p ? '#ff4444' : 'rgba(255,255,255,0.06)', color: abPlatform === p ? '#fff' : '#888', textTransform: 'capitalize' }}>{p}</button>
            ))}
          </div>
          <button onClick={createTest} disabled={creating || !topic.trim()} style={{ ...S.btn, width: '100%' }}>{creating ? 'A gerar variantes...' : 'Criar Teste A/B'}</button>
        </div>

        {/* TEST LIST */}
        {tests.length === 0 && !loading && (
          <div style={{ ...S.textS, fontSize: 13, textAlign: 'center', padding: 40 }}>
            <FlaskConical size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
            Sem testes A/B
          </div>
        )}
        {tests.map((t: any) => (
          <div key={t.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <span style={S.badge(statusColor(t.status))}>{statusLabel(t.status)}</span>
                  <span style={{ ...S.textS, fontSize: 10 }}>{t.platform}</span>
                  {t.winner && <span style={{ ...S.badge('#4ade80'), fontSize: 10 }}>Vencedor: {t.winner}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {t.status === 'draft' && <button onClick={() => startTest(t.id)} style={{ ...S.btn, padding: '0 10px', height: 28, fontSize: 10 }}>Iniciar</button>}
                {t.status === 'running' && <button onClick={() => concludeTest(t.id)} style={{ ...S.btn, padding: '0 10px', height: 28, fontSize: 10 }}>Concluir</button>}
                <button onClick={() => deleteTest(t.id)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
              </div>
            </div>
            <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: 11, padding: 0, marginBottom: 8 }}>{expandedId === t.id ? 'Ocultar' : 'Ver variantes'}</button>
            {expandedId === t.id && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,68,68,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#ff4444', marginBottom: 6 }}>Variante A</div>
                  <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5, marginBottom: 8 }}>{(t.variantA || '').slice(0, 200)}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#888' }}>
                    <span>L: {t.likesA}</span><span>C: {t.commentsA}</span><span>I: {t.impressionsA}</span>
                  </div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,189,248,0.15)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8', marginBottom: 6 }}>Variante B</div>
                  <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5, marginBottom: 8 }}>{(t.variantB || '').slice(0, 200)}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#888' }}>
                    <span>L: {t.likesB}</span><span>C: {t.commentsB}</span><span>I: {t.impressionsB}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== MAIN APP SHELL =====
function MainApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState('chat');
  const [clock, setClock] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'running' | 'active'>('idle');
  const [notifPanel, setNotifPanel] = useState(false);

  // Clock
  useEffect(() => {
    var t = setInterval(() => { setClock(new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }, 1000);
    return () => clearInterval(t);
  }, []);

  // Autonomous polling — check DMs every 60 seconds
  useEffect(() => {
    setAutoStatus('active');

    var fetchNotifs = async () => {
      try {
        var res = await fetch('/cmd/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') }, body: JSON.stringify({ action: 'get_notifications', unreadOnly: true }) });
        var data = await res.json();
        if (data.success) {
          setUnreadCount((data.data || []).length);
        }
      } catch(e) { console.warn('JARVIS:', e); }
    };

    var runAutonomousCycle = async () => {
      setAutoStatus('running');
      try {
        await fetch('/cmd/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') }, body: JSON.stringify({ action: 'full_cycle' }) });
        await fetchNotifs();
      } catch(e) { console.warn('JARVIS:', e); }
      setAutoStatus('active');
    };

    // Initial check
    fetchNotifs();

    // Auto-cycle every 90 seconds
    var cycleInterval = setInterval(runAutonomousCycle, 90000);

    // Check notifications every 30 seconds
    var notifInterval = setInterval(fetchNotifs, 30000);

    return () => { clearInterval(cycleInterval); clearInterval(notifInterval); };
  }, []);

  const fetchAllNotifs = async () => {
    try {
      var res = await fetch('/cmd/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') }, body: JSON.stringify({ action: 'get_notifications', unreadOnly: false }) });
      var data = await res.json();
      if (data.success) setNotifications(data.data || []);
    } catch(e) { console.warn('JARVIS:', e); }
  };

  const markAllRead = async () => {
    await apiCall('/cmd/autonomous', { action: 'mark_all_read' });
    setUnreadCount(0);
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const toggleNotifs = async () => {
    if (!showNotifs) { await fetchAllNotifs(); }
    setShowNotifs(!showNotifs);
  };

  var tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'dms', label: 'DMs', icon: '📨' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'content', label: 'Content', icon: '✨' },
    { id: 'scheduler', label: 'Scheduler', icon: '⏰' },
    { id: 'abtest', label: 'A/B', icon: '🧪' },
    { id: 'reports', label: 'Reports', icon: '📄' },
    { id: 'settings', label: 'Config', icon: '⚙️' },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <Particles />

      {/* NAV BAR */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HexLogo size={28} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' }}>JARVIS</span>
          {/* Autonomous status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: autoStatus === 'active' ? 'rgba(74,222,128,0.1)' : autoStatus === 'running' ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (autoStatus === 'active' ? 'rgba(74,222,128,0.3)' : autoStatus === 'running' ? 'rgba(255,68,68,0.3)' : 'rgba(255,255,255,0.1)') }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: autoStatus === 'active' ? '#4ade80' : autoStatus === 'running' ? '#ff4444' : '#666', animation: autoStatus === 'running' ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ fontSize: 9, color: autoStatus === 'active' ? '#4ade80' : autoStatus === 'running' ? '#ff4444' : '#666', fontWeight: 600, letterSpacing: 0.5 }}>{autoStatus === 'active' ? 'AUTONOMO' : autoStatus === 'running' ? 'ACTIVO...' : 'OFF'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '6px 10px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #ff4444' : '2px solid transparent', color: tab === t.id ? '#ff4444' : '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif", transition: 'all .2s', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
              <span style={{ marginRight: 3 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Notification Bell */}
          <button onClick={toggleNotifs} style={{ position: 'relative', background: 'none', border: 'none', color: unreadCount > 0 ? '#ff4444' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}>
            <Bell size={16} />
            {unreadCount > 0 && <div style={{ position: 'absolute', top: -2, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ff4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #000' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>}
          </button>
          <span style={{ fontSize: 10, color: '#888', fontFamily: "'SF Mono',Menlo,monospace", fontWeight: 500 }}>{clock}</span>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2 }}><LogOut size={14} /></button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {tab === 'chat' && <ChatTab onLogout={onLogout} />}
        {tab === 'dms' && <DmTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'crm' && <CrmTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'scheduler' && <SchedulerTab />}
        {tab === 'abtest' && <ABTestTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>

      {/* NOTIFICATION PANEL */}
      {showNotifs && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '100vw', background: 'rgba(10,10,12,0.98)', borderLeft: '1px solid rgba(255,68,68,0.15)', zIndex: 200, display: 'flex', flexDirection: 'column', animation: 'slideInRight .2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Notificacoes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 10, color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpar tudo</button>}
              <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {notifications.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: 13, padding: 40 }}>Sem notificacoes</div>}
            {notifications.map((n: any, i: number) => (
              <div key={n.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: n.isRead ? 'none' : '3px solid #ff4444', background: n.isRead ? 'transparent' : 'rgba(255,68,68,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{n.platform || 'SISTEMA'}</span>
                  <span style={{ fontSize: 9, color: '#555' }}>{ft(n.createdAt)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{n.title}</div>
                {n.message && <div style={{ fontSize: 11, color: '#999', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{n.message}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOME INDICATOR */}
      <div style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: 'rgba(255,255,255,0.3)', borderRadius: 100, zIndex: 100 }} />
    </div>
  );
}

// ===== MAIN =====
export default function JarvisApp() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    var token = sg('jt', '');
    if (!token) { setLoading(false); return; }
    fetch('/api/auth', { method: 'GET', headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.ok)
      .then(valid => {
        if (valid) setAuthed(true);
        else { sd('jt'); sd('ja'); }
        setLoading(false);
      })
      .catch(() => { sd('jt'); sd('ja'); setLoading(false); });
  }, []);

  if (loading) return <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>A carregar...</div></div>;

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return <MainApp onLogout={() => setAuthed(false)} />;
}
