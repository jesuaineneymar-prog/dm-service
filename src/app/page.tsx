'use client';
import { useState, useEffect } from 'react';
import { sg, sd } from './components/ui';
import { LoginScreen } from './components/LoginScreen';
import { MainApp } from './components/MainApp';

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
