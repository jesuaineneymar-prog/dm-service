// ============================================================
//  JARVIS MCP ENGINE — Model Context Protocol Bridge
//  Conecta JARVIS a servidores MCP externos para expandir
//  capacidades: scraping, ads, publishing, analytics
//
//  MCP Servers integrados:
//    1. SocialCrawl — scraping de 46 plataformas (TikTok, IG, FB...)
//    2. TikTok Ads — gestao de campanhas publicitarias TikTok
//    3. Meta Ads — gestao de campanhas Facebook/Instagram Ads
//    4. Socialync — publicacao multi-plataforma (TikTok, IG, YT, FB, X, LinkedIn)
//    5. Composio — OAuth e integracao com 1000+ apps (do video Top 7 MCPs)
//    6. Playwright MCP — automacao de browser (do video Top 7 MCPs)
//    7. Sociavault — 107 ferramentas para 11 plataformas (TikTok, IG, YT, FB, X...)
//
//  Arquitetura: chamadas HTTP diretas aos MCP servers (remote)
//  — Nao precisa de processo local — funciona em Vercel serverless
//  — Sociavault usa REST API direta (nao JSON-RPC MCP)
// ============================================================

import {
  SOCIALCRAWL_KEY,
  TIKTOK_ADS_MCP_KEY,
  META_ADS_MCP_KEY,
  SOCIALYNC_KEY,
  COMPOSIO_KEY,
  SOCIAVAULT_KEY,
} from './config';

// === MCP SERVER REGISTRY ===
// Cada servidor MCP tem: nome, URL base, chave, ferramentas disponiveis

export interface MCPTool {
  name: string;
  description: string;
  category: string;  // 'scraping', 'ads', 'publishing', 'analytics'
  server: string;    // nome do MCP server
}

export interface MCPServer {
  id: string;
  name: string;
  description: string;
  url: string;
  authType: 'bearer' | 'apikey' | 'none';
  authHeader: string;
  status: 'active' | 'inactive' | 'error';
  tools: MCPTool[];
  category: string;
  pricing: string;
  setupUrl: string;
}

// === SERVER DEFINITIONS ===

export var MCP_SERVERS: MCPServer[] = [
  {
    id: 'socialcrawl',
    name: 'SocialCrawl',
    description: 'Scraping de 46 plataformas sociais — TikTok, Instagram, Facebook, YouTube, X, LinkedIn, Threads e mais. Perfil, posts, comentarios, analytics. Uma API, 368 endpoints.',
    url: 'https://api.socialcrawl.dev',
    authType: 'bearer',
    authHeader: 'Authorization',
    status: SOCIALCRAWL_KEY ? 'active' : 'inactive',
    category: 'Scraping & Inteligencia',
    pricing: '100 creditos gratis, depois pay-per-request',
    setupUrl: 'https://www.socialcrawl.dev',
    tools: [
      { name: 'scrape_profile', description: 'Extrair perfil completo de um utilizador (bio, followers, following, posts)', category: 'scraping', server: 'socialcrawl' },
      { name: 'scrape_posts', description: 'Listar posts recentes de um perfil com metricas de engajamento', category: 'scraping', server: 'socialcrawl' },
      { name: 'scrape_comments', description: 'Extrair comentarios de um post especifico (TikTok, IG, FB, YouTube)', category: 'scraping', server: 'socialcrawl' },
      { name: 'search_profiles', description: 'Pesquisar perfis por keyword em multiplas plataformas', category: 'scraping', server: 'socialcrawl' },
      { name: 'get_trending', description: 'Descobrir trending topics e conteudo viral por plataforma', category: 'analytics', server: 'socialcrawl' },
      { name: 'monitor_brand', description: 'Monitorizar mencoes da marca em todas as plataformas', category: 'analytics', server: 'socialcrawl' },
    ],
  },
  {
    id: 'tiktok_ads',
    name: 'TikTok Ads MCP',
    description: 'Gestao de campanhas publicitarias TikTok via MCP oficial. Criar, gerir e analisar anuncios. Agentic Hub do TikTok para Business.',
    url: 'https://ads.tiktok.com/mcp',
    authType: 'bearer',
    authHeader: 'Authorization',
    status: TIKTOK_ADS_MCP_KEY ? 'active' : 'inactive',
    category: 'Ads & Campanhas',
    pricing: 'Pago via conta TikTok Ads',
    setupUrl: 'https://ads.tiktok.com/help/article/about-tiktok-for-business-agentic-hub-and-mcp-server',
    tools: [
      { name: 'get_campaigns', description: 'Listar todas as campanhas de anuncios', category: 'ads', server: 'tiktok_ads' },
      { name: 'get_campaign_details', description: 'Detalhes completos de uma campanha (budget, targeting, creative)', category: 'ads', server: 'tiktok_ads' },
      { name: 'get_insights', description: 'Metricas de performance (impressions, clicks, spend, CTR, CPA)', category: 'analytics', server: 'tiktok_ads' },
      { name: 'create_campaign', description: 'Criar nova campanha publicitaria', category: 'ads', server: 'tiktok_ads' },
      { name: 'update_campaign', description: 'Atualizar campanha (budget, status, targeting)', category: 'ads', server: 'tiktok_ads' },
      { name: 'get_ad_creatives', description: 'Listar creatives (videos, imagens) de uma campanha', category: 'ads', server: 'tiktok_ads' },
    ],
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads MCP',
    description: 'Gestao de campanhas Facebook e Instagram Ads via MCP oficial da Meta. 54 ferramentas — 35 leitura + 19 escrita. Graph API v22.0.',
    url: 'https://mcp.facebook.com/ads',
    authType: 'bearer',
    authHeader: 'Authorization',
    status: META_ADS_MCP_KEY ? 'active' : 'inactive',
    category: 'Ads & Campanhas',
    pricing: 'Pago via conta Meta Business',
    setupUrl: 'https://developers.facebook.com/documentation/ads-commerce/ads-ai-connectors/ads-mcp-server/ads-mcp-server-overview',
    tools: [
      { name: 'get_ad_accounts', description: 'Listar contas de anuncios Facebook/Instagram', category: 'ads', server: 'meta_ads' },
      { name: 'get_campaigns', description: 'Listar campanhas de uma conta de anuncios', category: 'ads', server: 'meta_ads' },
      { name: 'get_campaign_insights', description: 'Insights de performance de campanha (spend, CPM, CTR, ROAS)', category: 'analytics', server: 'meta_ads' },
      { name: 'get_ad_sets', description: 'Listar ad sets (targeting, budget, placement)', category: 'ads', server: 'meta_ads' },
      { name: 'get_ads', description: 'Listar anuncios individuais com creative e performance', category: 'ads', server: 'meta_ads' },
      { name: 'get_page_insights', description: 'Metricas da pagina Facebook (followers, reach, engagement)', category: 'analytics', server: 'meta_ads' },
      { name: 'create_campaign', description: 'Criar nova campanha Facebook/Instagram Ads', category: 'ads', server: 'meta_ads' },
      { name: 'update_ad_status', description: 'Pausar/ativar anuncios', category: 'ads', server: 'meta_ads' },
    ],
  },
  {
    id: 'composio',
    name: 'Composio',
    description: '1000+ apps via OAuth. Login uma vez, acesso a Instagram, TikTok, Facebook, LinkedIn, X, YouTube, Google Analytics, Google Ads, Gmail, Google Sheets, Canva, Slack e muito mais. SDK com session management, tool discovery, e execucao direta. API key: COMPOSIO_API_KEY.',
    url: 'https://backend.composio.dev/api/v3.1/tool_router',
    authType: 'apikey',
    authHeader: 'x-api-key',
    status: COMPOSIO_KEY ? 'active' : 'inactive',
    category: 'Integracao & OAuth',
    pricing: 'Free tier disponivel (1000+ apps)',
    setupUrl: 'https://dashboard.composio.dev/settings',
    tools: [
      { name: 'create_session', description: 'Criar sessao com toolkits de redes sociais (Instagram, TikTok, Facebook, LinkedIn, X, YouTube, Google Analytics, etc.)', category: 'session', server: 'composio' },
      { name: 'search_tools', description: 'Pesquisar ferramentas por caso de uso (ex: "postar foto no Instagram", "analisar metricas TikTok")', category: 'discovery', server: 'composio' },
      { name: 'execute_tool', description: 'Executar qualquer ferramenta de qualquer app conectada (post, analytics, DM, etc.)', category: 'action', server: 'composio' },
      { name: 'get_connect_link', description: 'Gerar link OAuth para conectar uma app (Instagram, Gmail, Google Sheets, etc.)', category: 'auth', server: 'composio' },
      { name: 'list_toolkits', description: 'Listar todos os toolkits disponiveis na sessao com status de conexao', category: 'session', server: 'composio' },
      { name: 'list_connected_accounts', description: 'Ver todas as contas OAuth conectadas e seus status', category: 'auth', server: 'composio' },
      { name: 'instagram_post', description: 'Publicar conteudo no Instagram (feed, stories, reels)', category: 'social', server: 'composio' },
      { name: 'tiktok_post', description: 'Publicar video no TikTok via tool discovery', category: 'social', server: 'composio' },
      { name: 'facebook_post', description: 'Publicar no Facebook (page, group, stories)', category: 'social', server: 'composio' },
      { name: 'linkedin_post', description: 'Publicar no LinkedIn (perfil, pagina)', category: 'social', server: 'composio' },
      { name: 'twitter_post', description: 'Publicar tweet no X/Twitter', category: 'social', server: 'composio' },
      { name: 'youtube_upload', description: 'Fazer upload de video no YouTube', category: 'social', server: 'composio' },
      { name: 'google_analytics', description: 'Obter metricas do Google Analytics (trafego, conversoes, usuarios)', category: 'analytics', server: 'composio' },
      { name: 'google_ads_insights', description: 'Obter insights de campanhas Google Ads', category: 'ads', server: 'composio' },
      { name: 'gmail_send', description: 'Enviar email via Gmail', category: 'communication', server: 'composio' },
      { name: 'sheets_update', description: 'Atualizar Google Sheets (relatorios, dados de clientes)', category: 'productivity', server: 'composio' },
      { name: 'canva_design', description: 'Criar designs no Canva (posts, stories, thumbnails)', category: 'design', server: 'composio' },
    ],
  },
  {
    id: 'playwright',
    name: 'Playwright MCP',
    description: 'Automacao de browser — pesquisar web, preencher formularios, extrair dados de paginas, screenshots. Usa o browser existente (Browserless) do JARVIS.',
    url: 'https://api.browserless.io',
    authType: 'bearer',
    authHeader: 'Authorization',
    status: 'inactive', // Usa BROWSERLESS_KEY — nao precisa de chave separada
    category: 'Browser & Automacao',
    pricing: 'Ja integrado via Browserless',
    setupUrl: 'https://playwright.dev/docs/getting-started-mcp',
    tools: [
      { name: 'navigate', description: 'Navegar para uma URL e extrair conteudo da pagina', category: 'browser', server: 'playwright' },
      { name: 'screenshot', description: 'Capturar screenshot de uma pagina web', category: 'browser', server: 'playwright' },
      { name: 'extract_data', description: 'Extrair dados estruturados de uma pagina web', category: 'scraping', server: 'playwright' },
      { name: 'fill_form', description: 'Preencher e submeter formularios web automaticamente', category: 'browser', server: 'playwright' },
      { name: 'search_web', description: 'Pesquisar na web e retornar resultados estruturados', category: 'browser', server: 'playwright' },
    ],
  },
  {
    id: 'socialync',
    name: 'Socialync',
    description: 'Publicacao multi-plataforma via MCP. Upload uma vez, publica em TikTok, Instagram, YouTube, Facebook, X, LinkedIn, Threads, Bluesky. OAuth autorizado.',
    url: 'https://api.socialync.io/mcp',
    authType: 'bearer',
    authHeader: 'Authorization',
    status: SOCIALYNC_KEY ? 'active' : 'inactive',
    category: 'Publicacao & Scheduling',
    pricing: 'Free plan disponivel (3 profiles)',
    setupUrl: 'https://www.socialync.io/features/mcp',
    tools: [
      { name: 'create_post', description: 'Criar novo post para multiplas plataformas simultaneamente', category: 'publishing', server: 'socialync' },
      { name: 'schedule_post', description: 'Agendar post para data/hora especifica', category: 'publishing', server: 'socialync' },
      { name: 'get_scheduled_posts', description: 'Listar posts agendados com status', category: 'publishing', server: 'socialync' },
      { name: 'get_post_analytics', description: 'Analytics de engajamento por post publicado', category: 'analytics', server: 'socialync' },
      { name: 'list_connected_accounts', description: 'Listar todas as contas de redes sociais conectadas', category: 'publishing', server: 'socialync' },
    ],
  },
  {
    id: 'sociavault',
    name: 'SociaVault',
    description: '107 ferramentas para 11 plataformas — TikTok (23 tools: perfil, videos, comentarios, trending, search, music, shop, ad library), Instagram (9), YouTube (12), X/Twitter (12), Facebook (10 + ad library), Reddit (6), Threads (5), Pinterest (4), Twitch (5), Google (4 + ad library). REST API direta, funciona em Vercel serverless.',
    url: 'https://api.sociavault.com',
    authType: 'apikey',
    authHeader: 'api_key',
    status: SOCIAVAULT_KEY ? 'active' : 'inactive',
    category: 'Dados Sociais & Inteligencia',
    pricing: 'Free credits no signup, depois credit packs ($29-$399)',
    setupUrl: 'https://sociavault.com/signup',
    tools: [
      { name: 'tiktok_profile', description: 'Perfil completo TikTok (bio, followers, following, videos)', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_demographics', description: 'Demografia do perfil TikTok (idade, genero, localizacao)', category: 'analytics', server: 'sociavault' },
      { name: 'tiktok_videos', description: 'Videos recentes de um perfil com metricas', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_video_info', description: 'Detalhes completos de um video (views, likes, shares, comentarios)', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_transcript', description: 'Transcricao do audio de um video TikTok', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_comments', description: 'Comentarios de um video TikTok (com paginacao)', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_trending', description: 'Trending videos e conteudo viral no TikTok', category: 'analytics', server: 'sociavault' },
      { name: 'tiktok_search_users', description: 'Pesquisar utilizadores TikTok por keyword', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_search_keyword', description: 'Pesquisar videos por keyword no TikTok', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_search_hashtag', description: 'Pesquisar hashtag no TikTok', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_search_music', description: 'Pesquisar musicas populares no TikTok', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_followers', description: 'Lista de seguidores de um perfil TikTok', category: 'scraping', server: 'sociavault' },
      { name: 'tiktok_music_popular', description: 'Musicas populares no TikTok (trending audio)', category: 'analytics', server: 'sociavault' },
      { name: 'tiktok_creators_popular', description: 'Criadores populares no TikTok', category: 'analytics', server: 'sociavault' },
      { name: 'tiktok_hashtags_popular', description: 'Hashtags populares no TikTok', category: 'analytics', server: 'sociavault' },
      { name: 'tiktok_ad_library_search', description: 'Pesquisar ads activos no TikTok Ad Library', category: 'ads', server: 'sociavault' },
      { name: 'tiktok_shop_search', description: 'Pesquisar produtos no TikTok Shop', category: 'commerce', server: 'sociavault' },
      { name: 'instagram_profile', description: 'Perfil completo do Instagram', category: 'scraping', server: 'sociavault' },
      { name: 'instagram_posts', description: 'Posts recentes do Instagram com metricas', category: 'scraping', server: 'sociavault' },
      { name: 'instagram_reels', description: 'Reels do Instagram com metricas de performance', category: 'scraping', server: 'sociavault' },
      { name: 'instagram_comments', description: 'Comentarios de um post do Instagram', category: 'scraping', server: 'sociavault' },
      { name: 'youtube_channel', description: 'Canal do YouTube com stats', category: 'scraping', server: 'sociavault' },
      { name: 'youtube_video', description: 'Detalhes de video do YouTube', category: 'scraping', server: 'sociavault' },
      { name: 'youtube_search', description: 'Pesquisar videos no YouTube', category: 'scraping', server: 'sociavault' },
      { name: 'youtube_video_transcript', description: 'Transcricao de video do YouTube', category: 'scraping', server: 'sociavault' },
      { name: 'twitter_profile', description: 'Perfil do X/Twitter', category: 'scraping', server: 'sociavault' },
      { name: 'twitter_search', description: 'Pesquisar tweets por keyword', category: 'scraping', server: 'sociavault' },
      { name: 'twitter_comments', description: 'Comentarios/respostas de um tweet', category: 'scraping', server: 'sociavault' },
      { name: 'facebook_profile', description: 'Perfil do Facebook', category: 'scraping', server: 'sociavault' },
      { name: 'facebook_ad_library_search', description: 'Pesquisar ads activos no Meta Ad Library', category: 'ads', server: 'sociavault' },
      { name: 'reddit_search', description: 'Pesquisar posts no Reddit', category: 'scraping', server: 'sociavault' },
      { name: 'threads_profile', description: 'Perfil do Threads', category: 'scraping', server: 'sociavault' },
      { name: 'check_credits', description: 'Verificar creditos restantes da conta', category: 'account', server: 'sociavault' },
    ],
  },
];

// === AUTH HELPERS ===

function getServerKey(serverId: string): string {
  switch (serverId) {
    case 'socialcrawl': return SOCIALCRAWL_KEY;
    case 'tiktok_ads': return TIKTOK_ADS_MCP_KEY;
    case 'meta_ads': return META_ADS_MCP_KEY;
    case 'socialync': return SOCIALYNC_KEY;
    case 'composio': return COMPOSIO_KEY;
    case 'sociavault': return SOCIAVAULT_KEY;
    case 'playwright': return process.env.BROWSERLESS_KEY || '';
    default: return '';
  }
}

function getServerConfig(serverId: string): MCPServer | null {
  return MCP_SERVERS.find(function(s) { return s.id === serverId; }) || null;
}

// === CORE MCP CALL FUNCTION ===
// Chamada HTTP direta ao MCP server (remote)
// Formato: POST {serverUrl}/tools com JSON-RPC style

export async function callMCPTool(serverId: string, toolName: string, params: Record<string, any> = {}): Promise<{ success: boolean; data?: any; error?: string }> {
  var server = getServerConfig(serverId);
  if (!server) return { success: false, error: 'MCP server nao encontrado: ' + serverId };

  var apiKey = getServerKey(serverId);
  if (!apiKey && server.authType !== 'none') {
    return { success: false, error: server.name + ': chave API nao configurada. Va em Settings > MCP Servers.' };
  }

  try {
    // MCP protocol: tools/call endpoint
    var url = server.url + '/tools/call';
    var headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (apiKey && server.authType === 'bearer') {
      headers['Authorization'] = 'Bearer ' + apiKey;
    } else if (apiKey && server.authType === 'apikey') {
      headers[server.authHeader] = apiKey;
    }

    // MCP JSON-RPC format
    var body = {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: Date.now().toString(36),
      params: {
        name: toolName,
        arguments: params,
      },
    };

    var res = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      var errText = await res.text().catch(function() { return ''; });
      return { success: false, error: server.name + ' HTTP ' + res.status + ': ' + errText.slice(0, 300) };
    }

    var data = await res.json();

    // MCP response format: { result: { content: [{ type: 'text', text: '...' }] } }
    if (data?.result?.content) {
      var textContent = '';
      for (var i = 0; i < data.result.content.length; i++) {
        if (data.result.content[i].type === 'text') {
          textContent += data.result.content[i].text;
        }
      }
      try {
        return { success: true, data: JSON.parse(textContent) };
      } catch (e) {
        return { success: true, data: textContent };
      }
    }

    // Fallback: direct response
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: server.name + ': ' + e.message };
  }
}

// === LIST TOOLS (MCP protocol: tools/list) ===

export async function listMCPTools(serverId: string): Promise<{ success: boolean; data?: MCPTool[]; error?: string }> {
  var server = getServerConfig(serverId);
  if (!server) return { success: false, error: 'MCP server nao encontrado' };

  var apiKey = getServerKey(serverId);
  if (!apiKey && server.authType !== 'none') {
    // Return registered tools (no API call needed)
    return { success: true, data: server.tools };
  }

  try {
    var headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (apiKey && server.authType === 'bearer') {
      headers['Authorization'] = 'Bearer ' + apiKey;
    }

    var res = await fetch(server.url + '/tools/list', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: '1', params: {} }),
    });

    if (!res.ok) {
      // Return pre-registered tools as fallback
      return { success: true, data: server.tools };
    }

    var data = await res.json();
    if (data?.result?.tools) {
      return { success: true, data: data.result.tools };
    }
    return { success: true, data: server.tools };
  } catch (e: any) {
    return { success: true, data: server.tools };
  }
}

// === MCP HEALTH CHECK ===

export async function checkMCPStatus(serverId: string): Promise<{ connected: boolean; latency?: number; error?: string }> {
  var server = getServerConfig(serverId);
  if (!server) return { connected: false, error: 'Server nao encontrado' };

  var apiKey = getServerKey(serverId);
  if (!apiKey && server.authType !== 'none') {
    return { connected: false, error: 'Chave nao configurada' };
  }

  var start = Date.now();
  try {
    var headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (apiKey && server.authType === 'bearer') {
      headers['Authorization'] = 'Bearer ' + apiKey;
    }

    var res = await fetch(server.url + '/tools/list', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: '1', params: {} }),
    });

    var latency = Date.now() - start;
    return { connected: res.ok, latency: latency };
  } catch (e: any) {
    return { connected: false, error: e.message };
  }
}

// === GET ALL SERVER STATUS ===

export async function getAllMCPStatus(): Promise<Record<string, { connected: boolean; latency?: number; error?: string; name: string }>> {
  var results: Record<string, any> = {};
  for (var i = 0; i < MCP_SERVERS.length; i++) {
    var s = MCP_SERVERS[i];
    results[s.id] = { name: s.name, ...await checkMCPStatus(s.id) };
  }
  return results;
}

// === CONVENIENCE WRAPPERS ===
// Funcoes de alto nivel para uso direto no JARVIS

// --- SocialCrawl Wrappers ---

export async function scrapeTikTokProfile(username: string) {
  return callMCPTool('socialcrawl', 'scrape_profile', { platform: 'tiktok', username: username });
}

export async function scrapeInstagramProfile(username: string) {
  return callMCPTool('socialcrawl', 'scrape_profile', { platform: 'instagram', username: username });
}

export async function scrapeFacebookProfile(username: string) {
  return callMCPTool('socialcrawl', 'scrape_profile', { platform: 'facebook', username: username });
}

export async function scrapeTikTokComments(videoUrl: string, limit?: number) {
  return callMCPTool('socialcrawl', 'scrape_comments', { platform: 'tiktok', url: videoUrl, limit: limit || 50 });
}

export async function scrapeInstagramComments(postUrl: string, limit?: number) {
  return callMCPTool('socialcrawl', 'scrape_comments', { platform: 'instagram', url: postUrl, limit: limit || 50 });
}

export async function searchSocialProfiles(query: string) {
  return callMCPTool('socialcrawl', 'search_profiles', { query: query, platforms: ['tiktok', 'instagram', 'facebook', 'youtube'] });
}

export async function getTrendingContent(platform?: string) {
  return callMCPTool('socialcrawl', 'get_trending', { platform: platform || 'tiktok', region: 'AO' });
}

export async function monitorBrandMentions(brand: string) {
  return callMCPTool('socialcrawl', 'monitor_brand', { brand: brand, platforms: ['tiktok', 'instagram', 'facebook'] });
}

// --- Meta Ads Wrappers ---

export async function getMetaAdAccounts() {
  return callMCPTool('meta_ads', 'get_ad_accounts', {});
}

export async function getMetaCampaigns(adAccountId?: string) {
  return callMCPTool('meta_ads', 'get_campaigns', { ad_account_id: adAccountId });
}

export async function getMetaCampaignInsights(campaignId: string, startDate?: string, endDate?: string) {
  return callMCPTool('meta_ads', 'get_campaign_insights', {
    campaign_id: campaignId,
    start_date: startDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end_date: endDate || new Date().toISOString().slice(0, 10),
  });
}

export async function getMetaPageInsights(pageId?: string) {
  return callMCPTool('meta_ads', 'get_page_insights', { page_id: pageId });
}

// --- Socialync Wrappers ---

export async function socialyncCreatePost(options: {
  platforms: string[];
  caption: string;
  mediaUrl?: string;
  scheduledAt?: string;
}) {
  return callMCPTool('socialync', 'create_post', {
    platforms: options.platforms,
    caption: options.caption,
    media_url: options.mediaUrl,
    scheduled_at: options.scheduledAt,
  });
}

export async function socialyncGetScheduled() {
  return callMCPTool('socialync', 'get_scheduled_posts', {});
}

export async function socialyncGetAnalytics(postId?: string) {
  return callMCPTool('socialync', 'get_post_analytics', { post_id: postId });
}

export async function socialyncListAccounts() {
  return callMCPTool('socialync', 'list_connected_accounts', {});
}
