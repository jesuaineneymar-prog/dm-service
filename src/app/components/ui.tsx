'use client';
import { useEffect, useRef } from 'react';

// ===== HELPERS =====
const sg = (k: string, d?: string) => { try { var v = localStorage?.getItem(k); return v || d || ''; } catch(e) { return d || ''; } };
const ss = (k: string, v: string) => { try { localStorage?.setItem(k, v); } catch(e) { console.warn('Aura:', e); } };
const sd = (k: string) => { try { localStorage?.removeItem(k); } catch(e) { console.warn('Aura:', e); } };
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

// ===== DATA HELPER =====
function getProspects(): any[] { try { var r = sg('jp', ''); return r ? JSON.parse(r) : []; } catch(e) { return []; } }

export { S, sg, ss, sd, uid, ft, apiCall, Particles, HexLogo, Spinner, SpinnerInline, getProspects };
