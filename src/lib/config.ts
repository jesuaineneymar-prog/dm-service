// ============================================================
//  Aura CONFIG CENTRALIZADO
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
export var SCRAPING_BEE_KEY = env('SCRAPING_BEE_API_KEY', '');
export var UPLOADPOST_KEY = env('UPLOADPOST_KEY', '') || env('UPLOAD_POST_API_KEY', '');
export var BROWSERLESS_KEY = env('BROWSERLESS_KEY', '');
export var CRON_SECRET = env('CRON_SECRET', '');
export var OR_KEY = env('OR_KEY', '');
export var OR_KEY_NEW = env('OR_KEY', '');

// --- Zernio (DMs — IG + FB) ---
export var ZERNIO_KEY = env('ZERNIO_KEY', '');

// --- Zernio TikTok (segunda conta com TikTok conectado) ---
export var ZERNIO_TT_KEY = env('ZERNIO_TT_KEY', '');

// --- Contas ---
export var IG_USERNAME = env('IG_USERNAME', '');

// --- OpenRouter (IA) ---
export var OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
export var OR_MODEL = 'x-ai/grok-3-beta';
export var OR_FALLBACK_MODEL = 'google/gemma-4-26b-a4b-it:free';

// --- Steel.dev (Browser API com anti-detection + proxy residencial) ---
// Para Instagram e Facebook DMs via CDP — sessoes persistidas
export var STEEL_API_KEY = env('STEEL_API_KEY', '');

// --- Browserless.io (fallback — sem anti-detection) ---
export var BROWSERLESS_TOKEN = env('BROWSERLESS_TOKEN', '');
export var BROWSERLESS_ENDPOINT = BROWSERLESS_TOKEN
  ? 'wss://chrome.browserless.io?token=' + BROWSERLESS_TOKEN
  : 'wss://chrome.browserless.io';

// --- TikTok DM (Playwright) ---
export var TIKTOK_USERNAME = env('TIKTOK_USERNAME', '');
export var TIKTOK_PASSWORD = env('TIKTOK_PASSWORD', '');

// --- ManyChat / N8N (opcional) ---
export var MANYCHAT_KEY = env('MANYCHAT_API_KEY', '');
export var N8N_WEBHOOK_URL = env('N8N_WEBHOOK_URL', '');

// --- MCP Servers ---
export var SOCIALCRAWL_KEY = env('SOCIALCRAWL_KEY', '');
export var TIKTOK_ADS_MCP_KEY = env('TIKTOK_ADS_MCP_KEY', '');
export var META_ADS_MCP_KEY = env('META_ADS_MCP_KEY', '');
export var SOCIALYNC_KEY = env('SOCIALYNC_KEY', '');
// --- Arcade (Actions Runtime) ---
export var ARCADE_KEY = env('ARCADE_KEY', '');
export var ARCADE_USER_ID = env('ARCADE_USER_ID', 'mwango-brain-agent');

// --- SerpAPI (Google Search) ---
export var SERPAPI_KEY = env('SERPAPI_KEY', '');

// --- NSTBrowser (anti-detect browser — alternativa ao Steel) ---
// Precisa do NSTBrowser client a correr localmente (porta 8899)
// Download: https://www.nstbrowser.com/ — GRATUITO, perfis ilimitados
export var NST_BROWSER_URL = env('NST_BROWSER_URL', 'http://127.0.0.1:8899');

// --- Instagram Private API (DMs sem browser via private endpoints) ---
// Risco de ban — usar com cautela, preferir NSTBrowser quando possivel
export var IG_PRIVATE_API_ENABLED = env('IG_PRIVATE_API_ENABLED', 'true') === 'true';

// --- Bright Data Scraping Browser (Cold DMs — IG + FB via Puppeteer) ---
// WSS endpoint completo — se a env var nao estiver definida, usa o default da zona 'aura'
export var BRIGHT_DATA_WS_ENDPOINT = env('BRIGHT_DATA_WS_ENDPOINT',
  'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222'
);
export var BRIGHT_DATA_TOKEN = env('BRIGHT_DATA_TOKEN', '');
export var BRIGHT_DATA_CUSTOMER_ID = env('BRIGHT_DATA_CUSTOMER_ID', '');
export var BRIGHT_DATA_ZONE = env('BRIGHT_DATA_ZONE', '');
export var BRIGHT_DATA_ZONE_PASS = env('BRIGHT_DATA_ZONE_PASS', '');

// --- Meta Graph API (proactive DMs, pages) ---
export var META_ACCESS_TOKEN = env('META_ACCESS_TOKEN', '');
export var META_APP_ID = env('META_APP_ID', '');
export var META_APP_SECRET = env('META_APP_SECRET', '');
export var META_PAGE_ID = env('META_PAGE_ID', '');
export var META_PAGE_TOKEN = env('META_PAGE_TOKEN', '');

// --- Messenger Webhook (native FB — no Zernio) ---
export var MESSENGER_VERIFY_TOKEN = env('MESSENGER_VERIFY_TOKEN', 'aura_mwango_verify_2024');



// --- OpenRouter (primary LLM — Groq removido) ---
// All AI generation usa OpenRouter via ai.ts. Estas vars sao legado mas apontam para OR.
export var LLM_API_KEY = OR_KEY;
export var LLM_BASE_URL = OR_URL;
export var LLM_MODEL = OR_MODEL;

// --- Auth ---
export var AUTH_PASSWORD = env('AUTH_PASSWORD', '');

// --- Validacao rapida ---
export function getMissingKeys(): string[] {
  var missing: string[] = [];
  if (!TURSO_URL) missing.push('TURSO_URL');
  if (!TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
  if (!CRON_SECRET) missing.push('CRON_SECRET');
  return missing;
}
