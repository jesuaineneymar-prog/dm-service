'use client';
import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Spinner, apiCall, S } from './ui';

// ===== TAB 10: MCP HUB =====
export function McpTab() {
  const [servers, setServers] = useState<any[]>([]);
  const [status, setStatus] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [scrapeInput, setScrapeInput] = useState('');
  const [scrapePlatform, setScrapePlatform] = useState('tiktok');
  const [scrapeResult, setScrapeResult] = useState<any>(null);
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [trendPlatform, setTrendPlatform] = useState('tiktok');
  const [trendResult, setTrendResult] = useState<any>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [brandInput, setBrandInput] = useState('');
  const [brandResult, setBrandResult] = useState<any>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [metaAccounts, setMetaAccounts] = useState<any>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [syncAccounts, setSyncAccounts] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [toolResult, setToolResult] = useState<any>(null);
  const [toolLoading, setToolLoading] = useState(false);


  const fetchServers = async () => {
    setLoading(true);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'list_servers' });
      if (res.success) setServers(res.data);
    } catch(e) { console.warn('MCP:', e); }
    setLoading(false);
  };

  const checkStatus = async () => {
    try {
      var res = await apiCall('/cmd/mcp', { action: 'check_all' });
      if (res.success) setStatus(res.data);
    } catch(e) { console.warn('MCP status:', e); }
  };

  useEffect(() => { fetchServers(); checkStatus(); }, []);

  const handleScrape = async () => {
    if (!scrapeInput) return;
    setScrapeLoading(true); setScrapeResult(null);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'scrape_profile', platform: scrapePlatform, username: scrapeInput });
      setScrapeResult(res);
    } catch(e: any) { setScrapeResult({ success: false, error: e.message }); }
    setScrapeLoading(false);
  };

  const handleTrending = async () => {
    setTrendLoading(true); setTrendResult(null);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'get_trending', platform: trendPlatform });
      setTrendResult(res);
    } catch(e: any) { setTrendResult({ success: false, error: e.message }); }
    setTrendLoading(false);
  };

  const handleBrandMonitor = async () => {
    if (!brandInput) return;
    setBrandLoading(true); setBrandResult(null);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'monitor_brand', brand: brandInput });
      setBrandResult(res);
    } catch(e: any) { setBrandResult({ success: false, error: e.message }); }
    setBrandLoading(false);
  };

  const handleMetaAccounts = async () => {
    setMetaLoading(true); setMetaAccounts(null);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'meta_ad_accounts' });
      setMetaAccounts(res);
    } catch(e: any) { setMetaAccounts({ success: false, error: e.message }); }
    setMetaLoading(false);
  };

  const handleSyncAccounts = async () => {
    setSyncLoading(true); setSyncAccounts(null);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'socialync_accounts' });
      setSyncAccounts(res);
    } catch(e: any) { setSyncAccounts({ success: false, error: e.message }); }
    setSyncLoading(false);
  };



  const handleCallTool = async (serverId: string, toolName: string) => {
    setToolLoading(true); setToolResult(null);
    try {
      var res = await apiCall('/cmd/mcp', { action: 'call_tool', serverId, tool: toolName });
      setToolResult(res);
    } catch(e: any) { setToolResult({ success: false, error: e.message }); }
    setToolLoading(false);
  };

  var catColor = (cat: string) => {
    if (cat.includes('Scraping')) return '#38bdf8';
    if (cat.includes('Ads')) return '#f59e0b';
    if (cat.includes('Publish')) return '#4ade80';
    return '#a78bfa';
  };

  var catIcon = (cat: string) => {
    if (cat.includes('Scraping')) return '🔍';
    if (cat.includes('Ads')) return '📢';
    if (cat.includes('Publish')) return '🚀';
    return '🔌';
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>🔌 MCP Hub</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { fetchServers(); checkStatus(); }} style={{ ...S.btnOutline, height: 32, fontSize: 11 }}>Refresh</button>
            <button onClick={checkStatus} style={{ ...S.btn, height: 32, fontSize: 11 }}>Testar Ligações</button>
          </div>
        </div>

        {/* SERVER CARDS */}
        {loading && <Spinner />}
        {!loading && servers.map((srv: any) => {
          var st = status[srv.id];
          var isActive = srv.status === 'active';
          var isConnected = st?.connected;
          return (
            <div key={srv.id} style={{ ...S.card, borderLeft: '3px solid ' + catColor(srv.category), cursor: 'pointer' }} onClick={() => setSelected(selected === srv.id ? null : srv.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span>{catIcon(srv.category)}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{srv.name}</span>
                    <span style={{ ...S.badge(catColor(srv.category)), fontSize: 9 }}>{srv.category}</span>
                    {isConnected ? <span style={{ ...S.badge('#4ade80'), fontSize: 9 }}>{st.latency}ms</span> : isActive ? <span style={{ ...S.badge('#f59e0b'), fontSize: 9 }}>Chave OK</span> : <span style={{ ...S.badge('#666'), fontSize: 9 }}>Sem chave</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5, marginBottom: 8 }}>{srv.description}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#666' }}>
                    <span>{srv.toolCount} ferramentas</span>
                    <span>·</span>
                    <span>{srv.pricing}</span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: '#555', transition: 'transform .2s', transform: selected === srv.id ? 'rotate(90deg)' : 'none' }} />
              </div>

              {/* EXPANDED: TOOLS LIST */}
              {selected === srv.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>Ferramentas disponiveis:</div>
                  {srv.tools.map((tool: any, ti: number) => (
                    <div key={ti} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.02)', marginBottom: 4 }}>
                      <div>
                        <span style={{ fontFamily: "'SF Mono',Menlo,monospace", fontSize: 10, fontWeight: 600, color: '#ddd' }}>{tool.name}</span>
                        <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{tool.description}</div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleCallTool(srv.id, tool.name); }} style={{ height: 26, padding: '0 10px', background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.2)', borderRadius: 6, color: '#ff4444', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: "-apple-system,sans-serif", whiteSpace: 'nowrap' }}>Testar</button>
                    </div>
                  ))}
                  {!isActive && (
                    <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,140,0,0.05)', border: '1px solid rgba(255,140,0,0.15)' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#ff8c00', marginBottom: 4 }}>Como activar:</div>
                      <div style={{ fontSize: 10, color: '#999', lineHeight: 1.5 }}>1. Crie conta em <a href={srv.setupUrl} target="_blank" rel="noreferrer" style={{ color: '#ff4444' }}>{srv.setupUrl}</a></div>
                      <div style={{ fontSize: 10, color: '#999', lineHeight: 1.5 }}>2. Obtenha a API Key no dashboard</div>
                      <div style={{ fontSize: 10, color: '#999', lineHeight: 1.5 }}>3. Adicione como env var: <span style={{ fontFamily: "'SF Mono',Menlo,monospace", color: '#ff8c00', fontSize: 9 }}>{(srv.id.toUpperCase().replace(/-/g, '_')) + '_KEY'}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* QUICK ACTIONS */}
        <div style={S.card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>⚡ Accoes Rapidas</div>

          {/* Scrape Profile */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>Scraping de Perfil (SocialCrawl)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={scrapePlatform} onChange={e => setScrapePlatform(e.target.value)} style={{ ...S.input, width: 100, height: 36 }}>
                {['tiktok', 'instagram', 'facebook', 'youtube'].map(p => <option key={p} value={p} style={{ background: '#1a1a1a' }}>{p}</option>)}
              </select>
              <input value={scrapeInput} onChange={e => setScrapeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleScrape(); }} placeholder="Username..." style={{ ...S.input, flex: 1, height: 36 }} />
              <button onClick={handleScrape} disabled={scrapeLoading} style={{ ...S.btn, height: 36, opacity: scrapeLoading ? 0.5 : 1 }}>{scrapeLoading ? '...' : 'Scrape'}</button>
            </div>
            {scrapeResult && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: scrapeResult.success ? 'rgba(74,222,128,0.05)' : 'rgba(255,68,68,0.05)', border: '1px solid ' + (scrapeResult.success ? 'rgba(74,222,128,0.15)' : 'rgba(255,68,68,0.15)'), maxHeight: 200, overflowY: 'auto' }}>
                <pre style={{ fontSize: 10, color: scrapeResult.success ? '#4ade80' : '#ff4444', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono',Menlo,monospace", margin: 0 }}>{JSON.stringify(scrapeResult.data || scrapeResult.error, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Trending Content */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>Trending Content</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={trendPlatform} onChange={e => setTrendPlatform(e.target.value)} style={{ ...S.input, width: 100, height: 36 }}>
                {['tiktok', 'instagram', 'youtube', 'twitter'].map(p => <option key={p} value={p} style={{ background: '#1a1a1a' }}>{p}</option>)}
              </select>
              <button onClick={handleTrending} disabled={trendLoading} style={{ ...S.btn, height: 36, opacity: trendLoading ? 0.5 : 1 }}>{trendLoading ? '...' : 'Descobrir Trends'}</button>
            </div>
            {trendResult && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: trendResult.success ? 'rgba(74,222,128,0.05)' : 'rgba(255,68,68,0.05)', border: '1px solid ' + (trendResult.success ? 'rgba(74,222,128,0.15)' : 'rgba(255,68,68,0.15)'), maxHeight: 200, overflowY: 'auto' }}>
                <pre style={{ fontSize: 10, color: trendResult.success ? '#4ade80' : '#ff4444', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono',Menlo,monospace", margin: 0 }}>{JSON.stringify(trendResult.data || trendResult.error, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Brand Monitoring */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>Monitorizar Marca</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={brandInput} onChange={e => setBrandInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleBrandMonitor(); }} placeholder="Nome da marca..." style={{ ...S.input, flex: 1, height: 36 }} />
              <button onClick={handleBrandMonitor} disabled={brandLoading} style={{ ...S.btn, height: 36, opacity: brandLoading ? 0.5 : 1 }}>{brandLoading ? '...' : 'Monitorar'}</button>
            </div>
            {brandResult && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: brandResult.success ? 'rgba(74,222,128,0.05)' : 'rgba(255,68,68,0.05)', border: '1px solid ' + (brandResult.success ? 'rgba(74,222,128,0.15)' : 'rgba(255,68,68,0.15)'), maxHeight: 200, overflowY: 'auto' }}>
                <pre style={{ fontSize: 10, color: brandResult.success ? '#4ade80' : '#ff4444', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono',Menlo,monospace", margin: 0 }}>{JSON.stringify(brandResult.data || brandResult.error, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Meta Ads Accounts */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>Meta Ads — Contas de Anuncios</div>
            <button onClick={handleMetaAccounts} disabled={metaLoading} style={{ ...S.btn, height: 36, opacity: metaLoading ? 0.5 : 1 }}>{metaLoading ? '...' : 'Carregar Contas Meta Ads'}</button>
            {metaAccounts && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: metaAccounts.success ? 'rgba(74,222,128,0.05)' : 'rgba(255,68,68,0.05)', border: '1px solid ' + (metaAccounts.success ? 'rgba(74,222,128,0.15)' : 'rgba(255,68,68,0.15)'), maxHeight: 200, overflowY: 'auto' }}>
                <pre style={{ fontSize: 10, color: metaAccounts.success ? '#4ade80' : '#ff4444', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono',Menlo,monospace", margin: 0 }}>{JSON.stringify(metaAccounts.data || metaAccounts.error, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Socialync Accounts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8 }}>Socialync — Contas Conectadas</div>
            <button onClick={handleSyncAccounts} disabled={syncLoading} style={{ ...S.btn, height: 36, opacity: syncLoading ? 0.5 : 1 }}>{syncLoading ? '...' : 'Ver Contas Socialync'}</button>
            {syncAccounts && (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: syncAccounts.success ? 'rgba(74,222,128,0.05)' : 'rgba(255,68,68,0.05)', border: '1px solid ' + (syncAccounts.success ? 'rgba(74,222,128,0.15)' : 'rgba(255,68,68,0.15)'), maxHeight: 200, overflowY: 'auto' }}>
                <pre style={{ fontSize: 10, color: syncAccounts.success ? '#4ade80' : '#ff4444', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono',Menlo,monospace", margin: 0 }}>{JSON.stringify(syncAccounts.data || syncAccounts.error, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>



        {/* TOOL RESULT (from individual tool test) */}
        {toolResult && (
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8 }}>Resultado da Ferramenta</div>
            <div style={{ padding: 10, borderRadius: 8, background: toolResult.success ? 'rgba(74,222,128,0.05)' : 'rgba(255,68,68,0.05)', border: '1px solid ' + (toolResult.success ? 'rgba(74,222,128,0.15)' : 'rgba(255,68,68,0.15)'), maxHeight: 300, overflowY: 'auto' }}>
              <pre style={{ fontSize: 10, color: toolResult.success ? '#4ade80' : '#ff4444', whiteSpace: 'pre-wrap', fontFamily: "'SF Mono',Menlo,monospace", margin: 0 }}>{JSON.stringify(toolResult.data || toolResult.error, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* INFO BOX */}
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,68,68,0.03)', border: '1px solid rgba(255,68,68,0.1)' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#ff8c00', marginBottom: 6 }}>Sobre MCP Servers</div>
          <div style={{ fontSize: 10, color: '#888', lineHeight: 1.6 }}>
            MCP (Model Context Protocol) permite a Aura aceder a ferramentas externas — scraping, ads, publishing — como se fossem extensoes nativas. Cada servidor adiciona novas capacidades sem modificar o codigo existente. Adicione as API keys como variaveis de ambiente no Vercel.
          </div>
        </div>
      </div>
    </div>
  );
}
