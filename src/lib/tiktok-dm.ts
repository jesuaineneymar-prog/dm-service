// ============================================================
//  AURA TIKTOK DM ENGINE — Playwright + Browserless.io
//  Envia DMs no TikTok via automacao de browser remoto.
//  Adaptado de: AliMantach/tiktok-streak-bot
//  Nao usa ManyChat (TikTok Business nao existe em Angola)
// ============================================================

import { BROWSERLESS_ENDPOINT, TIKTOK_USERNAME, TIKTOK_PASSWORD } from './config';

// === TIPOS ===

type Page = any;
type BrowserContext = any;

export interface TikTokDMResult {
  success: boolean;
  error?: string;
  data?: any;
  sent?: number;
  failed?: number;
  details?: any[];
}

const TIKTOK_SESSION_KEY = 'tiktok_dm_session';

interface StoredCookies {
  cookies: any[];
  localStorage: Record<string, string>;
  updatedAt: string;
}

// === DYNAMIC IMPORTS ===
// Playwright-core e db sao importados dinamicamente para evitar
// problemas de bundling no Vercel serverless

async function getChromium() {
  var pw = await import('playwright-core');
  return pw.chromium;
}

async function getDb() {
  var dbModule = await import('./db');
  return dbModule.db;
}

// === SESSAO ===

async function saveSession(context: BrowserContext, page: Page): Promise<void> {
  try {
    var db = await getDb();
    var cookies = await context.cookies();
    var localStorage = await page.evaluate(function() {
      var data: Record<string, string> = {};
      for (var i = 0; i < window.localStorage.length; i++) {
        var key = window.localStorage.key(i);
        if (key) data[key] = window.localStorage.getItem(key) || '';
      }
      return data;
    });
    var sessionJson = JSON.stringify({
      cookies: cookies,
      localStorage: localStorage,
      updatedAt: new Date().toISOString(),
    } as StoredCookies);
    await db.systemSetting.upsert({
      where: { key: TIKTOK_SESSION_KEY },
      update: { value: sessionJson },
      create: { key: TIKTOK_SESSION_KEY, value: sessionJson },
    });
  } catch (e: any) {
    console.error('[TikTok DM] Erro ao guardar sessao:', e.message);
  }
}

async function loadSession(): Promise<StoredCookies | null> {
  try {
    var db = await getDb();
    var row = await db.systemSetting.findUnique({ where: { key: TIKTOK_SESSION_KEY } });
    if (!row || !row.value) return null;
    var parsed = JSON.parse(row.value) as StoredCookies;
    var age = Date.now() - new Date(parsed.updatedAt).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch (e: any) {
    console.error('[TikTok DM] Erro ao carregar sessao:', e.message);
    return null;
  }
}

// === CONEXAO BROWSERLESS ===

async function connectBrowser(): Promise<{ browser: any; context: BrowserContext; page: Page }> {
  if (!BROWSERLESS_ENDPOINT) {
    throw new Error('BROWSERLESS_TOKEN nao configurado');
  }

  var chromium = await getChromium();
  var browser = await chromium.connectOverCDP(BROWSERLESS_ENDPOINT, {
    timeout: 30000,
  });

  var context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'Africa/Luanda',
  });

  var session = await loadSession();
  if (session && session.cookies.length > 0) {
    await context.addCookies(session.cookies);
  }

  var page = await context.newPage();

  if (session && session.localStorage && Object.keys(session.localStorage).length > 0) {
    await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(function() {});
    await page.evaluate(function(ls: Record<string, string>) {
      for (var k in ls) {
        try { window.localStorage.setItem(k, ls[k]); } catch(e) {}
      }
    }, session.localStorage);
  }

  return { browser, context, page };
}

// === HELPERS ===

async function tryClick(page: Page, selectors: string, timeoutMs: number = 3000): Promise<boolean> {
  var parts = selectors.split(',').map(function(s) { return s.trim(); });
  for (var sel of parts) {
    try {
      var el = page.locator(sel).first();
      if (await el.isVisible({ timeout: timeoutMs })) {
        await el.click({ timeout: 2000 });
        return true;
      }
    } catch (e) {}
  }
  return false;
}

async function dismissPopups(page: Page): Promise<void> {
  var dismissSelectors = [
    '[data-e2e="modal-close-inner-button"]',
    '[class*="close"]',
    'button:has-text("Accept all")',
    'button:has-text("Accept")',
    'button:has-text("Got it")',
    'button:has-text("Not now")',
    'button:has-text("Skip")',
    'button:has-text("Fechar")',
    'button:has-text("Entendi")',
    'button:has-text("Recusar")',
    '[aria-label="Close"]',
  ];
  for (var sel of dismissSelectors) {
    try { await tryClick(page, sel, 1000); } catch(e) {}
  }
}

async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    var selectors = [
      '[data-e2e="message-icon"]',
      'a[href*="/messages"]',
      '[data-e2e="topbar-avatar"]',
      'img[src*="avatar"]',
    ];
    for (var sel of selectors) {
      var el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// === LOGIN ===

async function loginToTikTok(page: Page): Promise<boolean> {
  try {
    console.log('[TikTok DM] A tentar login...');

    await page.goto('https://www.tiktok.com/login?lang=en', {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await dismissPopups(page);
    await page.waitForTimeout(2000);

    if (await isLoggedIn(page)) {
      console.log('[TikTok DM] Ja esta logado');
      return true;
    }

    if (TIKTOK_USERNAME && TIKTOK_PASSWORD) {
      console.log('[TikTok DM] A tentar login com email/password...');

      var emailTabClicked = await tryClick(page, '[data-e2e="login-tab-item"]:has-text("Phone"), :text-is("Use phone/email/username")', 3000);
      if (!emailTabClicked) {
        emailTabClicked = await tryClick(page, 'a:has-text("email"), a:has-text("Email"), a:has-text("phone")', 2000);
      }

      if (emailTabClicked) {
        await page.waitForTimeout(1500);
        var emailInput = page.locator('input[type="text"], input[name="email"], input[name="username"]').first();
        await emailInput.fill(TIKTOK_USERNAME);
        await page.waitForTimeout(500);

        var passInput = page.locator('input[type="password"]').first();
        await passInput.fill(TIKTOK_PASSWORD);
        await page.waitForTimeout(500);

        var loginClicked = await tryClick(page, '[data-e2e="login-button"], button:has-text("Log in"), button:has-text("Login")', 3000);
        if (loginClicked) {
          await page.waitForTimeout(4000);
          await dismissPopups(page);

          if (await isLoggedIn(page)) {
            console.log('[TikTok DM] Login com email/password bem-sucedido');
            return true;
          }

          var pageContent = await page.content();
          if (pageContent.includes('verification') || pageContent.includes('captcha') || pageContent.includes('verify')) {
            console.log('[TikTok DM] Verificacao/CAPTCHA detectada - login manual necessario');
            return false;
          }
        }
      }
    }

    console.log('[TikTok DM] Falha no login - verifique credenciais');
    return false;
  } catch (e: any) {
    console.error('[TikTok DM] Erro no login:', e.message);
    return false;
  }
}

// === ENVIAR DM ===

async function sendDMToUser(
  page: Page,
  username: string,
  message: string,
  options?: { isNewConversation?: boolean; delay?: number }
): Promise<{ success: boolean; error?: string }> {
  try {
    var delay = options?.delay || 30;
    console.log('[TikTok DM] A enviar DM para @' + username);

    await page.goto('https://www.tiktok.com/messages', {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await dismissPopups(page);
    await page.waitForTimeout(2000);

    var existingChat = page.locator('[data-e2e="chat-list-item"]:has-text("' + username + '")').first();
    var chatExists = false;
    try {
      chatExists = await existingChat.isVisible({ timeout: 3000 });
    } catch(e) {}

    if (chatExists && !options?.isNewConversation) {
      await existingChat.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    } else {
      var newMsgClicked = await tryClick(page, '[data-e2e="new-message-btn"], button:has-text("New message"), button:has-text("Send a message"), [data-e2e="search-message"]', 3000);

      if (newMsgClicked) {
        await page.waitForTimeout(1000);
        var searchInput = page.locator('input[data-e2e="search-message-input"], input[placeholder*="Search"], input[placeholder*="search"], input[type="text"]').first();
        await searchInput.fill('@' + username);
        await page.waitForTimeout(2000);

        var searchResult = page.locator('[data-e2e="search-result-item"]:has-text("' + username + '"), div[class*="search"]:has-text("' + username + '")').first();
        try {
          if (await searchResult.isVisible({ timeout: 3000 })) {
            await searchResult.click({ timeout: 3000 });
            await page.waitForTimeout(2000);
          } else {
            return { success: false, error: 'Usuario @' + username + ' nao encontrado na pesquisa' };
          }
        } catch(e) {
          return { success: false, error: 'Nao foi possivel encontrar @' + username };
        }
      } else {
        await page.goto('https://www.tiktok.com/@' + username, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await dismissPopups(page);
        await page.waitForTimeout(1500);

        var msgBtnClicked = await tryClick(page, '[data-e2e="profile-message-button"], button:has-text("Message"), a:has-text("Message")', 3000);
        if (!msgBtnClicked) {
          return { success: false, error: 'Botao de mensagem nao encontrado no perfil de @' + username };
        }
        await page.waitForTimeout(2000);
      }
    }

    var inputSelectors = [
      '[data-e2e="message-input"]',
      'div[contenteditable="true"]',
      'div[class*="message"] div[contenteditable]',
      'textarea',
    ];

    var inputFound = false;
    for (var sel of inputSelectors) {
      var input = page.locator(sel).first();
      try {
        if (await input.isVisible({ timeout: 2000 })) {
          await input.click({ timeout: 2000 });
          await page.waitForTimeout(300);
          await page.keyboard.type(message, { delay: delay });
          await page.waitForTimeout(300);
          inputFound = true;
          break;
        }
      } catch(e) {
        continue;
      }
    }

    if (!inputFound) {
      return { success: false, error: 'Campo de input de mensagem nao encontrado' };
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    console.log('[TikTok DM] DM enviado para @' + username);
    return { success: true };
  } catch (e: any) {
    console.error('[TikTok DM] Erro ao enviar DM para @' + username + ':', e.message);
    return { success: false, error: e.message };
  }
}

// === FUNCOES PUBLICAS ===

export async function tiktokSendDM(options: {
  username: string;
  message: string;
  saveSession?: boolean;
}): Promise<TikTokDMResult> {
  var browser: any = null;
  var context: BrowserContext | null = null;

  try {
    var conn = await connectBrowser();
    browser = conn.browser;
    context = conn.context;
    var page = conn.page;

    var loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      loggedIn = await loginToTikTok(page);
      if (!loggedIn) {
        await browser.close().catch(function() {});
        return { success: false, error: 'Nao foi possivel fazer login no TikTok. Configure TIKTOK_USERNAME e TIKTOK_PASSWORD ou faca login manual.' };
      }
    }

    if (context && options.saveSession !== false) {
      await saveSession(context, page);
    }

    var result = await sendDMToUser(page, options.username, options.message);

    if (context) {
      await saveSession(context, page);
    }

    await browser.close().catch(function() {});

    if (result.success) {
      return { success: true, sent: 1, failed: 0, data: { username: options.username, message: options.message } };
    }
    return { success: false, error: result.error, sent: 0, failed: 1 };
  } catch (e: any) {
    if (browser) await browser.close().catch(function() {});
    return { success: false, error: e.message, sent: 0, failed: 1 };
  }
}

export async function tiktokBulkDM(options: {
  users: Array<{ username: string; message?: string }>;
  defaultMessage?: string;
  delayBetweenUsers?: number;
}): Promise<TikTokDMResult> {
  var browser: any = null;
  var context: BrowserContext | null = null;
  var sent = 0;
  var failed = 0;
  var details: any[] = [];

  try {
    var conn = await connectBrowser();
    browser = conn.browser;
    context = conn.context;
    var page = conn.page;

    var loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      loggedIn = await loginToTikTok(page);
      if (!loggedIn) {
        await browser.close().catch(function() {});
        return { success: false, error: 'Nao foi possivel fazer login no TikTok' };
      }
    }

    if (context) await saveSession(context, page);

    var delay = options.delayBetweenUsers || 3000;

    for (var i = 0; i < options.users.length; i++) {
      var user = options.users[i];
      var msg = user.message || options.defaultMessage || '';

      if (!msg) {
        details.push({ username: user.username, success: false, error: 'Mensagem vazia' });
        failed++;
        continue;
      }

      var result = await sendDMToUser(page, user.username, msg, { delay: 30 });
      details.push({ username: user.username, ...result });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      if (i < options.users.length - 1) {
        await page.waitForTimeout(delay);
      }
    }

    if (context) await saveSession(context, page);

    await browser.close().catch(function() {});

    return {
      success: sent > 0,
      sent: sent,
      failed: failed,
      details: details,
    };
  } catch (e: any) {
    if (browser) await browser.close().catch(function() {});
    return { success: false, error: e.message, sent: sent, failed: failed + (options.users.length - sent - failed), details: details };
  }
}

export async function tiktokDMStatus(): Promise<{
  browserlessConfigured: boolean;
  credentialsConfigured: boolean;
  hasSession: boolean;
  sessionAge?: string;
}> {
  var session = null;
  try {
    session = await loadSession();
  } catch(e) {
    // db might not be reachable
  }
  var sessionAge: string | undefined;
  if (session) {
    var age = Date.now() - new Date(session.updatedAt).getTime();
    var hours = Math.floor(age / 3600000);
    sessionAge = hours + 'h';
  }
  return {
    browserlessConfigured: !!BROWSERLESS_ENDPOINT,
    credentialsConfigured: !!(TIKTOK_USERNAME && TIKTOK_PASSWORD),
    hasSession: !!session,
    sessionAge: sessionAge,
  };
}

export async function tiktokLoginAndSave(): Promise<TikTokDMResult> {
  var browser: any = null;
  var context: BrowserContext | null = null;

  try {
    var conn = await connectBrowser();
    browser = conn.browser;
    context = conn.context;
    var page = conn.page;

    await page.goto('https://www.tiktok.com', {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await dismissPopups(page);

    if (await isLoggedIn(page)) {
      await saveSession(context, page);
      await browser.close().catch(function() {});
      return { success: true, data: { message: 'Sessao TikTok valida - cookies atualizados' } };
    }

    var loggedIn = await loginToTikTok(page);
    if (!loggedIn) {
      await browser.close().catch(function() {});
      return { success: false, error: 'Login falhou. Configure TIKTOK_USERNAME/EMAIL e TIKTOK_PASSWORD, ou o login via Google OAuth requer credenciais Google adicionais.' };
    }

    await saveSession(context, page);
    await browser.close().catch(function() {});

    return { success: true, data: { message: 'Login TikTok bem-sucedido e sessao guardada' } };
  } catch (e: any) {
    if (browser) await browser.close().catch(function() {});
    return { success: false, error: e.message };
  }
}

export async function tiktokClearSession(): Promise<void> {
  try {
    var db = await getDb();
    await db.systemSetting.deleteMany({ where: { key: TIKTOK_SESSION_KEY } });
  } catch(e) {}
}

export async function tiktokScreenshot(): Promise<{ success: boolean; screenshot?: string; error?: string }> {
  var browser: any = null;

  try {
    var conn = await connectBrowser();
    browser = conn.browser;
    var page = conn.page;

    await page.goto('https://www.tiktok.com/messages', {
      waitUntil: 'domcontentloaded',
      timeout: 25000,
    });
    await dismissPopups(page);
    await page.waitForTimeout(2000);

    var screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    await browser.close().catch(function() {});

    return { success: true, screenshot: screenshot };
  } catch (e: any) {
    if (browser) await browser.close().catch(function() {});
    return { success: false, error: e.message };
  }
}
