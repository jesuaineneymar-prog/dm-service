'use client';
import { useState, useEffect } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB: CAMPAIGNS =====
export function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState('instagram');
  const [newObjective, setNewObjective] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newContext, setNewContext] = useState('');
  const [newTargets, setNewTargets] = useState('');
  const [executing, setExecuting] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    var [cRes, sRes] = await Promise.all([
      apiCall('/cmd/campaigns', { action: 'list' }),
      apiCall('/cmd/campaigns', { action: 'stats' }),
    ]);
    if (cRes.success) setCampaigns(cRes.data || []);
    if (sRes.success) setStats(sRes.data);
    setLoading(false);
  };

  const createCampaign = async () => {
    if (!newName.trim()) return;
    var targets = newTargets.trim().split('\n').filter(function(t: string) { return t.trim(); }).map(function(t: string) { return { username: t.trim().replace(/^@/, '') }; });
    var res = await apiCall('/cmd/campaigns', { action: 'create', name: newName, platform: newPlatform, objective: newObjective, baseMessage: newMessage, context: newContext, targets });
    if (res.success) { setShowCreate(false); setNewName(''); setNewObjective(''); setNewMessage(''); setNewContext(''); setNewTargets(''); fetchCampaigns(); }
  };

  const executeCampaign = async (id: string) => {
    setExecuting(id);
    await apiCall('/cmd/campaigns', { action: 'execute', id });
    setExecuting(null);
    fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    await apiCall('/cmd/campaigns', { action: 'delete', id });
    fetchCampaigns();
  };

  useEffect(() => { fetchCampaigns(); }, []);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Campanhas</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={fetchCampaigns} disabled={loading} style={{ ...S.btnOutline, padding: '0 12px', height: 34, fontSize: 12 }}><RefreshCw size={14} /></button>
            <button onClick={() => setShowCreate(!showCreate)} style={{ ...S.btn, padding: '0 12px', height: 34, fontSize: 12 }}>+ Nova</button>
          </div>
        </div>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Total', value: stats.total },
              { label: 'Enviados', value: stats.totalSent, color: '#4ade80' },
              { label: 'Taxa', value: stats.successRate, color: '#ff4444' },
            ].map((c: any, i: number) => (
              <div key={i} style={S.card}>
                <div style={{ ...S.textS, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color || '#fff' }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {showCreate && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Nova Campanha</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da campanha" style={{ ...S.input, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {['instagram', 'facebook'].map(p => (
                <button key={p} onClick={() => setNewPlatform(p)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: newPlatform === p ? '#ff4444' : 'rgba(255,255,255,0.06)', color: newPlatform === p ? '#fff' : '#888', textTransform: 'capitalize' }}>{p}</button>
              ))}
            </div>
            <input value={newObjective} onChange={e => setNewObjective(e.target.value)} placeholder="Objectivo (ex: vender servico de branding)" style={{ ...S.input, marginBottom: 8 }} />
            <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Mensagem base (deixe vazio para IA gerar)" style={{ ...S.input, height: 60, resize: 'none', marginBottom: 8 }} />
            <textarea value={newContext} onChange={e => setNewContext(e.target.value)} placeholder="Contexto extra para a IA" style={{ ...S.input, height: 40, resize: 'none', marginBottom: 8 }} />
            <textarea value={newTargets} onChange={e => setNewTargets(e.target.value)} placeholder="Alvos (um username por linha)\n@user1\n@user2" style={{ ...S.input, height: 80, resize: 'none', marginBottom: 10, fontFamily: "'SF Mono',Menlo,monospace", fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createCampaign} style={{ ...S.btn, flex: 1 }}>Criar</button>
              <button onClick={() => setShowCreate(false)} style={{ ...S.btnOutline, flex: 1 }}>Cancelar</button>
            </div>
          </div>
        )}

        {loading && !campaigns.length && <Spinner />}
        {campaigns.length === 0 && !loading && <div style={{ ...S.textS, fontSize: 12, textAlign: 'center' }}>Sem campanhas. Cria a primeira.</div>}
        {campaigns.map((c: any) => (
          <div key={c.id} style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{c.name}</div>
                <div style={{ ...S.textS, fontSize: 11, marginTop: 2 }}>{c.platform} | {c.targetCount} alvos | {c.status}</div>
              </div>
              {S.badge(c.status === 'completed' ? '#4ade80' : c.status === 'running' ? '#ff8c00' : c.status === 'draft' ? '#666' : '#ff4444')(c.status)}
            </div>
            {c.objective && <div style={{ ...S.textS, fontSize: 11, marginBottom: 6 }}>Obj: {c.objective}</div>}
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              <span style={{ ...S.textG, fontSize: 12 }}>{c.sentCount} enviados</span>
              <span style={{ color: '#ff4444', fontSize: 12 }}>{c.failedCount} falhados</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {c.status === 'draft' && <button onClick={() => executeCampaign(c.id)} disabled={executing === c.id} style={{ ...S.btn, padding: '0 12px', height: 32, fontSize: 11 }}>{executing === c.id ? 'A enviar...' : 'Executar'}</button>}
              <button onClick={() => deleteCampaign(c.id)} style={{ ...S.btnOutline, padding: '0 12px', height: 32, fontSize: 11, borderColor: 'rgba(255,0,0,0.3)', color: '#ff4444' }}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
