'use client';
import { useState, useEffect } from 'react';
import { Plus, ChevronRight, Search } from 'lucide-react';
import { Spinner, ft, apiCall, S, getProspects } from './ui';

// ===== TAB 3: CRM =====
export function CrmTab() {
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
    } catch(e) { console.warn('Aura:', e); }
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
