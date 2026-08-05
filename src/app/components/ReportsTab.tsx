'use client';
import { useState, useEffect } from 'react';
import { Plus, RefreshCw, FileBarChart } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB 8: REPORTS =====
export function ReportsTab() {
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
    } catch(e) { console.warn('Aura:', e); }
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
