// ============================================================
//  Aura ARCADE ENGINE — Actions Runtime para AI Agents
//  Wrapper leve do SDK @arcadeai/arcadejs para uso serverless
//  Google Search, Gmail, Google Docs, Sheets, Slack, Notion,
//  LinkedIn, e 100+ ferramentas com OAuth gerido.
// ============================================================

import { Arcade } from '@arcadeai/arcadejs';
import { ARCADE_KEY, ARCADE_USER_ID } from './config';

// --- Singleton lazy do cliente Arcade ---
var _client: Arcade | null = null;

function getArcadeClient(): Arcade {
  if (!_client) {
    if (!ARCADE_KEY) {
      throw new Error('ARCADE_KEY nao configurada. Defina a env var ARCADE_KEY.');
    }
    _client = new Arcade({ apiKey: ARCADE_KEY });
  }
  return _client;
}

// === LISTAR FERRAMENTAS ===
// Retorna lista paginada de ferramentas disponiveis no projeto

export async function arcadeListTools(limit?: number): Promise<{
  success: boolean;
  data?: any[];
  total?: number;
  error?: string;
}> {
  try {
    var client = getArcadeClient();
    var page = await client.tools.list({ limit: limit || 100 });
    var tools = page.getPaginatedItems();
    return {
      success: true,
      data: tools.map(function(t: any) {
        return {
          name: t.name,
          fully_qualified_name: t.fully_qualified_name,
          description: t.description || '',
          toolkit: t.toolkit ? t.toolkit.name : '',
          required_auth: !!(t.requirements && t.requirements.authorization),
        };
      }),
      total: page.total_count,
    };
  } catch (e: any) {
    return { success: false, error: 'Arcade list: ' + e.message };
  }
}

// === EXECUTAR FERRAMENTA ===
// Executa uma ferramenta pelo nome com input JSON

export async function arcadeExecuteTool(
  toolName: string,
  input?: Record<string, any>,
  userId?: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    var client = getArcadeClient();
    var uid = userId || ARCADE_USER_ID;
    var result = await client.tools.execute({
      tool_name: toolName,
      input: input || {},
      user_id: uid,
    });

    if (result.success) {
      return { success: true, data: result.output };
    } else {
      var errorMsg = '';
      if (result.output && result.output.error) {
        errorMsg = result.output.error.message;
      }
      return { success: false, error: errorMsg || 'Arcade execute: falha na execucao da ferramenta' };
    }
  } catch (e: any) {
    return { success: false, error: 'Arcade execute: ' + e.message };
  }
}

// === AUTORIZAR FERRAMENTA (OAuth) ===
// Retorna URL de autorizacao OAuth para uma ferramenta

export async function arcadeAuthorize(
  toolName: string,
  userId?: string
): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    var client = getArcadeClient();
    var uid = userId || ARCADE_USER_ID;
    var authResult = await client.tools.authorize({
      tool_name: toolName,
      user_id: uid,
    });
    return { success: true, data: authResult };
  } catch (e: any) {
    return { success: false, error: 'Arcade authorize: ' + e.message };
  }
}

// === PESQUISAR FERRAMENTAS ===
// Lista ferramentas e filtra por query (nome ou descricao)

export async function arcadeSearchTools(query: string): Promise<{
  success: boolean;
  data?: any[];
  total?: number;
  error?: string;
}> {
  try {
    var client = getArcadeClient();
    var page = await client.tools.list({ limit: 200 });
    var tools = page.getPaginatedItems();
    var q = query.toLowerCase();
    var filtered = tools.filter(function(t: any) {
      var name = (t.name || '').toLowerCase();
      var desc = (t.description || '').toLowerCase();
      var toolkit = t.toolkit ? (t.toolkit.name || '').toLowerCase() : '';
      return name.indexOf(q) !== -1 || desc.indexOf(q) !== -1 || toolkit.indexOf(q) !== -1;
    });
    return {
      success: true,
      data: filtered.map(function(t: any) {
        return {
          name: t.name,
          fully_qualified_name: t.fully_qualified_name,
          description: t.description || '',
          toolkit: t.toolkit ? t.toolkit.name : '',
          required_auth: !!(t.requirements && t.requirements.authorization),
        };
      }),
      total: filtered.length,
    };
  } catch (e: any) {
    return { success: false, error: 'Arcade search: ' + e.message };
  }
}

// === STATUS DO ARCADE ===
// Verifica se a chave esta configurada e o cliente funciona

export async function getArcadeStatus(): Promise<{
  configured: boolean;
  status: string;
  user_id?: string;
  error?: string;
}> {
  if (!ARCADE_KEY) {
    return { configured: false, status: 'no_key' };
  }
  try {
    var client = getArcadeClient();
    // Tenta listar 1 ferramenta para validar a chave
    await client.tools.list({ limit: 1 });
    return { configured: true, status: 'ok', user_id: ARCADE_USER_ID || undefined };
  } catch (e: any) {
    return { configured: true, status: 'error', error: e.message };
  }
}
