// ============================================================
//  JARVIS CONFIG CENTRALIZADO
//  Todas as chaves e configuracoes em um so lugar
//  Nenhuma chave hardcodada — so usa process.env
// ============================================================

export function env(name: string, fallback: string = ''): string {
  return process.env[name] || fallback;
}

// --- Database (Turso) ---
export var TURSO_URL = env('TURSO_URL', '');
export var TURSO_AUTH_TOKEN = env('TURSO_AUTH_TOKEN', '');

// --- API Keys ---
export var HIKERAPI_KEY = env('HIKERAPI_KEY', '') || env('HIKER_API_KEY', '');
export var UPLOADPOST_KEY = env('UPLOADPOST_KEY', '') || env('UPLOAD_POST_API_KEY', '');
export var BROWSERLESS_KEY = env('BROWSERLESS_KEY', '');
export var CRON_SECRET = env('CRON_SECRET', '');
export var OR_KEY = env('OR_KEY', '');

// --- Zernio (DMs) ---
export var ZERNIO_KEY = env('ZERNIO_KEY', '');

// --- Contas ---
export var IG_USERNAME = env('IG_USERNAME', '');

// --- OpenRouter (IA) ---
export var OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
export var OR_MODEL = 'google/gemini-2.0-flash-exp:free';
export var OR_FALLBACK_MODEL = 'meta-llama/llama-3.2-3b-instruct:free';

// --- ManyChat / N8N (opcional) ---
export var MANYCHAT_KEY = env('MANYCHAT_API_KEY', '');
export var N8N_WEBHOOK_URL = env('N8N_WEBHOOK_URL', '');

// --- MCP Servers ---
export var SOCIALCRAWL_KEY = env('SOCIALCRAWL_KEY', '');
export var TIKTOK_ADS_MCP_KEY = env('TIKTOK_ADS_MCP_KEY', '');
export var META_ADS_MCP_KEY = env('META_ADS_MCP_KEY', '');
export var SOCIALYNC_KEY = env('SOCIALYNC_KEY', '');
export var COMPOSIO_KEY = env('COMPOSIO_API_KEY', '') || env('COMPOSIO_KEY', '');

// --- Sociavault (Scraping) ---
export var SOCIAVAULT_KEY = env('SOCIAVAULT_API_KEY', '');

// --- Validacao rapida ---
export function getMissingKeys(): string[] {
  var missing: string[] = [];
  if (!TURSO_URL) missing.push('TURSO_URL');
  if (!TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
  if (!CRON_SECRET) missing.push('CRON_SECRET');
  if (!OR_KEY) missing.push('OR_KEY');
  return missing;
}