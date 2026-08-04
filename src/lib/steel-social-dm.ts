// ============================================================
//  AURA STEEL.DEV — Instagram + Facebook DM Engine
//  Browser anti-detection para enviar DMs via IG Direct e FB Messenger
//  Fluxo: carregar sessao persistida → abrir plataforma/direct
//         → seleccionar conversa → escrever mensagem → Enter
//  Usa CDP (chrome-remote-interface) sem binarios locais
// ============================================================

import { STEEL_API_KEY, BROWSERLESS_ENDPOINT } from './config';

// @ts-ignore — no types available
import CRI from 'chrome-remote-interface';

// === TYPES ===

export interface SocialDMResult {
  success: boolean;
  error?: string;
  data?: any;
  sent?: number;
  failed?: number;
  details?: any[];
}

interface BrowserSession {
  cdp: any;
  steelSessionId?: string;
  viewerUrl?: string;
  cleanup: () => Promise<void>;
}

var STEEL_API = 'https://api.steel.dev/v1';
var IG_STEEL_PROFILE_KEY = 'ig_steel_profile_id';
var FB_STEEL_PROFILE_KEY = 'fb_steel_profile_id';

// === DYNAMIC IMPORTS ===

async function getDb() {
  var dbModule = await import('./db');
  return dbModule.db;
}

async function connectCDP(wsEndpoint: string): Promise<any> {
  return await CRI({ target: wsEndpoint });
}

// === STEEL.DEV REST API ===

function steelHeaders(): Record<string, string> {
  return { 'steel-api-key': STEEL_API_KEY, 'Content-Type': 'application/json' };
}

async function steelCreateSession(platform: 'instagram' | 'facebook', options?: { timeout?: number; navigateTo?: string }): Promise<{ id: string; websocketUrl: string; profileId?: string; sessionViewerUrl?: string; connectUrl?: string; _rawData?: any }> {
  var profileKey = platform === 'instagram' ? IG_STEEL_PROFILE_KEY : FB_STEEL_PROFILE_KEY;
  var savedProfileId = await loadSetting(profileKey);
  var body: any = { timeout: options?.timeout || 600000, persistProfile: true };
  if (process.env.STEEL_USE_PROXY === 'true') body.useProxy = true;
  if (platform === 'instagram') body.useProxy = false;
  if (savedProfileId) body.profileId = savedProfileId;
  var res = await fetch(STEEL_API + '/sessions', { method: 'POST', headers: steelHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { var t = await res.text().catch(function() { return ''; }); throw new Error('Steel API ' + res.status + ': ' + t.slice(0, 300)); }
  var data = await res.json();
  var profileId = data.profileId || '';
  if (profileId && profileId !== savedProfileId) await saveSetting(profileKey, profileId);
  // Log ALL fields returned by Steel API for debugging
  var allKeys = Object.keys(data).join(', ');
  console.log('[Steel ' + platform + '] Session:', data.id, 'profile:', profileId, 'fields:', allKeys);
  return {
    id: data.id,
    websocketUrl: data.websocketUrl || '',
    profileId: profileId || undefined,
    sessionViewerUrl: data.sessionViewerUrl,
    connectUrl: (data as any).connectUrl || (data as any).connectUrlV2 || (data as any).interactiveUrl || undefined,
    _rawData: data,
  };
}

async function steelReleaseSession(sessionId: string): Promise<void> {
  try { await fetch(STEEL_API + '/sessions/' + sessionId + '/release', { method: 'POST', headers: steelHeaders() }); } catch(e) {}
}

// === DB HELPERS ===

async function saveSetting(key: string, value: string): Promise<void> {
  try { var db = await getDb(); await db.systemSetting.upsert({ where: { key }, update: { value }, create: { key, value } }); } catch(e) {}
}

async function loadSetting(key: string): Promise<string | null> {
  try { var db = await getDb(); var r = await db.systemSetting.findUnique({ where: { key } }); return r?.value || null; } catch(e) { return null; }
}

// === BROWSER CONNECTION ===

async function connectViaSteel(platform: 'instagram' | 'facebook'): Promise<BrowserSession> {
  if (!STEEL_API_KEY) throw new Error('STEEL_API_KEY nao configurado');
  var session = await steelCreateSession(platform);
  var wsUrl = session.websocketUrl + '&apiKey=' + STEEL_API_KEY;
  var cdp = await connectCDP(wsUrl);
  return {
    cdp, steelSessionId: session.id, viewerUrl: session.sessionViewerUrl,
    cleanup: async function() { try { await cdp.close(); } catch(e) {} try { await steelReleaseSession(session.id); } catch(e) {} },
  };
}

async function connectViaBrowserless(): Promise<BrowserSession> {
  if (!BROWSERLESS_ENDPOINT) throw new Error('Browserless nao configurado');
  var cdp = await connectCDP(BROWSERLESS_ENDPOINT);
  return { cdp, cleanup: async function() { try { await cdp.close(); } catch(e) {} } };
}

async function connectBrowser(platform: 'instagram' | 'facebook'): Promise<BrowserSession> {
  if (STEEL_API_KEY) { try { return await connectViaSteel(platform); } catch (e: any) { console.error('[Steel ' + platform + '] falhou, tentando Browserless:', e.message); } }
  return await connectViaBrowserless();
}

// === CDP HELPERS ===

async function waitForSelector(cdp: any, selector: string, timeoutMs: number = 5000): Promise<number | null> {
  var start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { var doc = await cdp.DOM.getDocument(); var result = await cdp.DOM.querySelectorAll({ nodeId: doc.root.nodeId, selector: selector }); if (result.nodeIds && result.nodeIds.length > 0) return result.nodeIds[0]; } catch(e) {}
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  return null;
}

async function clickElement(cdp: any, selector: string, timeoutMs: number = 3000): Promise<boolean> {
  var nodeId = await waitForSelector(cdp, selector, timeoutMs); if (!nodeId) return false;
  try {
    var box = await cdp.DOM.getBoxModel({ nodeId: nodeId });
    var x = Math.round((box.model.content[0] + box.model.content[2]) / 2);
    var y = Math.round((box.model.content[1] + box.model.content[5]) / 2);
    await cdp.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise(function(r) { setTimeout(r, 50); });
    await cdp.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    return true;
  } catch(e) { return false; }
}

async function fillInput(cdp: any, selector: string, text: string, _timeout?: number): Promise<boolean> {
  var nodeId = await waitForSelector(cdp, selector, _timeout || 3000); if (!nodeId) return false;
  try {
    var box = await cdp.DOM.getBoxModel({ nodeId: nodeId });
    var x = Math.round((box.model.content[0] + box.model.content[2]) / 2);
    var y = Math.round((box.model.content[1] + box.model.content[5]) / 2);
    await cdp.Input.dispatchMouseEvent({ type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await cdp.Input.dispatchMouseEvent({ type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await new Promise(function(r) { setTimeout(r, 200); });
    await cdp.Input.insertText({ text: text });
    return true;
  } catch(e) { return false; }
}

async function evalJS(cdp: any, expr: string): Promise<any> {
  var result = await cdp.Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true });
  return result.result?.value;
}

async function dismissPopups(cdp: any): Promise<void> {
  var selectors = ['[aria-label="Close"]', '[aria-label="Fechar"]', 'button[aria-label="Not Now"]', 'button[aria-label="Agora nao"]', 'div[role="dialog"] button + button', '[class*="_acan"]', '[class*="_aano"]', 'svg[aria-label="Close"]'];
  for (var sel of selectors) { try { await clickElement(cdp, sel, 800); } catch(e) {} }
}

// === LOGIN CHECKS ===

async function isIGLoggedIn(cdp: any): Promise<boolean> {
  try { return await evalJS(cdp, '!!(document.querySelector("nav") || document.querySelector("[role=\"main\"]") || document.querySelector("[data-testid=\"feed-post\"]"))') || await evalJS(cdp, '!!document.querySelector("a[href=\"/direct/\"]")') || await evalJS(cdp, 'document.title.toLowerCase().includes("instagram")'); } catch(e) { return false; }
}

async function isFBLoggedIn(cdp: any): Promise<boolean> {
  try { return await evalJS(cdp, '!!(document.querySelector("[role=\"navigation\"]") || document.querySelector("[data-pagelet=\"LeftRail\"]") || document.querySelector("[aria-label=\"Messenger\"]"))') || await evalJS(cdp, '!!document.querySelector("a[href=\"/messages/\"]")') || await evalJS(cdp, 'document.title.toLowerCase().includes("facebook") && !document.title.includes("Log")'); } catch(e) { return false; }
}

// === INSTAGRAM DM ===

async function sendIGDM(cdp: any, username: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Steel IG] DM para @' + username);
    await cdp.Page.navigate({ url: 'https://www.instagram.com/direct/' });
    await new Promise(function(r) { setTimeout(r, 4000); });
    await dismissPopups(cdp);
    if (!await isIGLoggedIn(cdp)) return { success: false, error: 'Nao esta logado no Instagram. Faz login primeiro.' };

    // Find existing conversation
    var jsFindChat = '(function(){var items=document.querySelectorAll("[role=\"row\"]");for(var i=0;i<items.length;i++){if(items[i].textContent.toLowerCase().includes("' + username.toLowerCase() + '")){items[i].click();return true;}}return false;})()';
    var chatFound = await evalJS(cdp, jsFindChat);

    if (!chatFound) {
      // Try "New message" button
      var newMsgClicked = await clickElement(cdp, 'svg[aria-label="New message"]', 2000) || await clickElement(cdp, 'a[href="/direct/new/"]', 2000);
      if (newMsgClicked) {
        await new Promise(function(r) { setTimeout(r, 1500); });
        await fillInput(cdp, 'input[name="queryBox"], input[aria-label="Search"]', '@' + username);
        await new Promise(function(r) { setTimeout(r, 3000); });
        var jsFindUser = '(function(){var r=document.querySelectorAll("[role=\"option\"]");for(var i=0;i<r.length;i++){if(r[i].textContent.toLowerCase().includes("' + username.toLowerCase() + '")){r[i].click();return true;}}return false;})()';
        var userFound = await evalJS(cdp, jsFindUser);
        if (!userFound) await clickElement(cdp, '[role="option"]', 1500);
        await clickElement(cdp, 'div[role="button"]', 1500);
        await new Promise(function(r) { setTimeout(r, 2000); });
      } else { return { success: false, error: 'Nao consegui abrir nova conversa no IG' }; }
    }

    // Type message
    await new Promise(function(r) { setTimeout(r, 1000); });
    var safeMsg = message.replace(/'/g, "\\'").replace(/\n/g, ' ');
    var jsFillMsg = '(function(){var e=document.querySelector("div[contenteditable=\"true\"]")||document.querySelector("textarea[placeholder]");if(!e)return false;e.focus();document.execCommand("insertText",false,"' + safeMsg + '");return true;})()';
    var inputFilled = await evalJS(cdp, jsFillMsg);
    if (!inputFilled) return { success: false, error: 'Campo de mensagem IG nao encontrado' };

    await new Promise(function(r) { setTimeout(r, 500); });
    await cdp.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(function(r) { setTimeout(r, 50); });
    await cdp.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(function(r) { setTimeout(r, 2000); });
    console.log('[Steel IG] DM enviado para @' + username);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === FACEBOOK DM ===

async function sendFBDM(cdp: any, username: string, message: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Steel FB] DM para ' + username);
    await cdp.Page.navigate({ url: 'https://www.facebook.com/messages/t/' });
    await new Promise(function(r) { setTimeout(r, 4000); });
    await dismissPopups(cdp);
    if (!await isFBLoggedIn(cdp)) return { success: false, error: 'Nao esta logado no Facebook. Faz login primeiro.' };

    // Find existing conversation
    var jsFindChat = '(function(){var rows=document.querySelectorAll("[role=\"row\"]");for(var i=0;i<rows.length;i++){if(rows[i].textContent.toLowerCase().includes("' + username.toLowerCase() + '")){rows[i].click();return true;}}return false;})()';
    var chatFound = await evalJS(cdp, jsFindChat);

    if (!chatFound) {
      var newMsgClicked = await clickElement(cdp, 'a[href="/messages/new/"]', 2000) || await clickElement(cdp, 'div[aria-label="New message"]', 2000);
      if (newMsgClicked) {
        await new Promise(function(r) { setTimeout(r, 1500); });
        await fillInput(cdp, 'input[aria-label="To:"]', username);
        await new Promise(function(r) { setTimeout(r, 3000); });
        var jsFindUser = '(function(){var items=document.querySelectorAll("[role=\"option\"]");for(var i=0;i<items.length;i++){if(items[i].textContent.toLowerCase().includes("' + username.toLowerCase() + '")){items[i].click();return true;}}return false;})()';
        var userFound = await evalJS(cdp, jsFindUser);
        if (!userFound) await clickElement(cdp, '[role="option"]', 1500);
        await new Promise(function(r) { setTimeout(r, 2000); });
      } else { return { success: false, error: 'Nao consegui abrir nova conversa no FB' }; }
    }

    // Type message
    await new Promise(function(r) { setTimeout(r, 1000); });
    var safeMsg = message.replace(/'/g, "\\'").replace(/\n/g, ' ');
    var jsFillMsg = '(function(){var e=document.querySelector("div[contenteditable=\"true\"]")||document.querySelector("[aria-label=\"Message\"]");if(!e)return false;e.focus();document.execCommand("insertText",false,"' + safeMsg + '");return true;})()';
    var inputFilled = await evalJS(cdp, jsFillMsg);
    if (!inputFilled) return { success: false, error: 'Campo de mensagem FB nao encontrado' };

    await new Promise(function(r) { setTimeout(r, 500); });
    await cdp.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(function(r) { setTimeout(r, 50); });
    await cdp.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await new Promise(function(r) { setTimeout(r, 2000); });
    console.log('[Steel FB] DM enviado para ' + username);
    return { success: true };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === PUBLIC API ===

export async function steelIGSendDM(options: { username: string; message: string }): Promise<SocialDMResult> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser('instagram');
    var result = await sendIGDM(session.cdp, options.username, options.message);
    await session.cleanup();
    return result.success ? { success: true, sent: 1, failed: 0, data: { username: options.username, message: options.message, provider: 'steel' } } : { success: false, error: result.error, sent: 0, failed: 1 };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message, sent: 0, failed: 1 }; }
}

export async function steelFBSendDM(options: { username: string; message: string }): Promise<SocialDMResult> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser('facebook');
    var result = await sendFBDM(session.cdp, options.username, options.message);
    await session.cleanup();
    return result.success ? { success: true, sent: 1, failed: 0, data: { username: options.username, message: options.message, provider: 'steel' } } : { success: false, error: result.error, sent: 0, failed: 1 };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message, sent: 0, failed: 1 }; }
}

export async function steelBulkDM(options: { platform: 'instagram' | 'facebook'; users: Array<{ username: string; message?: string }>; defaultMessage?: string; delayBetweenUsers?: number; }): Promise<SocialDMResult> {
  var session: BrowserSession | null = null; var sent = 0, failed = 0, details: any[] = [];
  try {
    session = await connectBrowser(options.platform);
    var sendFn = options.platform === 'instagram' ? sendIGDM : sendFBDM;
    var delay = options.delayBetweenUsers || 5000;
    for (var i = 0; i < options.users.length; i++) {
      var u = options.users[i]; var msg = u.message || options.defaultMessage || '';
      if (!msg) { details.push({ username: u.username, success: false, error: 'Mensagem vazia' }); failed++; continue; }
      var r = await sendFn(session.cdp, u.username, msg);
      details.push({ username: u.username, ...r }); if (r.success) sent++; else failed++;
      if (i < options.users.length - 1) await new Promise(function(res) { setTimeout(res, delay); });
    }
    await session.cleanup(); return { success: sent > 0, sent, failed, details };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message, sent, failed, details }; }
}

// === LOGIN SESSIONS (REST API only — no CDP needed) ===

export async function steelCreateLoginSession(platform: 'instagram' | 'facebook'): Promise<{ success: boolean; viewerUrl?: string; connectUrl?: string; debugUrl?: string; sessionId?: string; error?: string; instructions?: string; _debugFields?: string[] }> {
  try {
    if (!STEEL_API_KEY) return { success: false, error: 'STEEL_API_KEY nao configurado no Railway' };
    // Create session via REST only (no CDP connection — session stays alive on Steel servers)
    var session = await steelCreateSession(platform, { timeout: 900000 }); // 15 min for login
    var viewerUrl = session.sessionViewerUrl;
    var connectUrl = session.connectUrl;
    var debugUrl = (session._rawData as any)?.debugUrl || '';
    var debugFields = session._rawData ? Object.keys(session._rawData) : [];

    // Navigate to login page via Steel REST API (so user sees login form, not blank page)
    var loginUrl = platform === 'instagram' ? 'https://www.instagram.com/accounts/login/' : 'https://www.facebook.com/login/';
    console.log('[Steel ' + platform + '] Navegando para', loginUrl);
    try {
      var navRes = await fetch(STEEL_API + '/sessions/' + session.id + '/actions', {
        method: 'POST',
        headers: steelHeaders(),
        body: JSON.stringify({ action: 'navigate', url: loginUrl }),
      });
      if (navRes.ok) {
        console.log('[Steel ' + platform + '] Navegacao para login OK');
        await new Promise(function(r) { setTimeout(r, 3000); });
      } else {
        console.log('[Steel ' + platform + '] Navegacao falhou:', navRes.status);
      }
    } catch(navErr: any) {
      console.log('[Steel ' + platform + '] Erro ao navegar:', navErr.message);
    }

    // Return ALL available URLs — debugUrl is VNC-based (no login needed), viewerUrl is app.steel.dev (needs Steel account)
    console.log('[Steel ' + platform + '] Login session:', session.id, 'viewer:', !!viewerUrl, 'debug:', !!debugUrl);
    var platformName = platform === 'instagram' ? 'Instagram' : 'Facebook';
    return {
      success: true,
      viewerUrl: viewerUrl || undefined,
      debugUrl: debugUrl || undefined,
      connectUrl: connectUrl || undefined,
      sessionId: session.id,
      _debugFields: debugFields,
      instructions: 'PASSO A PASSO:\n1. Clica no link DEBUG URL abaixo (e nao o viewerUrl)\n2. Vai abrir um navegador controlado na pagina de login do ' + platformName + '\n3. Entra com teu ' + platformName + ' (email/telefone + senha)\n4. Espera o feed carregar completamente\n5. Fecha a aba — PRONTO! A sessao fica salva.\n\nSo precisas fazer isto UMA VEZ. Da proxima vez o Steel ja estara logado.'
    };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === CHECK IF PERSISTED SESSION IS LOGGED IN ===

export async function steelCheckLogin(platform: 'instagram' | 'facebook'): Promise<{ success: boolean; loggedIn?: boolean; error?: string }> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser(platform);
    var targetUrl = platform === 'instagram' ? 'https://www.instagram.com/' : 'https://www.facebook.com/';
    await session.cdp.Page.navigate({ url: targetUrl });
    await new Promise(function(r) { setTimeout(r, 5000); });
    var loggedIn = platform === 'instagram' ? await isIGLoggedIn(session.cdp) : await isFBLoggedIn(session.cdp);
    await session.cleanup();
    return { success: true, loggedIn };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message }; }
}

// === AUTO LOGIN (CDP automates the entire login flow) ===

export async function steelAutoLogin(options: { platform: 'instagram' | 'facebook'; username: string; password: string }): Promise<{ success: boolean; error?: string; viewerUrl?: string; step?: string }> {
  var session: BrowserSession | null = null;
  try {
    if (!STEEL_API_KEY) return { success: false, error: 'STEEL_API_KEY nao configurado', step: 'config' };
    console.log('[Steel AutoLogin] Iniciando login para', options.platform, 'usuario:', options.username);

    // Step 1: Create session with CDP
    session = await connectViaSteel(options.platform);
    var cdp = session.cdp;

    // Step 2: Navigate to login page
    var loginUrl = options.platform === 'instagram'
      ? 'https://www.instagram.com/accounts/login/'
      : 'https://www.facebook.com/login/';
    await cdp.Page.navigate({ url: loginUrl });
    await new Promise(function(r) { setTimeout(r, 5000); });

    // Step 3: Check if already logged in
    if (options.platform === 'instagram' && await isIGLoggedIn(cdp)) {
      console.log('[Steel AutoLogin] Ja esta logado no Instagram!');
      await session.cleanup();
      return { success: true, step: 'already_logged_in' };
    }
    if (options.platform === 'facebook' && await isFBLoggedIn(cdp)) {
      console.log('[Steel AutoLogin] Ja esta logado no Facebook!');
      await session.cleanup();
      return { success: true, step: 'already_logged_in' };
    }

    // Step 4: Fill credentials
    if (options.platform === 'instagram') {
      // Instagram login form
      var userFilled = await fillInput(cdp, 'input[name="username"]', options.username, 5000);
      if (!userFilled) {
        // Try alternate selectors
        userFilled = await fillInput(cdp, 'input[aria-label="Phone number, username, or email"]', options.username, 3000);
      }
      if (!userFilled) return { success: false, error: 'Campo de username nao encontrado na pagina de login', step: 'fill_username', viewerUrl: session.viewerUrl };

      await new Promise(function(r) { setTimeout(r, 800); });

      var passFilled = await fillInput(cdp, 'input[name="password"]', options.password, 5000);
      if (!passFilled) {
        passFilled = await fillInput(cdp, 'input[aria-label="Password"]', options.password, 3000);
      }
      if (!passFilled) return { success: false, error: 'Campo de senha nao encontrado', step: 'fill_password', viewerUrl: session.viewerUrl };

      await new Promise(function(r) { setTimeout(r, 500); });

      // Click login button
      var loginClicked = await clickElement(cdp, 'button[type="submit"]', 3000);
      if (!loginClicked) {
        loginClicked = await clickElement(cdp, 'div[role="button"]', 2000);
      }
      if (!loginClicked) return { success: false, error: 'Botao de login nao encontrado', step: 'click_login', viewerUrl: session.viewerUrl };

    } else {
      // Facebook login form
      var fbUserFilled = await fillInput(cdp, 'input[name="email"]', options.username, 5000);
      if (!fbUserFilled) fbUserFilled = await fillInput(cdp, 'input[id="email"]', options.username, 3000);
      if (!fbUserFilled) return { success: false, error: 'Campo de email nao encontrado no FB', step: 'fill_email', viewerUrl: session.viewerUrl };

      await new Promise(function(r) { setTimeout(r, 800); });

      var fbPassFilled = await fillInput(cdp, 'input[name="pass"]', options.password, 5000);
      if (!fbPassFilled) fbPassFilled = await fillInput(cdp, 'input[id="pass"]', options.password, 3000);
      if (!fbPassFilled) return { success: false, error: 'Campo de senha nao encontrado no FB', step: 'fill_password', viewerUrl: session.viewerUrl };

      await new Promise(function(r) { setTimeout(r, 500); });

      var fbLoginClicked = await clickElement(cdp, 'button[name="login"]', 3000);
      if (!fbLoginClicked) fbLoginClicked = await clickElement(cdp, 'label[id="loginbutton"]', 2000);
      if (!fbLoginClicked) return { success: false, error: 'Botao de login FB nao encontrado', step: 'click_login', viewerUrl: session.viewerUrl };
    }

    // Step 5: Wait for login to complete
    console.log('[Steel AutoLogin] Esperando redirecionamento apos login...');
    await new Promise(function(r) { setTimeout(r, 8000); });

    // Step 6: Dismiss popups (save login info, notifications, etc.)
    await dismissPopups(cdp);
    await new Promise(function(r) { setTimeout(r, 2000); });
    // Dismiss more popups (IG shows multiple)
    await dismissPopups(cdp);
    await new Promise(function(r) { setTimeout(r, 1500); });

    // Try to dismiss "Save Your Login Info?" popup
    try {
      var dismissSave = await evalJS(cdp, '(function(){var btns=document.querySelectorAll("button");for(var i=0;i<btns.length;i++){if(btns[i].textContent.includes("Not Now")||btns[i].textContent.includes("Agora nao")){btns[i].click();return true;}}return false;})()');
      if (dismissSave) { await new Promise(function(r) { setTimeout(r, 2000); }); }
    } catch(e) {}

    // Try to dismiss "Turn on Notifications?" popup
    try {
      var dismissNotif = await evalJS(cdp, '(function(){var btns=document.querySelectorAll("button");for(var i=0;i<btns.length;i++){if(btns[i].textContent.includes("Not Now")||btns[i].textContent.includes("Agora nao")){btns[i].click();return true;}}return false;})()');
      if (dismissNotif) { await new Promise(function(r) { setTimeout(r, 2000); }); }
    } catch(e) {}

    // Step 7: Verify login success
    var loggedIn = options.platform === 'instagram' ? await isIGLoggedIn(cdp) : await isFBLoggedIn(cdp);
    var viewerUrl = session.viewerUrl;
    await session.cleanup();

    if (loggedIn) {
      console.log('[Steel AutoLogin] Login bem sucedido para', options.platform, '!');
      return { success: true, step: 'login_complete' };
    } else {
      // Check for error messages
      var errorMsg = '';
      try {
        errorMsg = await evalJS(cdp, '(function(){var el=document.querySelector("[role="alert"]")||document.querySelector("#slfErrorAlert");return el?el.textContent:"";})()');
      } catch(e) {}
      return { success: false, error: errorMsg || 'Login falhou - verifica credenciais ou tenta pelo viewer URL', step: 'verify_login', viewerUrl };
    }
  } catch (e: any) {
    if (session) { try { await session.cleanup(); } catch(x) {} }
    return { success: false, error: e.message, step: 'exception' };
  }
}

// === GET WS URL (REST only — returns websocket URL for external CDP connection) ===

export async function steelGetWsUrl(platform: 'instagram' | 'facebook', useProxy?: boolean): Promise<{ success: boolean; websocketUrl?: string; sessionId?: string; profileId?: string; viewerUrl?: string; connectUrl?: string; steelApiKey?: string; error?: string }> {
  try {
    if (!STEEL_API_KEY) return { success: false, error: 'STEEL_API_KEY nao configurado' };
    var opts: any = { timeout: 900000 };
    if (useProxy) opts.useProxy = true;
    var session = await steelCreateSession(platform, opts);
    return {
      success: true,
      websocketUrl: session.websocketUrl,
      sessionId: session.id,
      profileId: session.profileId,
      viewerUrl: session.sessionViewerUrl,
      connectUrl: session.connectUrl,
      steelApiKey: STEEL_API_KEY
    };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// === REST-BASED LOGIN (no CDP — uses Steel navigate + screenshot to verify) ===

export async function steelRestLogin(options: { platform: 'instagram' | 'facebook'; username: string; password: string }): Promise<{ success: boolean; error?: string; step?: string; viewerUrl?: string; data?: any }> {
  try {
    if (!STEEL_API_KEY) return { success: false, error: 'STEEL_API_KEY nao configurado', step: 'config' };
    console.log('[Steel RestLogin] Creating session for', options.platform);
    var session = await steelCreateSession(options.platform, { timeout: 900000 });
    var sessionId = session.id;
    var viewerUrl = session.sessionViewerUrl;

    // Navigate to login page
    var loginUrl = options.platform === 'instagram'
      ? 'https://www.instagram.com/accounts/login/'
      : 'https://www.facebook.com/login/';

    console.log('[Steel RestLogin] Navigating to', loginUrl);
    var navRes = await fetch(STEEL_API + '/sessions/' + sessionId + '/actions', {
      method: 'POST',
      headers: steelHeaders(),
      body: JSON.stringify({ action: 'navigate', url: loginUrl })
    });
    if (!navRes.ok) { var t = await navRes.text().catch(function() { return ''; }); throw new Error('Steel navigate failed: ' + navRes.status + ' ' + t.slice(0, 200)); }
    console.log('[Steel RestLogin] Navigation OK, waiting 5s...');
    await new Promise(function(r) { setTimeout(r, 5000); });

    // Take screenshot to see the page
    var ssRes = await fetch(STEEL_API + '/sessions/' + sessionId + '/screenshot', {
      headers: steelHeaders()
    });
    var ssData = await ssRes.json().catch(function() { return {}; });
    console.log('[Steel RestLogin] Screenshot taken:', !!ssData.screenshot);

    // Return with viewer URL so user can manually complete login if needed
    // The REST API doesn't support typing/clicking, so we need the viewer
    return {
      success: true,
      step: 'session_ready',
      viewerUrl: viewerUrl,
      data: { sessionId: sessionId },
    };
  } catch (e: any) {
    return { success: false, error: e.message, step: 'exception' };
  }
}

export async function steelSocialDMStatus(): Promise<any> {
  return { steelConfigured: !!STEEL_API_KEY, browserlessConfigured: !!BROWSERLESS_ENDPOINT, igProfileId: await loadSetting(IG_STEEL_PROFILE_KEY) || undefined, fbProfileId: await loadSetting(FB_STEEL_PROFILE_KEY) || undefined, supportedPlatforms: ['instagram', 'facebook'] };
}

export async function steelClearSessions(platform?: 'instagram' | 'facebook'): Promise<void> {
  try { var keys = platform === 'instagram' ? [IG_STEEL_PROFILE_KEY] : platform === 'facebook' ? [FB_STEEL_PROFILE_KEY] : [IG_STEEL_PROFILE_KEY, FB_STEEL_PROFILE_KEY]; var db = await getDb(); await db.systemSetting.deleteMany({ where: { key: { in: keys } } }); } catch(e) {}
}

export async function steelScreenshot(platform: 'instagram' | 'facebook', url?: string): Promise<{ success: boolean; screenshot?: string; error?: string }> {
  var session: BrowserSession | null = null;
  try {
    session = await connectBrowser(platform);
    var targetUrl = url || (platform === 'instagram' ? 'https://www.instagram.com/direct/' : 'https://www.facebook.com/messages/t/');
    await session.cdp.Page.navigate({ url: targetUrl });
    await new Promise(function(r) { setTimeout(r, 3000); });
    var ss = await session.cdp.Page.screenshot({ format: 'png' });
    await session.cleanup();
    return { success: true, screenshot: Buffer.from(ss.data, 'base64').toString('base64') };
  } catch (e: any) { if (session) await session.cleanup(); return { success: false, error: e.message }; }
}
