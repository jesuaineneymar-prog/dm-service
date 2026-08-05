'use client';
import { useState, useEffect } from 'react';
import { Trash2, FlaskConical } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB 9: A/B TESTING =====
export function ABTestTab() {
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
    } catch(e) { console.warn('Aura:', e); }
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
