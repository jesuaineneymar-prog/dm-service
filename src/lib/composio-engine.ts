// ============================================================
//  Aura COMPOSIO ENGINE — 1000+ Apps via SDK
//  Usa @composio/client para criar sessoes, gerir OAuth,
//  e executar ferramentas de redes sociais e marketing
//
//  Arquitetura:
//    - REST API direta via @composio/client
//    - Sessions com Toolkits (social media, analytics, etc.)
//    - Meta tools: COMPOSIO_SEARCH_TOOLS, COMPOSIO_ACT,
//    - MCP URL por sessao para JSON-RPC direto
//
//  Toolkits relevantes para Mwango Brain:
//    instagram, tiktok, facebook, linkedin, twitter,
//    youtube, googleanalytics, google_sheets, gmail,
//    googleads, canva, slack, notion
// ============================================================

import { COMPOSIO_KEY } from './config';

// === TIPOS ===

export interface ComposioSessionInfo {
  sessionId: string;
  mcpUrl: string;
  userId: string;
  toolkits: string[];
  createdAt: string;
}

export interface ComposioToolResult {
  success: boolean;
  data?: any;
  error?: string;
  toolSlug?: string;
}

export interface ComposioToolkitInfo {
  slug: string;
  name: string;
  description: string;
  category: string;
  logo?: string;
  connected: boolean;
  toolsCount: number;
}

// === CONFIGURACAO ===

var BASE_URL = 'https://backend.composio.dev';
var USER_ID = 'jarvis-mwango';

// Toolkits sociais para Mwango Brain
var SOCIAL_TOOLKITS = [
  'instagram',
  'tiktok',
  'facebook',
  'linkedin',
  'twitter',
  'youtube',
  'googleanalytics',
  'googleads',
  'google_sheets',
  'gmail',
  'canva',
];

// Cache de sessao (in-memory, valida durante o cold start do Vercel)
var cachedSession: ComposioSessionInfo | null = null;

// === HELPER: Chamada REST API Composio ===

async function composioAPI(path: string, options: RequestInit = {}): Promise<any> {
  if (!COMPOSIO_KEY) {
    return { error: { message: 'COMPOSIO_KEY nao configurada. Adicione em Settings > Environment Variables.', code: 401, slug: 'NO_API_KEY' } };
  }

  var url = BASE_URL + path;
  var headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-api-key': COMPOSIO_KEY,
  };

  var res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  var data = await res.json().catch(function() { return null; });
  return data;
}

// === SESSION MANAGEMENT ===

// Criar nova sessao com toolkits sociais
export async function createSession(toolkits?: string[]): Promise<{ success: boolean; session?: ComposioSessionInfo; error?: string }> {
  var tkits = toolkits || SOCIAL_TOOLKITS;

  try {
    var body: any = { user_id: USER_ID };
    if (tkits.length > 0) {
      body.toolkits = tkits;
    }

    var data = await composioAPI('/api/v3.1/tool_router/session', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (data?.error) {
      return { success: false, error: data.error.message || JSON.stringify(data.error) };
    }

    var sessionId = data?.session_id || data?.id || data?.data?.session_id;
    var mcpUrl = data?.mcp_url || data?.mcp?.url || data?.data?.mcp_url;

    if (!sessionId) {
      // Tentar extrair de qualquer campo
      var keys = Object.keys(data || {});
      for (var i = 0; i < keys.length; i++) {
        var val = data[keys[i]];
        if (val && typeof val === 'object' && val.session_id) {
          sessionId = val.session_id;
          mcpUrl = val.mcp_url || val.mcp?.url;
          break;
        }
      }
    }

    if (!sessionId) {
      return { success: false, error: 'Resposta inesperada da API Composio: ' + JSON.stringify(data).slice(0, 500) };
    }

    var sessionInfo: ComposioSessionInfo = {
      sessionId: sessionId,
      mcpUrl: mcpUrl || '',
      userId: USER_ID,
      toolkits: tkits,
      createdAt: new Date().toISOString(),
    };

    cachedSession = sessionInfo;
    return { success: true, session: sessionInfo };
  } catch (e: any) {
    return { success: false, error: 'Erro ao criar sessao Composio: ' + e.message };
  }
}

// Obter sessao existente (cache ou criar nova)
export async function getSession(): Promise<{ success: boolean; session?: ComposioSessionInfo; error?: string }> {
  if (cachedSession) {
    return { success: true, session: cachedSession };
  }
  return createSession();
}

// Recuperar sessao por ID
export async function retrieveSession(sessionId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    var data = await composioAPI('/api/v3.1/tool_router/session/' + sessionId);
    if (data?.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === TOOL EXECUTION ===

// Executar ferramenta numa sessao (meta ou app tool)
export async function executeTool(
  toolSlug: string,
  params: Record<string, any> = {},
  sessionId?: string
): Promise<ComposioToolResult> {
  var sess = sessionId || cachedSession?.sessionId;
  if (!sess) {
    var sResult = await getSession();
    if (!sResult.success || !sResult.session) {
      return { success: false, error: sResult.error || 'Nenhuma sessao disponivel' };
    }
    sess = sResult.session.sessionId;
  }

  try {
    var data = await composioAPI('/api/v3.1/tool_router/session/' + sess + '/execute', {
      method: 'POST',
      body: JSON.stringify({ tool_slug: toolSlug, ...params }),
    });

    if (data?.error) {
      return { success: false, error: data.error.message, toolSlug: toolSlug };
    }

    return { success: true, data: data, toolSlug: toolSlug };
  } catch (e: any) {
    return { success: false, error: 'Erro ao executar ' + toolSlug + ': ' + e.message, toolSlug: toolSlug };
  }
}

// Executar meta tool (COMPOSIO_SEARCH_TOOLS, COMPOSIO_ACT, etc.)
export async function executeMeta(
  slug: string,
  params: Record<string, any> = {},
  sessionId?: string
): Promise<ComposioToolResult> {
  var sess = sessionId || cachedSession?.sessionId;
  if (!sess) {
    var sResult = await getSession();
    if (!sResult.success || !sResult.session) {
      return { success: false, error: sResult.error || 'Nenhuma sessao disponivel' };
    }
    sess = sResult.session.sessionId;
  }

  try {
    var data = await composioAPI('/api/v3.1/tool_router/session/' + sess + '/execute_meta', {
      method: 'POST',
      body: JSON.stringify({ slug: slug, ...params }),
    });

    if (data?.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: 'Erro meta tool ' + slug + ': ' + e.message };
  }
}

// === TOOL SEARCH (descoberta) ===

// Pesquisar ferramentas por caso de uso
export async function searchTools(queries: string[]): Promise<ComposioToolResult> {
  var sess = cachedSession?.sessionId;
  if (!sess) {
    var sResult = await getSession();
    if (!sResult.success || !sResult.session) {
      return { success: false, error: sResult.error || 'Nenhuma sessao disponivel' };
    }
    sess = sResult.session.sessionId;
  }

  try {
    var body = {
      queries: queries.map(function(q) { return { use_case: q }; }),
    };

    var data = await composioAPI('/api/v3.1/tool_router/session/' + sess + '/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (data?.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === TOOLKITS ===

// Listar toolkits disponiveis na sessao
export async function listSessionToolkits(sessionId?: string): Promise<ComposioToolResult> {
  var sess = sessionId || cachedSession?.sessionId;
  if (!sess) {
    var sResult = await getSession();
    if (!sResult.success || !sResult.session) {
      return { success: false, error: sResult.error || 'Nenhuma sessao disponivel' };
    }
    sess = sResult.session.sessionId;
  }

  try {
    var data = await composioAPI('/api/v3.1/tool_router/session/' + sess + '/toolkits');
    if (data?.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === OAUTH / CONNECTIONS ===

// Gerar link de conexao OAuth para uma toolkit
export async function getConnectLink(toolkit: string): Promise<{
  success: boolean;
  link?: string;
  redirectUrl?: string;
  error?: string;
}> {
  var sess = cachedSession?.sessionId;
  if (!sess) {
    var sResult = await getSession();
    if (!sResult.success || !sResult.session) {
      return { success: false, error: sResult.error };
    }
    sess = sResult.session.sessionId;
  }

  try {
    var data = await composioAPI('/api/v3.1/tool_router/session/' + sess + '/link', {
      method: 'POST',
      body: JSON.stringify({ toolkit: toolkit }),
    });

    if (data?.error) {
      return { success: false, error: data.error.message };
    }

    return {
      success: true,
      link: data?.link || data?.url || data?.redirect_url,
      redirectUrl: data?.redirect_url || data?.url,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === MCP URL (JSON-RPC direto) ===

// Obter a MCP URL da sessao para JSON-RPC direto
export async function getMCPUrl(): Promise<{ success: boolean; url?: string; error?: string }> {
  var sess = await getSession();
  if (!sess.success || !sess.session) {
    return { success: false, error: sess.error };
  }

  if (sess.session.mcpUrl) {
    return { success: true, url: sess.session.mcpUrl };
  }

  // Se nao tem MCP URL, tentar recuperar da sessao
  if (sess.session.sessionId) {
    var retrieved = await retrieveSession(sess.session.sessionId);
    if (retrieved.success && retrieved.data) {
      var mcpUrl = retrieved.data?.mcp_url || retrieved.data?.mcp?.url || '';
      if (mcpUrl) {
        cachedSession!.mcpUrl = mcpUrl;
        return { success: true, url: mcpUrl };
      }
    }
  }

  return { success: false, error: 'MCP URL nao disponivel para esta sessao' };
}

// === LISTAR TOOLKITS DISPONIVEIS (catalogo) ===

export async function listAvailableToolkits(category?: string): Promise<ComposioToolResult> {
  try {
    var query = category ? '?category=' + category : '';
    var data = await composioAPI('/api/v3.1/toolkits' + query);
    if (data?.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true, data: data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// === STATUS CHECK ===

export async function getComposioStatus(): Promise<{
  configured: boolean;
  sessionActive: boolean;
  sessionId?: string;
  mcpUrl?: string;
  toolkitsCount: number;
  error?: string;
}> {
  if (!COMPOSIO_KEY) {
    return { configured: false, sessionActive: false, toolkitsCount: 0, error: 'API key nao configurada' };
  }

  // Testar se a API key e valida
  try {
    var testResult = await composioAPI('/api/v3.1/toolkits?limit=1');
    if (testResult?.error?.code === 801 || testResult?.error?.status === 401) {
      return { configured: true, sessionActive: false, toolkitsCount: 0, error: 'API key invalida' };
    }
  } catch (e: any) {
    return { configured: true, sessionActive: false, toolkitsCount: 0, error: e.message };
  }

  // Verificar sessao em cache
  if (cachedSession) {
    return {
      configured: true,
      sessionActive: true,
      sessionId: cachedSession.sessionId,
      mcpUrl: cachedSession.mcpUrl,
      toolkitsCount: cachedSession.toolkits.length,
    };
  }

  return {
    configured: true,
    sessionActive: false,
    toolkitsCount: SOCIAL_TOOLKITS.length,
  };
}

// === CONVENIENCE WRAPPERS ===
// Funcoes de alto nivel para a Aura usar diretamente

// Pesquisar ferramentas sociais por caso de uso
export async function findSocialTools(useCase: string) {
  return searchTools([
    useCase + ' on social media',
    useCase + ' marketing analytics',
  ]);
}

// Executar acao social (wrapper generico)
export async function executeSocialAction(toolSlug: string, params: Record<string, any>) {
  return executeTool(toolSlug, params);
}

// Listar contas conectadas via meta tool
export async function listConnectedAccounts() {
  return executeMeta('COMPOSIO_MANAGE_CONNECTIONS', { action: 'list' });
}

// Verificar status de toolkits sociais
export async function getSocialToolkitStatus() {
  return listSessionToolkits();
}

// Wrapper para publicar conteudo (usando meta tools)
export async function publishContent(params: {
  platform: string;
  content: string;
  mediaUrl?: string;
  caption?: string;
}) {
  // Primeiro pesquisa a ferramenta certa
  var searchResult = await searchTools([
    'Post ' + params.content + ' to ' + params.platform,
  ]);

  if (!searchResult.success || !searchResult.data) {
    return { success: false, error: 'Nao foi possivel encontrar ferramenta de publicacao para ' + params.platform };
  }

  // Se encontrou ferramentas, retornar sugestoes
  return {
    success: true,
    data: {
      message: 'Ferramentas encontradas para ' + params.platform,
      tools: searchResult.data,
      nextStep: 'Use executeTool com o slug da ferramenta desejada',
    },
  };
}

// Obter analytics de redes sociais
export async function getSocialAnalytics(params: {
  platform: string;
  metric?: string;
  dateRange?: string;
}) {
  return searchTools([
    'Get ' + (params.metric || 'analytics') + ' from ' + params.platform +
    (params.dateRange ? ' for ' + params.dateRange : ''),
  ]);
}

// === TOOLKITS PRE-DEFINIDOS PARA MWANGO BRAIN ===

export var MWANGO_TOOLKITS = [
  { slug: 'instagram', name: 'Instagram', icon: '📸', category: 'Rede Social', connected: false },
  { slug: 'tiktok', name: 'TikTok', icon: '🎵', category: 'Rede Social', connected: false },
  { slug: 'facebook', name: 'Facebook', icon: '📘', category: 'Rede Social', connected: false },
  { slug: 'linkedin', name: 'LinkedIn', icon: '💼', category: 'Rede Social', connected: false },
  { slug: 'twitter', name: 'X (Twitter)', icon: '𝕏', category: 'Rede Social', connected: false },
  { slug: 'youtube', name: 'YouTube', icon: '▶️', category: 'Video', connected: false },
  { slug: 'googleanalytics', name: 'Google Analytics', icon: '📊', category: 'Analytics', connected: false },
  { slug: 'googleads', name: 'Google Ads', icon: '📢', category: 'Ads', connected: false },
  { slug: 'google_sheets', name: 'Google Sheets', icon: '📋', category: 'Produtividade', connected: false },
  { slug: 'gmail', name: 'Gmail', icon: '📧', category: 'Comunicacao', connected: false },
  { slug: 'canva', name: 'Canva', icon: '🎨', category: 'Design', connected: false },
];
