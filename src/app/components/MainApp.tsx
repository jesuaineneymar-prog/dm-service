'use client';
import { useState, useEffect } from 'react';
import { LogOut, Bell } from 'lucide-react';
import { Particles, HexLogo, ft, apiCall, sg } from './ui';
import { ChatTab } from './ChatTab';
import { DmTab } from './DmTab';
import { AnalyticsTab } from './AnalyticsTab';
import { CrmTab } from './CrmTab';
import { ContentTab } from './ContentTab';
import { SchedulerTab } from './SchedulerTab';
import { CampaignsTab } from './CampaignsTab';
import { ABTestTab } from './ABTestTab';
import { ReportsTab } from './ReportsTab';
import { SettingsTab } from './SettingsTab';
import { McpTab } from './McpTab';

// ===== MAIN APP SHELL =====
export function MainApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState('chat');
  const [clock, setClock] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'running' | 'active'>('idle');
  const [notifPanel, setNotifPanel] = useState(false);

  // Clock
  useEffect(() => {
    var t = setInterval(() => { setClock(new Date().toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })); }, 1000);
    return () => clearInterval(t);
  }, []);

  // Autonomous polling — check DMs every 60 seconds
  useEffect(() => {
    setAutoStatus('active');

    var fetchNotifs = async () => {
      try {
        var res = await fetch('/cmd/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') }, body: JSON.stringify({ action: 'get_notifications', unreadOnly: true }) });
        var data = await res.json();
        if (data.success) {
          setUnreadCount((data.data || []).length);
        }
      } catch(e) { console.warn('Aura:', e); }
    };

    var runAutonomousCycle = async () => {
      setAutoStatus('running');
      try {
        await fetch('/cmd/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') }, body: JSON.stringify({ action: 'full_cycle' }) });
        await fetchNotifs();
      } catch(e) { console.warn('Aura:', e); }
      setAutoStatus('active');
    };

    // Initial check
    fetchNotifs();

    // Auto-cycle every 90 seconds
    var cycleInterval = setInterval(runAutonomousCycle, 90000);

    // Check notifications every 30 seconds
    var notifInterval = setInterval(fetchNotifs, 30000);

    return () => { clearInterval(cycleInterval); clearInterval(notifInterval); };
  }, []);

  const fetchAllNotifs = async () => {
    try {
      var res = await fetch('/cmd/autonomous', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sg('jt', '') }, body: JSON.stringify({ action: 'get_notifications', unreadOnly: false }) });
      var data = await res.json();
      if (data.success) setNotifications(data.data || []);
    } catch(e) { console.warn('Aura:', e); }
  };

  const markAllRead = async () => {
    await apiCall('/cmd/autonomous', { action: 'mark_all_read' });
    setUnreadCount(0);
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const toggleNotifs = async () => {
    if (!showNotifs) { await fetchAllNotifs(); }
    setShowNotifs(!showNotifs);
  };

  var tabs = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'dms', label: 'DMs', icon: '📨' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'content', label: 'Content', icon: '✨' },
    { id: 'scheduler', label: 'Scheduler', icon: '⏰' },
    { id: 'abtest', label: 'A/B', icon: '🧪' },
    { id: 'campaigns', label: 'Camps', icon: '🎯' },
    { id: 'reports', label: 'Reports', icon: '📄' },
    { id: 'settings', label: 'Config', icon: '⚙️' },
    { id: 'mcp', label: 'MCP', icon: '🔌' },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <Particles />

      {/* NAV BAR */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HexLogo size={28} />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: 2, color: '#fff', textTransform: 'uppercase' }}>Aura</span>
          {/* Autonomous status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, padding: '2px 8px', borderRadius: 20, background: autoStatus === 'active' ? 'rgba(74,222,128,0.1)' : autoStatus === 'running' ? 'rgba(255,68,68,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid ' + (autoStatus === 'active' ? 'rgba(74,222,128,0.3)' : autoStatus === 'running' ? 'rgba(255,68,68,0.3)' : 'rgba(255,255,255,0.1)') }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: autoStatus === 'active' ? '#4ade80' : autoStatus === 'running' ? '#ff4444' : '#666', animation: autoStatus === 'running' ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ fontSize: 9, color: autoStatus === 'active' ? '#4ade80' : autoStatus === 'running' ? '#ff4444' : '#666', fontWeight: 600, letterSpacing: 0.5 }}>{autoStatus === 'active' ? 'AUTONOMO' : autoStatus === 'running' ? 'ACTIVO...' : 'OFF'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '6px 10px', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #ff4444' : '2px solid transparent', color: tab === t.id ? '#ff4444' : '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif", transition: 'all .2s', whiteSpace: 'nowrap', letterSpacing: 0.3 }}>
              <span style={{ marginRight: 3 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Notification Bell */}
          <button onClick={toggleNotifs} style={{ position: 'relative', background: 'none', border: 'none', color: unreadCount > 0 ? '#ff4444' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}>
            <Bell size={16} />
            {unreadCount > 0 && <div style={{ position: 'absolute', top: -2, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ff4444', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #000' }}>{unreadCount > 9 ? '9+' : unreadCount}</div>}
          </button>
          <span style={{ fontSize: 10, color: '#888', fontFamily: "'SF Mono',Menlo,monospace", fontWeight: 500 }}>{clock}</span>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2 }}><LogOut size={14} /></button>
        </div>
      </div>

      {/* TAB CONTENT */}
      <div style={{ flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {tab === 'chat' && <ChatTab onLogout={onLogout} />}
        {tab === 'dms' && <DmTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'crm' && <CrmTab />}
        {tab === 'content' && <ContentTab />}
        {tab === 'scheduler' && <SchedulerTab />}
        {tab === 'abtest' && <ABTestTab />}
        {tab === 'campaigns' && <CampaignsTab />}
        {tab === 'reports' && <ReportsTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'mcp' && <McpTab />}
      </div>

      {/* NOTIFICATION PANEL */}
      {showNotifs && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '100vw', background: 'rgba(10,10,12,0.98)', borderLeft: '1px solid rgba(255,68,68,0.15)', zIndex: 200, display: 'flex', flexDirection: 'column', animation: 'slideInRight .2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Notificacoes</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 10, color: '#ff4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Limpar tudo</button>}
              <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {notifications.length === 0 && <div style={{ textAlign: 'center', color: '#666', fontSize: 13, padding: 40 }}>Sem notificacoes</div>}
            {notifications.map((n: any, i: number) => (
              <div key={n.id || i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: n.isRead ? 'none' : '3px solid #ff4444', background: n.isRead ? 'transparent' : 'rgba(255,68,68,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{n.platform || 'SISTEMA'}</span>
                  <span style={{ fontSize: 9, color: '#555' }}>{ft(n.createdAt)}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{n.title}</div>
                {n.message && <div style={{ fontSize: 11, color: '#999', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{n.message}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOME INDICATOR */}
      <div style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: 'rgba(255,255,255,0.3)', borderRadius: 100, zIndex: 100 }} />
    </div>
  );
}
