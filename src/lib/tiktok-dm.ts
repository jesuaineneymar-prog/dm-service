// ============================================================
//  AURA TIKTOK DM ENGINE — Steel.dev + CDP puro
//  Usa chrome-remote-interface (CDP) em vez de playwright-core
//  Steel.dev: proxy residencial, CAPTCHA solving, fingerprinting
//  Browserless.io: fallback
//  Adaptado de: AliMantach/tiktok-streak-bot
// ============================================================

import { STEEL_API_KEY, BROWSERLESS_ENDPOINT, TIKTOK_USERNAME, TIKTOK_PASSWORD } from './config';

// === TIPOS ===

export interface TikTokDMResult {
  success: boolean;
  error?: string;
  data?: any;
  sent?: number;
  failed?: number;
  details?: any[];
}

const TIKTOK_STEEL_PROFILE_KEY = 'tiktok_steel_profile_id';
const TIKTOK_SESSION_KEY = 'tiktok_dm_session';
const STEEL_API = 'https://api.steel.dev/v1';

// === DYNAMIC IMPORTS ===

async function getDb() {
  var dbModule = await import('./db');
  return dbModule.db;
}

// CDP client — chrome-remote-interface (sem binarios, sem browsers.json)
interface CDPClient {
  Page: { navigate: (opts: { url: string }) => Promise<any>; reload: () => Promise<any>; screenshot: (opts: { format?: string }) => Promise<any> };
  Runtime: { evaluate: (expr: string) => Promise<any> };
  Input: { dispatchMouseEvent: (opts: any) => Promise<any>; dispatchKeyEvent: (opts: any) => Promise<any>; insertText: (opts: { text: string }) => Promise<any> };
  DOM: { getDocument: () => Promise<any>; querySelectorAll: (opts: { nodeId: number; selector: string }) => Promise<any> };
  on: (event: string, cb: any) => void;
  close: () => Promise<void>;
}

async function connectCDP(wsEndpoint: string): Promise<CDPClient> {
  var CRI = await import('chrome-remote-interface');
  return await CRI({ target: wsEndpoint });
}

// === STEEL.DEV REST API ===

function steelHeaders(): Record<string, string> {
  return { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' };
}

async function steelCreateSession(): Promise<{ id: string; websocketUrl: string; profileId?: string; sessionViewerUrl?: string }> {
  var savedProfileId = await loadSetting(TIKTOK_STEEL_PROFILE_KEY);
  var body: any = { timeout: 600000, persistProfile: true };
  // Launch plan: sem proxy/CAPTCHA (requer deposito)
  // useProxy e solveCaptcha so habilitados se tiver saldo
  if (process.env.STEEL_USE_PROXY === 'true') body.useProxy = true;
  if (process.env.STEEL_SOLVE_CAPTCHA === 'true') body.solveCaptcha = true;
  if (savedProfileId) body.profileId = savedProfileId;

  var res = await fetch(STEEL_API + '/sessions', { method: 'POST', headers: steelHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { var t = await res.text().catch(() => ''); throw new Error('Steel API ' + res.status + ': ' + t.slice(0, 300)); }
  var data = await res.json();
  var sessionId = data.id || '';
  var profileId = data.profileId || '';
  if (profileId && profileId !== savedProfileId) await saveSetting(TIKTOK_STEEL_PROFILE_KEY, profileId);
  console.log('[TikTok DM] Steel sessao:', sessionId, 'profile:', profileId);
  return { id: sessionId, websocketUrl: data.websocketUrl || '', profileId: profileId || undefined, sessionViewerUrl: data.sessionViewerUrl };
}

async function steelReleaseSession(sessionId: string): Promise<void> {
  try { await fetch(STEEL_API + '/sessions/' + sessionId + '/release', { method: 'POST', headers: steelHeaders() }); } catch(e) {}
}

// === DB ===

async function saveSetting(key: string, value: string): Promise<void> {
  try { var db = await getDb(); await db.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }); } catch(e) {}
}

async function loadSetting(key: string): Promise<string | null> {
  try { var db = await getDb(); var r = await db.systemSetting.findUnique({ where: { key } }); return r?.value || null; } catch(e) { return null; }
}

interface StoredCookies { cookies: any[]; localStorage: Record<string, string>; updatedAt: string; }

async function saveCookiesJSON(cookies: any[]): Promise<void> {
  await saveSetting(TIKTOK_SESSION_KEY, JSON.stringify({ cookies, localStorage: {}, updatedAt: new Date().toISOString() } as StoredCookies));
}

async function loadCookies(): Promise<any[] | null> {
  try { var raw = await loadSetting(TIKTOK_SESSION_KEY); if (!raw) return null; return JSON.parse(raw).cookies; } catch(e) { return null; }
}

// === CONEXAO ===

interface BrowserSession {
  cdp: CDPClient;
  steelSessionId?: string;
  viewerUrl?: string;
  cleanup: () => Promise<void>;
}

async function connectViaSteel(): Promise<BrowserSession> {
  if (!STEEL_API_KEY) throw new Error('STEEL_API_KEY nao configurado');
  var session = await steelCreateSession();
  var wsUrl = session.websocketUrl + '&apiKey=' + STEEL_API_KEY;
  var cdp = await connectCDP(wsUrl);
  return {
    cdp,
    steelSessionId: session.id,
    viewerUrl: session.sessionViewerUrl,
    cleanup: async function() {
      try { await cdp.close(); } catch(e) {}
      try { await steelReleaseSession(session.id); } catch(e) {}
    },
  };
}

async function connectViaBrowserless(): Promise<BrowserSession> {
  if (!BROWSERLESS_ENDPOINT) throw new Error('Browserless nao configurado');
  var cdp = await connectCDP(BROWSERLESS_ENDPOINT);
  return {
    cdp,
    cleanup: async function() { try { await cdp.close(); } catch(e) {} },
  };
}

async function connectBrowser(): Promise<BrowserSession> {
  if (STEEL_API_KEY) {
    try { return await connectViaSteel(); }
    catch (e: any) { console.error('[TikTok DM] Steel falhou, tentando Browserless:', e.message); }
  }
  return await connectViaBrowserless();
}

// === CDP HELPERS ===

// Esperar por um seletor CSS aparecer na pagina (polling)
async function waitForSelector(cdp: CDPClient, selector: string, timeoutMs: number = 5000): Promise<number | null> {
  var start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      var doc = await cdp.DOM.getDocument();
      var result = await cdp.DOM.querySelectorAll({ nodeId: doc.root.nodeId, selector: selector });
      if (result.nodeIds && result.nodeIds.length > 0) return result.nodeIds[0];
    } catch(e) {}
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  return null;
}

// Clicar num elemento
async function clickElement(cdp: CDPClient, selector: string, timeoutMs: number = 3000): Promise<boolean> {
  var nodeId = await waitForSelector(cdp, selector, timeoutMs);
  if (!nodeId) return false;
  try {
    // Obter caixa do elemento para clicar no centro
    var box = await cdp.DOM.getBoxModel({ nodeId: nodeId });
    var x = Math.round((box.model.content[0] + box.model.content[2]) / 2);
    var y = Math.round((box.model.content[1] + box.model.content[5]) / 2);
    await cdp.Input.dispatchMouseEvent({ type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
    await new Promise(function(r) { setTimeout(r, 50); });
    await cdp.Input.dispatchMouseEvent({ type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
    return true;
  } catch(e) { return false; }
}

// Preencher input
async function fillInput(cdp: CDPClient, selector: string, text: string, delayMs: number = 40): Promise<boolean> {
  var nodeId = await waitForSelector(cdp, selector, 3000);
  if (!nodeId) return false;
  try {
    var box = await cdp.DOM.getBoxModel({ nodeId: nodeId });
    var x = Math.round((box.model.content[0] + box.model.content[2]) / 2);
    var y = Math.round((box.model.content[1] + box.model.content[5]) / 2);
    await cdp.Input.dispatchMouseEvent({ type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
    await cdp.Input.dispatchMouseEvent({ type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
    await new Promise(function(r) { setTimeout(r, 200); });
    await cdp.Input.insertText({ text: text });
    return true;
  } catch(e) { return false; }
}

// Avaliar JavaScript na pagina
async function evalJS(cdp: CDPClient, expr: string): Promise<any> {
  var result = await cdp.Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true });
  return result.result?.value;
}

// Verificar se elemento existe
async function elementExists(cdp: CDPClient, selector: string, timeoutMs: number = 2000): Promise<boolean> {
  var nodeId = await waitForSelector(cdp, selector, timeoutMs);
  return nodeId !== null;
}

// Dismiss popups
async function dismissPopups(cdp: CDPClient): Promise<void> {
  var selectors = [
    '[data-e2e="modal-close-inner-button"]', '[class*="close"]',
    'button:has-text("Accept all")', 'button:has-text("Got it")',
    'button:has-text("Not now")', 'button:has-text("Skip")',
    '[aria-label="Close"]',
  ];
  for (var sel of selectors) { try { await clickElement(cdp, sel, 800); } catch(e) {} }
}

// Verificar se esta logado no TikTok
async function isLoggedIn(cdp: CDPClient): Promise<boolean> {
  return await elementExists(cdp, '[data-e2e="message-icon"]', 2000) ||
         await elementExists(cdp, 'a[href*="/messages"]', 2000) ||
         await elementExists(cdp, '[data-e2e="topbar-avatar"]', 2000);
}

// === LOGIN ===

async function loginToTikTok(cdp: CDPClient): Promise<boolean> {
  try {
    console.log('[TikTok DM] Login para:', TIKTOK_USERNAME);
    await cdp.Page.navigate({ url: 'https://www.tiktok.com/login?lang=en' });
    await new Promise(function(r) { setTimeout(r, 3000); });
    await dismissPopups(cdp);

    if (await isLoggedIn(cdp)) { console.log('[TikTok DM] Ja logado!'); return true; }

    if (!TIKTOK_USERNAME || !TIKTOK_PASSWORD) return false;

    // Clicar em Use phone/email/username
    await clickElement(cdp, '[data-e2e="login-tab-item"]', 2000);
    await new Promise(function(r) { setTimeout(r, 1000); });

    // Preencher username
    await fillInput(cdp, 'input[type="text"], input[name="email"], input[name="username"]', TIKTOK_USERNAME, 50);
    await new Promise(function(r) { setTimeout(r, 500); });

    // Preencher senha
    await fillInput(cdp, 'input[type="password"]', TIKTOK_PASSWORD, 40);
    await new Promise(function(r) { setTimeout(r, 500); });

    // Clicar Log in
    await clickElement(cdp, '[data-e2e="login-button"], button', 3000);
    console.log('[TikTok DM] Botao login clicado, a aguardar...');
    await new Promise(function(r) { setTimeout(r, 8000); });

    await dismissPopups(cdp);

    if (await isLoggedIn(cdp)) { console.log('[TikTok DM] LOGIN BEM-SUCEDIDO!'); return true; }

    // Verificar CAPTCHA — Steel resolve automaticamente
    await new Promise(function(r) { setTimeout(r, 10000); });
    if (await isLoggedIn(cdp)) { console.log('[TikTok DM] CAPTCHA resolvido!'); return true; }

    // Verificar erro
    var hasError = await evalJS(cdp, '!!(document.body.innerText.match(/invalid|incorrect|wrong password|doesn\'t match/i))');
    if (hasError) { console.error('[TikTok DM] Credenciais incorretas!'); return false; }

    console.log('[TikTok DM] Login inconclusivo');
    return false;
  } catch (e: any) { console.error('[TikTok DM] Erro login:', e.message); return false; }
}

// === ENVIAR DM ===

async function sendDMToUser(cdp: CDPClient, username: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[TikTok DM] DM para @' + username);
    await cdp.Page.navigate({ url: 'https://www.tiktok.com/messages' });
    await new Promise(function(r) { setTimeout(r, 3000); });
    await dismissPopups(cdp);

    // Verificar se conversa existe
    var chatSelector = '[data-e2e="chat-list-item"]';
    var chatExists = await evalJS(cdp, '!!document.querySelector(\'[data-e2e="chat-list-item"]\')?.textContent?.includes("' + username + '")');
    if (chatExists) {
      await evalJS(cdp, 'var el = document.querySelector(\'[data-e2e="chat-list-item"]\'); if(el && el.textContent.includes("' + username + '")) el.click();');
      await new Promise(function(r) { setTimeout(r, 2000); });
    } else {
      // Tentar nova mensagem
      var newMsgClicked = await clickElement(cdp, '[data-e2e="new-message-btn"], button', 2000);
      if (newMsgClicked) {
        await new Promise(function(r) { setTimeout(r, 1500); });
        await fillInput(cdp, 'input[placeholder*="Search"], input[placeholder*="search"], input[type="text"]', '@' + username, 50);
        await new Promise(function(r) { setTimeout(r, 3000); });

        var found = await evalJS(cdp, '!!document.querySelector(\'[data-e2e="search-result-item"]\')?.textContent?.includes("' + username + '")');
        if (found) {
          await evalJS(cdp, 'var r = document.querySelector(\'[data-e2e="search-result-item"]\'); if(r && r.textContent.includes("' + username + '")) r.click();');
          await new Promise(function(r) { setTimeout(r, 2000); });
        } else {
          return { success: false, error: '@' + username + ' nao encontrado' };
        }
      } else {
        // Fallback: ir ao perfil
        await cdp.Page.navigate({ url: 'https://www.tiktok.com/@' + username });
        await new Promise(function(r) { setTimeout(r, 3000); });
        await dismissPopups(cdp);
        var msgClicked = await clickElement(cdp, '[data-e2e="profile-message-button"], a:has-text("Message"), button:has-text("Message")', 3000);
        if (!msgClicked) return { success: false, error: 'Botao mensagem nao encontrado no perfil de @' + username };
        await new Promise(function(r) { setTimeout(r, 2000); });
      }
    }

    // Escrever mensagem no input
    var inputFilled = await fillInput(cdp, '[data-e2e="message-input"], div[contenteditable="true"], textarea', message, 30);
    if (!inputFilled) return { success: false, error: 'Campo de mensagem nao encontrado' };

    // Pressionar Enter via teclado
    await cdp.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(function(r) { setTimeout(r, 50); });
    await cdp.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(function(r) { setTimeout(r, 1500); });

    console.log('[TikTok DM] DM enviado para @' + username);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === PUBLIC API ===

export async function tiktokSendDM(options: { username: string; message: string; saveSession?: boolean }): Promise<TikTokDMResult> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser();
    if (!await isLoggedIn(session.cdp)) {
      if (!await loginToTikTok(session.cdp)) {
        await session.cleanup();
        return { success: false, error: 'Login TikTok falhou. Verifique credenciais.' };
      }
    }
    var result = await sendDMToUser(session.cdp, options.username, options.message);
    await session.cleanup();
    return result.success
      ? { success: true, sent: 1, failed: 0, data: { username: options.username, message: options.message } }
      : { success: false, error: result.error, sent: 0, failed: 1 };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message, sent: 0, failed: 1 }; }
}

export async function tiktokBulkDM(options: { users: Array<{ username: string; message?: string }>; defaultMessage?: string; delayBetweenUsers?: number }): Promise<TikTokDMResult> {
  var session: BrowserSession | null = null;
  var sent = 0, failed = 0, details: any[] = [];
  try {
    session = await connectBrowser();
    if (!await isLoggedIn(session.cdp)) {
      if (!await loginToTikTok(session.cdp)) { await session.cleanup(); return { success: false, error: 'Login falhou' }; }
    }
    var delay = options.delayBetweenUsers || 3000;
    for (var i = 0; i < options.users.length; i++) {
      var u = options.users[i]; var msg = u.message || options.defaultMessage || '';
      if (!msg) { details.push({ username: u.username, success: false, error: 'Mensagem vazia' }); failed++; continue; }
      var r = await sendDMToUser(session.cdp, u.username, msg);
      details.push({ username: u.username, ...r });
      if (r.success) sent++; else failed++;
      if (i < options.users.length - 1) await new Promise(function(res) { setTimeout(res, delay); });
    }
    await session.cleanup();
    return { success: sent > 0, sent, failed, details };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message, sent, failed, details }; }
}

export async function tiktokDMStatus(): Promise<any> {
  return {
    steelConfigured: !!STEEL_API_KEY,
    browserlessConfigured: !!BROWSERLESS_ENDPOINT,
    credentialsConfigured: !!(TIKTOK_USERNAME && TIKTOK_PASSWORD),
    steelProfileId: await loadSetting(TIKTOK_STEEL_PROFILE_KEY) || undefined,
  };
}

export async function tiktokLoginAndSave(): Promise<TikTokDMResult> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser();
    await session.cdp.Page.navigate({ url: 'https://www.tiktok.com' });
    await new Promise(function(r) { setTimeout(r, 3000); });
    await dismissPopups(session.cdp);
    if (await isLoggedIn(session.cdp)) {
      var v = session.viewerUrl; await session.cleanup();
      return { success: true, data: { message: 'Sessao TikTok valida', provider: session.steelSessionId ? 'steel' : 'browserless', viewerUrl: v } };
    }
    var loggedIn = await loginToTikTok(session.cdp);
    if (!loggedIn) { await session.cleanup(); return { success: false, error: 'Login falhou' }; }
    var v2 = session.viewerUrl; await session.cleanup();
    return { success: true, data: { message: 'Login TikTok bem-sucedido', provider: session.steelSessionId ? 'steel' : 'browserless', viewerUrl: v2 } };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message }; }
}

export async function tiktokClearSession(): Promise<void> {
  try { var db = await getDb(); await db.systemSetting.deleteMany({ where: { key: { in: [TIKTOK_SESSION_KEY, TIKTOK_STEEL_PROFILE_KEY] } } }); } catch(e) {}
}

export async function tiktokScreenshot(): Promise<{ success: boolean; screenshot?: string; error?: string }> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser();
    await session.cdp.Page.navigate({ url: 'https://www.tiktok.com/messages' });
    await new Promise(function(r) { setTimeout(r, 3000); });
    var ss = await session.cdp.Page.screenshot({ format: 'png' });
    await session.cleanup();
    return { success: true, screenshot: Buffer.from(ss.data, 'base64').toString('base64') };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message }; }
}
