'use client';
import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MessageSquare, Users, TrendingUp, Eye, Heart, FileText, RefreshCw } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB 2: ANALYTICS =====
export function AnalyticsTab() {
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
            { label: 'DMs Enviados', value: stats?.dmStats?.coldDmSent || '0', icon: <MessageSquare size={16} /> },
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

        {/* PLATFORM BREAKDOWN */}
        {stats?.platforms && (stats.platforms.ig?.followers || stats.platforms.fb?.likes) && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Por Plataforma</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.platforms.ig?.source !== 'none' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E1306C' }} />
                    <span style={{ ...S.textP, fontSize: 12 }}>Instagram</span>
                  </div>
                  <span style={{ ...S.textP, fontSize: 13, fontWeight: 700 }}>{(stats.platforms.ig?.followers || 0).toLocaleString()}</span>
                </div>
              )}
              {stats.platforms.fb?.source !== 'none' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1877F2' }} />
                    <span style={{ ...S.textP, fontSize: 12 }}>Facebook</span>
                  </div>
                  <span style={{ ...S.textP, fontSize: 13, fontWeight: 700 }}>{(stats.platforms.fb?.likes || 0).toLocaleString()}</span>
                </div>
              )}
              {stats?.crmStats && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                    <span style={{ ...S.textP, fontSize: 12 }}>CRM Contacts</span>
                  </div>
                  <span style={{ ...S.textP, fontSize: 13, fontWeight: 700 }}>{stats.crmStats.contacted}/{stats.crmStats.total}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FB POSTS */}
        {stats?.fbPosts?.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Posts Facebook</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.fbPosts.slice(0, 5).map((p: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.caption || 'Sem caption').slice(0, 60)}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      <span style={{ ...S.textS, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><Heart size={11} /> {p.likes || 0}</span>
                      <span style={{ ...S.textS, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><MessageSquare size={11} /> {p.comments || 0}</span>
                      <span style={{ ...S.textS, fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={11} /> {p.shares || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
