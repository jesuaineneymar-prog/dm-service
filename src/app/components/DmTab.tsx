'use client';
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, RefreshCw, Bot, Shield, Radio, Key, Mail, CheckCircle, XCircle, ChevronLeft } from 'lucide-react';
import { Spinner, SpinnerInline, uid, ft, apiCall, sg, ss, S } from './ui';

// ===== TAB 6: DMs =====
export function DmTab() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
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
  const [showSteelLogin, setShowSteelLogin] = useState(false);
  const [steelLoading, setSteelLoading] = useState('');
  const [steelResult, setSteelResult] = useState<any>(null);
  const [steelLoginStatus, setSteelLoginStatus] = useState<{ ig?: boolean; fb?: boolean } | null>(null);
  const [autoLoginUser, setAutoLoginUser] = useState('');
  const [autoLoginPass, setAutoLoginPass] = useState('');
  const [autoLoginLoading, setAutoLoginLoading] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [autoReplying, setAutoReplying] = useState(false);
  const [coldDmTarget, setColdDmTarget] = useState('');
  const [coldDmSending, setColdDmSending] = useState(false);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchConversations = async () => {
    setLoading(true); setErr('');
    try {
      var res = await apiCall('/cmd/zernio', { action: 'list_conversations', platform: platform !== 'all' ? platform : undefined, limit: 50 });
      if (res.success) {
        var convs = res.conversations?.data || res.conversations || [];
        if (!Array.isArray(convs) && convs.conversations) convs = convs.conversations;
        setConversations(convs);
      } else if (res.error) { setErr(res.error); }
    } catch(e: any) { setErr('Erro de conexao'); }
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
    } catch(e) { console.warn('Aura:', e); }
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
    } catch(e) { console.warn('Aura:', e); }
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
    } catch(e) { console.warn('Aura:', e); }
    setSending(false);
  };

  const saveKey = (tool: string, val: string) => {
    ss('jk_' + tool, val);
    setApiKeys(k => ({ ...k, [tool]: val }));
    setKeySaved(tool);
    setTimeout(() => setKeySaved(''), 2000);
  };

  const autoReplyDMs = async () => {
    setAutoReplying(true);
    try { await apiCall('/cmd/publish', { action: 'auto_reply_dms', platform: platform !== 'all' ? platform : undefined, limit: 5, replyAll: false }); fetchConversations(); } catch(e) { console.warn('Aura:', e); }
    setAutoReplying(false);
  };

  const sendColdDm = async () => {
    if (!coldDmTarget.trim()) return;
    setColdDmSending(true);
    try {
      var res = await apiCall('/cmd/publish', { action: 'cold_dm', platform: 'instagram', target: coldDmTarget.trim().replace(/^@/, ''), aiGenerate: true, context: 'prospecto' });
      if (res.success) setColdDmTarget('');
    } catch(e) { console.warn('Aura:', e); }
    setColdDmSending(false);
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
              <button onClick={autoReplyDMs} disabled={autoReplying} style={{ background: 'none', border: 'none', color: autoReplying ? '#4ade80' : '#666', cursor: 'pointer', padding: 3 }} title="Auto-Reply DMs"><Bot size={14} /></button>
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
          {/* Cold DM Quick Send */}
          <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
            <input value={coldDmTarget} onChange={e => setColdDmTarget(e.target.value)} placeholder="@username" style={{ ...S.input, height: 30, fontSize: 11, padding: '0 10px', flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') sendColdDm(); }} />
            <button onClick={sendColdDm} disabled={coldDmSending || !coldDmTarget.trim()} style={{ ...S.btn, height: 30, fontSize: 10, padding: '0 10px' }}>{coldDmSending ? '...' : 'DM'}</button>
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

        {/* STEEL BROWSER LOGIN — Para DMs proactivos */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,68,68,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={12} style={{ color: '#ff4444' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#ddd' }}>Browser Login (DMs Proactivos)</span>
            </div>
            <button onClick={() => setShowSteelLogin(!showSteelLogin)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 10 }}>{showSteelLogin ? 'Fechar' : 'Abrir'}</button>
          </div>
          {showSteelLogin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* AUTO LOGIN FORM */}
              <div style={{ fontSize: 10, color: '#888', lineHeight: 1.5 }}>
                Entra com as credenciais e clica "Auto Login" — o sistema faz tudo automaticamente. So precisas fazer UMA VEZ.
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={autoLoginUser} onChange={e => setAutoLoginUser(e.target.value)} placeholder="Usuario / Email" style={{ flex: 1, height: 32, background: 'rgba(20,20,22,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0 10px', color: '#fff', fontSize: 11, outline: 'none', fontFamily: "-apple-system,sans-serif" }} />
                <input value={autoLoginPass} onChange={e => setAutoLoginPass(e.target.value)} type="password" placeholder="Senha" style={{ flex: 1, height: 32, background: 'rgba(20,20,22,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0 10px', color: '#fff', fontSize: 11, outline: 'none', fontFamily: "-apple-system,sans-serif" }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={async () => {
                  if (!autoLoginUser || !autoLoginPass) { setSteelResult({ error: 'Preenche usuario e senha' }); return; }
                  setAutoLoginLoading('ig'); setSteelResult(null);
                  var r = await apiCall('/cmd/dm', { action: 'auto_login', platform: 'instagram', username: autoLoginUser, password: autoLoginPass });
                  setAutoLoginLoading('');
                  if (r.success) { setSteelResult({ platform: 'instagram', success: true, step: r.step }); setAutoLoginUser(''); setAutoLoginPass(''); }
                  else setSteelResult({ platform: 'instagram', error: r.error, step: r.step, viewerUrl: r.viewerUrl });
                }} disabled={autoLoginLoading === 'ig' || !autoLoginUser || !autoLoginPass} style={{
                  flex: 1, height: 36, border: 'none', borderRadius: 8, background: (autoLoginLoading === 'ig' || !autoLoginUser || !autoLoginPass) ? 'rgba(225,48,108,0.15)' : 'rgba(225,48,108,0.3)', color: '#E1306C', fontSize: 11, fontWeight: 700, cursor: (autoLoginLoading === 'ig' || !autoLoginUser || !autoLoginPass) ? 'default' : 'pointer', fontFamily: "-apple-system,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  {autoLoginLoading === 'ig' ? <><SpinnerInline />Logando IG...</> : <>Auto Login Instagram</>}
                </button>
                <button onClick={async () => {
                  if (!autoLoginUser || !autoLoginPass) { setSteelResult({ error: 'Preenche usuario e senha' }); return; }
                  setAutoLoginLoading('fb'); setSteelResult(null);
                  var r = await apiCall('/cmd/dm', { action: 'auto_login', platform: 'facebook', username: autoLoginUser, password: autoLoginPass });
                  setAutoLoginLoading('');
                  if (r.success) { setSteelResult({ platform: 'facebook', success: true, step: r.step }); setAutoLoginUser(''); setAutoLoginPass(''); }
                  else setSteelResult({ platform: 'facebook', error: r.error, step: r.step, viewerUrl: r.viewerUrl });
                }} disabled={autoLoginLoading === 'fb' || !autoLoginUser || !autoLoginPass} style={{
                  flex: 1, height: 36, border: 'none', borderRadius: 8, background: (autoLoginLoading === 'fb' || !autoLoginUser || !autoLoginPass) ? 'rgba(24,119,242,0.15)' : 'rgba(24,119,242,0.3)', color: '#1877F2', fontSize: 11, fontWeight: 700, cursor: (autoLoginLoading === 'fb' || !autoLoginUser || !autoLoginPass) ? 'default' : 'pointer', fontFamily: "-apple-system,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  {autoLoginLoading === 'fb' ? <><SpinnerInline />Logando FB...</> : <>Auto Login Facebook</>}
                </button>
              </div>
              {/* Check login status */}
              <button onClick={async () => {
                var ig = await apiCall('/cmd/dm', { action: 'check_login', platform: 'instagram' });
                var fb = await apiCall('/cmd/dm', { action: 'check_login', platform: 'facebook' });
                setSteelLoginStatus({ ig: ig.loggedIn, fb: fb.loggedIn });
              }} style={{ height: 30, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#888', fontSize: 10, cursor: 'pointer', fontFamily: "-apple-system,sans-serif" }}>
                Verificar status dos logins
              </button>
              {steelLoginStatus && (
                <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                  <span style={{ color: steelLoginStatus.ig ? '#4ade80' : '#ff8c00' }}>IG: {steelLoginStatus.ig ? 'Logado' : 'Nao logado'}</span>
                  <span style={{ color: steelLoginStatus.fb ? '#4ade80' : '#ff8c00' }}>FB: {steelLoginStatus.fb ? 'Logado' : 'Nao logado'}</span>
                </div>
              )}
              {/* Result */}
              {steelResult && (
                <div style={{ padding: 10, borderRadius: 8, background: steelResult.error ? 'rgba(255,140,0,0.08)' : 'rgba(74,222,128,0.06)', border: '1px solid ' + (steelResult.error ? 'rgba(255,140,0,0.2)' : 'rgba(74,222,128,0.15)') }}>
                  {steelResult.error ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#ff8c00', marginBottom: 4 }}>Erro: {steelResult.step}</div>
                      <div style={{ fontSize: 10, color: '#cc8833' }}>{steelResult.error}</div>
                      {steelResult.viewerUrl && <a href={steelResult.viewerUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 6, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#ff8c00', fontSize: 10, textDecoration: 'none' }}>Abrir navegador manualmente</a>}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', marginBottom: 4 }}>
                        {steelResult.platform === 'instagram' ? 'Instagram' : 'Facebook'}: {steelResult.step === 'already_logged_in' ? 'Ja estava logado!' : 'Login automatico bem sucedido!'}
                      </div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>Sessao salva. DMs proactivos prontos.</div>
                    </div>
                  )}
                </div>
              )}
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
          {err && !loading && <div style={{ textAlign: 'center', padding: '20px 16px', color: '#ff8c00', fontSize: 12 }}>{err}</div>}
          {!loading && !err && conversations.length === 0 && (
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
