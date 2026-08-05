'use client';
import { useState } from 'react';
import { Particles, HexLogo, ss } from './ui';

// ===== LOGIN SCREEN =====
export function LoginScreen({ onLogin }: { onLogin: () => void }) {
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
        <div style={{ fontFamily: "-apple-system,'SF Pro Display',sans-serif", fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: 4, marginTop: 16 }}>Aura</div>
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
