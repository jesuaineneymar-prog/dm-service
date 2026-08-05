'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB 7: SETTINGS =====
export function SettingsTab() {
  const [sysInfo, setSysInfo] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState('');
  const [customSettings, setCustomSettings] = useState({
    agency_name: '',
    auto_reply_enabled: 'true',
    default_platform: 'instagram',
    report_frequency: 'weekly',
    dm_response_tone: 'profissional',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      var [info, sett] = await Promise.all([
        apiCall('/cmd/settings', { action: 'get_system_info' }),
        apiCall('/cmd/settings', { action: 'get_all' }),
      ]);
      if (info.success) setSysInfo(info.data);
      if (sett.success) {
        setSettings(sett.data);
        setCustomSettings(prev => ({
          ...prev,
          agency_name: sett.data.agency_name || 'Mwango Brain',
          auto_reply_enabled: sett.data.auto_reply_enabled || 'true',
          default_platform: sett.data.default_platform || 'instagram',
          report_frequency: sett.data.report_frequency || 'weekly',
          dm_response_tone: sett.data.dm_response_tone || 'profissional',
        }));
      }
    } catch(e) { console.warn('Aura:', e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const saveSettings = async () => {
    var res = await apiCall('/cmd/settings', { action: 'set_many', settings: customSettings });
    if (res.success) { setSaved('OK'); setTimeout(() => setSaved(''), 2000); await fetchData(); }
  };

  if (loading && !sysInfo) return <Spinner />;

  var envItems = sysInfo ? [
    { label: 'Turso DB', ok: sysInfo.hasTursoUrl },
    { label: 'HikerAPI', ok: sysInfo.hasHikerKey },
    { label: 'Upload-Post', ok: sysInfo.hasUploadPostKey },
    { label: 'Zernio DMs', ok: sysInfo.hasZernioKey },
    { label: 'OpenRouter IA', ok: sysInfo.hasOrKey },
    { label: 'Cron Secret', ok: sysInfo.hasCronSecret },
  ] : [];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>⚙️ Configuracoes</div>

        {/* ENV STATUS */}
        {sysInfo && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>Estado das APIs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {envItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                  {item.ok ? <CheckCircle size={14} style={{ color: '#4ade80' }} /> : <AlertTriangle size={14} style={{ color: '#ff8c00' }} />}
                  <span style={{ fontSize: 12, color: '#ccc' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <span style={{ ...S.textS, fontSize: 11 }}>{sysInfo.region} · {sysInfo.nodeEnv}</span>
              {sysInfo.dbStats && <span style={{ ...S.textS, fontSize: 11 }}>{sysInfo.dbStats.prospects} prospects · {sysInfo.dbStats.scheduled} agendados</span>}
            </div>
          </div>
        )}

        {/* CUSTOM SETTINGS */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Preferencias</div>
            {saved && <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Guardado!</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Nome da Agencia</div>
              <input value={customSettings.agency_name} onChange={e => setCustomSettings(s => ({ ...s, agency_name: e.target.value }))} style={S.input} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Plataforma Padrao</div>
              <select value={customSettings.default_platform} onChange={e => setCustomSettings(s => ({ ...s, default_platform: e.target.value }))} style={{ ...S.input, appearance: 'none' }}>
                {['instagram', 'facebook', 'tiktok'].map(p => <option key={p} value={p} style={{ background: '#1a1a1a' }}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Frequencia de Relatorios</div>
              <select value={customSettings.report_frequency} onChange={e => setCustomSettings(s => ({ ...s, report_frequency: e.target.value }))} style={{ ...S.input, appearance: 'none' }}>
                {['daily', 'weekly', 'biweekly', 'monthly'].map(f => <option key={f} value={f} style={{ background: '#1a1a1a' }}>{f === 'daily' ? 'Diario' : f === 'weekly' ? 'Semanal' : f === 'biweekly' ? 'Quinzenal' : 'Mensal'}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4, fontWeight: 500 }}>Tom de Resposta DMs</div>
              <select value={customSettings.dm_response_tone} onChange={e => setCustomSettings(s => ({ ...s, dm_response_tone: e.target.value }))} style={{ ...S.input, appearance: 'none' }}>
                {['profissional', 'casual', 'criativo', 'formal'].map(t => <option key={t} value={t} style={{ background: '#1a1a1a' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" checked={customSettings.auto_reply_enabled === 'true'} onChange={e => setCustomSettings(s => ({ ...s, auto_reply_enabled: e.target.checked ? 'true' : 'false' }))} style={{ accentColor: '#ff4444', width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: '#fff' }}>Auto-resposta DMs activa</span>
            </div>
            <button onClick={saveSettings} style={{ ...S.btn, width: '100%' }}>Guardar Configuracoes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
