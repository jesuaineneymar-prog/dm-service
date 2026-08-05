'use client';
import { useState, useEffect } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB 5: SCHEDULER =====
export function SchedulerTab() {
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
    } catch(e) { console.warn('Aura:', e); }
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
