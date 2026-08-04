// ============================================================
//  BRIGHT DATA SCRAPING BROWSER — Puppeteer CDP Connection
//  Cold DMs reais no Instagram e Facebook
//  Browser corre na infra da Bright Data — anti-detect built-in
//  Sessoes persistidas via cookies: env vars (persistente) + /tmp (cache)
//  Keep-alive automatico para manter sessoes frescas
// ============================================================

import puppeteer from 'puppeteer-core';
import { BRIGHT_DATA_WS_ENDPOINT, BRIGHT_DATA_CUSTOMER_ID, BRIGHT_DATA_ZONE, BRIGHT_DATA_ZONE_PASS } from './config';
import * as fs from 'fs';
import * as path from 'path';

// --- Cookie storage ---
var COOKIE_DIR = '/tmp/aura-brightdata-cookies';
var ENV_COOKIE_KEY_IG = 'AURA_IG_COOKIES_B64';
var ENV_COOKIE_KEY_FB = 'AURA_FB_COOKIES_B64';

function cookiePath(platform: string): string {
  return path.join(COOKIE_DIR, platform + '-cookies.json');
}
function ensureCookieDir(): void {
  if (!fs.existsSync(COOKIE_DIR)) fs.mkdirSync(COOKIE_DIR, { recursive: true });
}

// --- Persistent cookie storage (Railway env vars) ---
export function saveCookiesToEnv(platform: 'instagram' | 'facebook', cookies: any[]): string | null {
  try {
    var b64 = Buffer.from(JSON.stringify(cookies)).toString('base64');
    var key = platform === 'instagram' ? ENV_COOKIE_KEY_IG : ENV_COOKIE_KEY_FB;
    process.env[key] = b64;
    // Also save to /tmp as cache
    ensureCookieDir();
    fs.writeFileSync(cookiePath(platform), JSON.stringify(cookies, null, 2));
    console.log('[BrightData] ' + cookies.length + ' cookies salvos no env var ' + key + ' + /tmp cache');
    return b64;
  } catch (e: any) {
    console.log('[BrightData] Erro ao salvar cookies no env: ' + e.message);
    return null;
  }
}

export function loadCookiesFromEnv(platform: 'instagram' | 'facebook'): any[] | null {
  var key = platform === 'instagram' ? ENV_COOKIE_KEY_IG : ENV_COOKIE_KEY_FB;
  // Priority 1: env var (persistent across restarts)
  var b64 = process.env[key];
  if (b64) {
    try {
      var cookies = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
      if (Array.isArray(cookies) && cookies.length > 0) {
        console.log('[BrightData] ' + cookies.length + ' cookies carregados do env var ' + key);
        return cookies;
      }
    } catch (e: any) {
      console.log('[BrightData] Erro ao ler cookies do env var: ' + e.message);
    }
  }
  return null;
}

export function hasPersistentCookies(platform: 'instagram' | 'facebook'): boolean {
  var key = platform === 'instagram' ? ENV_COOKIE_KEY_IG : ENV_COOKIE_KEY_FB;
  return !!process.env[key];
}

// --- Build WSS endpoint ---
// Format: wss://brd-customer-{ID}-zone-{ZONE}:{PASS}@brdsuperproxy.webshare.io:9222
export function buildWSEndpoint(): string {
  var directUrl = BRIGHT_DATA_WS_ENDPOINT;
  if (directUrl) return directUrl;

  // Option 2: Construct from parts
  var cid = BRIGHT_DATA_CUSTOMER_ID;
  var zone = BRIGHT_DATA_ZONE || 'aura';
  var pass = BRIGHT_DATA_ZONE_PASS;

  if (!cid || !pass) {
    // WSS endpoint default ja esta definido em config.ts — isto so acontece se alguem apagar
    console.log('[BrightData] Componentes individuais nao configurados, usando WSS endpoint default');
    // buildWSEndpoint() nunca chega aqui porque BRIGHT_DATA_WS_ENDPOINT tem default
  }

  return 'wss://brd-customer-' + cid + '-zone-' + zone + ':' + pass + '@brd.superproxy.io:9222';
}

// --- Session state ---
var _igBrowser: any = null;
var _igPage: any = null;
var _igLoggedIn: boolean | null = null;
var _fbBrowser: any = null;
var _fbPage: any = null;
var _fbLoggedIn: boolean | null = null;

// --- Smart navigate with retries for Bright Data proxy delays ---
async function smartNavigate(page: any, url: string, label: string): Promise<boolean> {
  var maxRetries = 3;
  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log('[BrightData] ' + label + ' (tentativa ' + attempt + '/' + maxRetries + '): ' + url);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Verify we actually navigated away from about:blank
      var currentUrl = page.url();
      if (currentUrl === 'about:blank' || currentUrl === '') {
        console.log('[BrightData] ' + label + ' — ainda em about:blank apos goto, esperando...');
        await new Promise(function(r) { setTimeout(r, 5000); });
        currentUrl = page.url();
      }
      if (currentUrl !== 'about:blank' && currentUrl !== '') {
        console.log('[BrightData] ' + label + ' — OK: ' + currentUrl);
        return true;
      }
      console.log('[BrightData] ' + label + ' — falhou, tentando novamente...');
      await new Promise(function(r) { setTimeout(r, 3000); });
    } catch (navErr: any) {
      console.log('[BrightData] ' + label + ' — erro: ' + navErr.message + ' (tentativa ' + attempt + ')');
      if (attempt < maxRetries) {
        await new Promise(function(r) { setTimeout(r, 3000); });
      }
    }
  }
  return false;
}

// --- Connect to Bright Data Scraping Browser ---
export async function connectBrowser(platform: 'instagram' | 'facebook'): Promise<{ browser: any; page: any }> {
  var wsEndpoint = buildWSEndpoint();

  console.log('[BrightData] Conectando ao Scraping Browser (' + platform + ')...');
  console.log('[BrightData] WSS: ' + wsEndpoint.replace(/:[^@]*@/, ':***@'));

  var browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: { width: 1280, height: 800 },
  });

  // Reuse existing page or create new one
  var existingPages = await browser.pages();
  var page = existingPages[0];
  if (!page || page.url() === 'about:blank') {
    // Try to create a fresh page
    try {
      page = await browser.newPage();
    } catch (e: any) {
      console.log('[BrightData] newPage falhou, usando pagina existente: ' + e.message);
      page = existingPages[0];
    }
  }
  if (!page) throw new Error('Nenhuma pagina disponivel no browser');

  // Bright Data handles anti-detect — NAO sobrepor user agent, headers, etc.
  await page.setViewport({ width: 1280, height: 800 });

  // Load saved cookies — priority: env var > /tmp file
  ensureCookieDir();
  var cookies = loadCookiesFromEnv(platform);
  if (!cookies) {
    var cPath = cookiePath(platform);
    if (fs.existsSync(cPath)) {
      try {
        var cookieStr = fs.readFileSync(cPath, 'utf8');
        cookies = JSON.parse(cookieStr);
        console.log('[BrightData] Cookies carregados do /tmp cache');
      } catch (e: any) {
        console.log('[BrightData] Erro ao carregar cookies do /tmp: ' + e.message);
      }
    }
  }
  if (Array.isArray(cookies) && cookies.length > 0) {
    // Set cookies one by one — Bright Data blocks some system cookies, skip them silently
    var setOk = 0;
    var setSkipped = 0;
    for (var c of cookies) {
      try {
        await page.setCookie(c);
        setOk++;
      } catch (cookieErr: any) {
        setSkipped++;
        console.log('[BrightData] Cookie ' + (c.name || '?') + ' bloqueado (ignorado): ' + cookieErr.message);
      }
    }
    console.log('[BrightData] ' + setOk + '/' + cookies.length + ' cookies carregados para ' + platform + (setSkipped > 0 ? ' (' + setSkipped + ' bloqueados pela BD)' : ''));
  }

  // Store references
  if (platform === 'instagram') {
    _igBrowser = browser;
    _igPage = page;
  } else {
    _fbBrowser = browser;
    _fbPage = page;
  }

  return { browser, page };
}

// --- Save cookies (both env var + /tmp) ---
export async function saveCookies(page: any, platform: string): Promise<void> {
  try {
    ensureCookieDir();
    var cookies = await page.cookies();
    fs.writeFileSync(cookiePath(platform), JSON.stringify(cookies, null, 2));
    // Also persist in env var
    saveCookiesToEnv(platform as 'instagram' | 'facebook', cookies);
    console.log('[BrightData] ' + cookies.length + ' cookies salvos para ' + platform + ' (env + /tmp)');
  } catch (e: any) {
    console.log('[BrightData] Erro ao salvar cookies: ' + e.message);
  }
}

// --- Detecta se o form de login do IG esta visivel ---
async function detectIGLoginForm(page: any): Promise<boolean> {
  // IG 2025: username field agora usa name="email", password usa name="pass"
  var input = await page.$('input[name="email"], input[name="username"], #login_form').catch(function() { return null; });
  if (input) return true;
  var bodyText = await page.evaluate(function() {
    return document.body ? document.body.innerText : '';
  }).catch(function() { return ''; });
  if (bodyText.includes('Log into Instagram') || bodyText.includes('Log in to Instagram')) return true;
  return false;
}

// --- Check if logged in to Instagram ---
export async function checkIGLogin(page: any): Promise<boolean> {
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(function(r) { setTimeout(r, 6000); }); // wait for React hydration
    if (await detectIGLoginForm(page)) return false;
    // Se nao tem form de login, verificar se tem feed
    var hasFeed = await page.$('main').catch(function() { return null; });
    return !!hasFeed;
  } catch (e: any) {
    console.log('[BrightData] Erro ao verificar login IG: ' + e.message);
    return false;
  }
}

// --- Login to Instagram (homepage tem o form de login — preencher directo) ---
export async function loginInstagram(page: any, username: string, password: string, skipHomepage?: boolean): Promise<boolean> {
  try {
    console.log('[BrightData] Fazendo login no Instagram como ' + username + '...');

    // Step 1: Navegar a instagram.com com retry
    console.log('[BrightData] Step 1: Navegando a instagram.com...');
    var navigated = await smartNavigate(page, 'https://www.instagram.com/', 'IG Homepage');
    if (!navigated) {
      throw new Error('Navegacao falhou — browser ficou em about:blank. Proxy Bright Data pode estar inacessivel.');
    }
    // Esperar React hydration + anti-bot checks
    await new Promise(function(r) { setTimeout(r, 6000); });

    // Step 2: Verificar estado — ja logado?
    var hasForm = !!(await page.$('#login_form').catch(function() { return null; }));
    var hasEmailInput = !!(await page.$('input[name="email"]').catch(function() { return null; }))
                     || !!(await page.$('input[name="username"]').catch(function() { return null; }));
    if (!hasForm && !hasEmailInput) {
      var hasFeed = !!(await page.$('main').catch(function() { return null; }));
      if (hasFeed) {
        console.log('[BrightData] Ja logado!');
        await saveCookies(page, 'instagram');
        _igLoggedIn = true;
        return true;
      }
      // Talvez a pagina ainda esteja a carregar — esperar mais
      console.log('[BrightData] Form de login ainda nao visivel, esperando mais 5s...');
      await new Promise(function(r) { setTimeout(r, 5000); });
      hasForm = !!(await page.$('#login_form').catch(function() { return null; }));
      hasEmailInput = !!(await page.$('input[name="email"]').catch(function() { return null; }))
                       || !!(await page.$('input[name="username"]').catch(function() { return null; }));
    }

    if (!hasForm && !hasEmailInput) {
      var debugUrl2 = page.url();
      var debugText2 = await page.evaluate(function() { return document.body ? document.body.innerText.substring(0, 300) : ''; }).catch(function() { return '' });
      throw new Error('Form de login nao encontrado apos espera. URL: ' + debugUrl2 + ' Text: ' + debugText2);
    }

    // Step 3: Preencher campos
    console.log('[BrightData] Step 3: Preencher credenciais...');
    var usernameInput = await page.$('input[name="username"]') || await page.$('input[name="email"]');
    if (!usernameInput) usernameInput = await page.$('#login_form input[type="text"]');
    if (!usernameInput) throw new Error('Campo de username nao encontrado');

    await usernameInput.click({ clickCount: 3 });
    await new Promise(function(r) { setTimeout(r, 600); });
    await usernameInput.type(username, { delay: 80 + Math.random() * 60 });

    var passwordInput = await page.$('input[name="pass"]') || await page.$('input[name="password"]');
    if (!passwordInput) throw new Error('Campo de password nao encontrado');
    await passwordInput.click({ clickCount: 3 });
    await new Promise(function(r) { setTimeout(r, 400); });
    await passwordInput.type(password, { delay: 60 + Math.random() * 40 });

    // Step 4: Submeter
    console.log('[BrightData] Step 4: Submeter login...');
    var loginBtn = await page.$('input[type="submit"]') || await page.$('button[type="submit"]');
    if (!loginBtn) loginBtn = await page.$('#login_form [type="submit"]');
    if (!loginBtn) loginBtn = await page.$('#login_form button');
    if (!loginBtn) throw new Error('Botao de login nao encontrado');
    await new Promise(function(r) { setTimeout(r, 500); });

    // Tentar clique normal primeiro
    try {
      await loginBtn.click();
    } catch (clickErr: any) {
      console.log('[BrightData] click() falhou, tentando JS submit: ' + clickErr.message);
      // Fallback: submeter via JavaScript
      try {
        await page.evaluate(function() {
          var form = document.querySelector('#login_form') || document.querySelector('form[action*="instagram"]');
          if (form) form.submit();
        });
      } catch (jsErr: any) {
        console.log('[BrightData] JS submit tambem falhou: ' + jsErr.message);
      }
    }

    // Step 5: Esperar resposta
    console.log('[BrightData] Step 5: Aguardando resposta...');
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e: any) {
      console.log('[BrightData] waitForNavigation: ' + e.message + ' — verificando estado manualmente...');
    }
    await new Promise(function(r) { setTimeout(r, 8000); });

    // Step 6: Verificar resultado — NAO usar URL check (IG login page esta em /)
    var finalUrl = page.url();
    console.log('[BrightData] Pos-login URL: ' + finalUrl);
    var pageText = await page.evaluate(function() {
      return document.body ? document.body.innerText.substring(0, 800) : '';
    }).catch(function() { return ''; });

    // Verificar erros conhecidos
    if (pageText.includes('wrong password') || pageText.includes('password was incorrect') || pageText.includes('incorrect password')) throw new Error('Password errada');
    if (pageText.includes('user not found') || pageText.includes('could not find') || pageText.includes('user_does_not_exist')) throw new Error('Utilizador nao encontrado');
    if (pageText.includes('too many') || pageText.includes('try again later') || pageText.includes('try again')) throw new Error('Rate limited');
    if (pageText.includes('suspicious login') || pageText.includes('unusual activity')) throw new Error('Login suspeito');
    if (pageText.includes('verification code') || pageText.includes('enter the code') || pageText.includes('Enter the code')) throw new Error('Codigo de verificacao necessario');
    if (pageText.includes('two-factor') || pageText.includes('2FA') || pageText.includes('Two-Factor')) throw new Error('2FA necessario');
    if (pageText.includes('challenge') || pageText.includes('Suspicious login attempt')) throw new Error('Challenge de seguranca necessario');

    // Verificar se o form de login ainda esta visivel (login falhou)
    var stillHasLoginForm = !!(await page.$('input[name="email"]').catch(function() { return null; }))
                        || !!(await page.$('input[name="username"]').catch(function() { return null; }))
                        || !!(await page.$('#login_form').catch(function() { return null; }));
    var hasFeed = !!(await page.$('main').catch(function() { return null; }));
    var stillShowsLogin = pageText.includes('Log into Instagram') || pageText.includes('Log in to Instagram');

    var loggedIn = (hasFeed || !stillHasLoginForm) && !stillShowsLogin;

    if (!loggedIn) {
      // Verificar se ha uma mensagem de erro especifica do IG
      var errorEl = await page.$('#slfErrorAlert').catch(function() { return null; });
      if (errorEl) {
        var errorText = await page.evaluate(function(el: any) { return el.textContent || ''; }, errorEl);
        if (errorText.trim()) throw new Error('IG erro: ' + errorText.trim());
      }
      throw new Error('Login falhou — form de login ainda visivel apos submissao. Text: ' + pageText.substring(0, 200));
    }

    // Dismiss popups (Save Login Info, Notifications, etc)
    var dismissBtns = await page.$$('button, div[role="button"]');
    for (var btn of dismissBtns) {
      try {
        var txt = await page.evaluate(function(el: any) { return el.textContent || ''; }, btn);
        if (txt && (txt.includes('Not Now') || txt.includes('Agora nao') || txt.includes('Save Info') || txt.includes('Save Login'))) {
          console.log('[BrightData] Clicando: ' + txt.trim());
          await btn.click();
          await new Promise(function(r) { setTimeout(r, 1500); });
        }
      } catch (e) { }
    }

    await saveCookies(page, 'instagram');
    _igLoggedIn = true;
    console.log('[BrightData] Login IG SUCESSO');
    return true;
  } catch (e: any) {
    console.log('[BrightData] Erro login IG: ' + e.message);
    _igLoggedIn = false;
    return false;
  }
}

// --- Check if logged in to Facebook ---
export async function checkFBLogin(page: any): Promise<boolean> {
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(function(r) { setTimeout(r, 3000); });
    var url = page.url();
    if (url.includes('/login')) return false;
    // Check for profile-specific elements
    var hasFeed = await page.$('[role="main"]').catch(function() { return null; });
    return !!hasFeed;
  } catch (e: any) {
    console.log('[BrightData] Erro ao verificar login FB: ' + e.message);
    return false;
  }
}

// --- Login to Facebook (melhorado com retry e debug) ---
export async function loginFacebook(page: any, email: string, password: string): Promise<boolean> {
  try {
    console.log('[BrightData] Fazendo login no Facebook com email/phone: ' + email.substring(0, 5) + '...');

    // Step 1: Ir para homepage primeiro com retry
    console.log('[BrightData] Step 1: Acessar facebook.com...');
    var navigated = await smartNavigate(page, 'https://www.facebook.com/', 'FB Homepage');
    if (!navigated) {
      throw new Error('Navegacao falhou — browser ficou em about:blank. Proxy Bright Data pode estar inacessivel.');
    }
    await new Promise(function(r) { setTimeout(r, 5000); });

    // Ja logado?
    var currentUrl = page.url();
    console.log('[BrightData] FB URL apos navigate: ' + currentUrl);
    if (!currentUrl.includes('/login') && !currentUrl.includes('about:blank')) {
      console.log('[BrightData] Ja parece estar logado! URL: ' + currentUrl);
      await saveCookies(page, 'facebook');
      _fbLoggedIn = true;
      return true;
    }

    // Step 2: Navegar para login (se nao redirecionou)
    console.log('[BrightData] Step 2: Navegando para login...');
    await smartNavigate(page, 'https://www.facebook.com/login/', 'FB Login');
    await new Promise(function(r) { setTimeout(r, 4000); });

    // Step 3: Preencher credenciais com delays humanos
    console.log('[BrightData] Step 3: Preencher credenciais...');
    var emailInput = await page.$('#email');
    if (!emailInput) {
      // Tentar alternativa: pode ser pagina de login mobile
      emailInput = await page.$('input[name="email"]') || await page.$('input[type="text"]:not([name="pass"])');
    }
    if (!emailInput) throw new Error('Campo de email/telefone nao encontrado');
    await emailInput.click({ clickCount: 3 });
    await new Promise(function(r) { setTimeout(r, 600); });
    await emailInput.type(email, { delay: 70 + Math.random() * 50 });

    var passInput = await page.$('#pass') || await page.$('input[name="pass"]');
    if (!passInput) throw new Error('Campo de password nao encontrado');
    await passInput.click({ clickCount: 3 });
    await new Promise(function(r) { setTimeout(r, 400); });
    await passInput.type(password, { delay: 50 + Math.random() * 40 });

    // Step 4: Clicar login
    console.log('[BrightData] Step 4: Clicar login...');
    var loginBtn = await page.$('#loginbutton') || await page.$('button[name="login"]');
    if (!loginBtn) loginBtn = await page.$('label#loginbutton input') || await page.$('#login_form button[type="submit"]');
    if (!loginBtn) throw new Error('Botao de login nao encontrado');
    await new Promise(function(r) { setTimeout(r, 500); });
    await loginBtn.click();

    // Step 5: Esperar resposta
    console.log('[BrightData] Step 5: Aguardando resposta...');
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 });
    } catch (e: any) {
      console.log('[BrightData] waitForNavigation: ' + e.message);
    }
    await new Promise(function(r) { setTimeout(r, 5000); });

    // Step 6: Verificar resultado
    var finalUrl = page.url();
    console.log('[BrightData] Pos-login URL: ' + finalUrl);

    var pageText = await page.evaluate(function() {
      return document.body ? document.body.innerText.substring(0, 500) : '';
    }).catch(function() { return ''; });

    // Erros conhecidos do Facebook
    if (pageText.includes('incorrect password') || pageText.includes('wrong password')) {
      throw new Error('Password errada');
    }
    if (pageText.includes('no account found') || pageText.includes('not found')) {
      throw new Error('Conta nao encontrada');
    }
    if (pageText.includes('two-factor') || pageText.includes('2FA') || pageText.includes('authentication code')) {
      throw new Error('Necessita 2FA — verificacao em duas etapas');
    }
    if (pageText.includes('suspicious') || pageText.includes('unusual activity')) {
      throw new Error('Login suspeito — necessidade de verificacao');
    }
    if (pageText.includes('temporarily locked')) {
      throw new Error('Conta temporariamente bloqueada');
    }

    // Verificar se ficou na pagina de login
    if (finalUrl.includes('/login')) {
      throw new Error('Login falhou — ainda na pagina de login. Texto: ' + pageText.substring(0, 200));
    }

    // Dismiss popups (Save login info, etc)
    var buttons = await page.$$('button');
    for (var btn of buttons) {
      try {
        var txt = await page.evaluate(function(el: any) { return el.textContent; }, btn);
        if (txt && (txt.includes('Not Now') || txt.includes('Agora nao'))) {
          console.log('[BrightData] Clicando em: ' + txt.trim());
          await btn.click();
          await new Promise(function(r) { setTimeout(r, 1500); });
        }
      } catch (e) { /* ignore */ }
    }

    // Save cookies
    await saveCookies(page, 'facebook');

    var loggedIn = !finalUrl.includes('/login');
    _fbLoggedIn = loggedIn;
    console.log('[BrightData] Login FB ' + (loggedIn ? 'SUCESSO' : 'FALHOU'));
    return loggedIn;
  } catch (e: any) {
    console.log('[BrightData] Erro no login FB: ' + e.message);
    _fbLoggedIn = false;
    return false;
  }
}

// --- Get or create IG session (with auto-login) ---
export async function getIGSession(): Promise<{ page: any; loggedIn: boolean }> {
  if (_igPage && _igLoggedIn === true) {
    // Verify session still alive
    try {
      await _igPage.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      var url = _igPage.url();
      if (!url.includes('/accounts/login')) {
        return { page: _igPage, loggedIn: true };
      }
    } catch (e) {
      // Session died, reconnect
    }
  }

  // Fresh connection
  var conn = await connectBrowser('instagram');
  var isLoggedIn = false;

  // Se tem cookies salvos (env var OU /tmp), tentar verificar login rapidamente
  var cPath = cookiePath('instagram');
  var hasEnvCookies = !!loadCookiesFromEnv('instagram');
  var hasFileCookies = fs.existsSync(cPath) && fs.readFileSync(cPath, 'utf8').length > 10;
  if (hasEnvCookies || hasFileCookies) {
    console.log('[BrightData] Cookies existem (env=' + hasEnvCookies + ' file=' + hasFileCookies + '), verificando sessão...');
    isLoggedIn = await checkIGLogin(conn.page);
  }

  if (!isLoggedIn) {
    // Try auto-login if credentials available
    var igUser = process.env.IG_USERNAME || '';
    var igPass = process.env.IG_PASSWORD || '';
    if (igUser && igPass) {
      isLoggedIn = await loginInstagram(conn.page, igUser, igPass);
    }
  }

  _igLoggedIn = isLoggedIn;
  return { page: conn.page, loggedIn: isLoggedIn };
}

// --- Get or create FB session (with auto-login) ---
export async function getFBSession(): Promise<{ page: any; loggedIn: boolean }> {
  if (_fbPage && _fbLoggedIn === true) {
    try {
      await _fbPage.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      var url = _fbPage.url();
      if (!url.includes('/login')) {
        return { page: _fbPage, loggedIn: true };
      }
    } catch (e) {
      // Session died, reconnect
    }
  }

  var conn = await connectBrowser('facebook');
  var isLoggedIn = await checkFBLogin(conn.page);

  if (!isLoggedIn) {
    var fbEmail = process.env.FB_EMAIL || '';
    var fbPass = process.env.FB_PASSWORD || '';
    if (fbEmail && fbPass) {
      isLoggedIn = await loginFacebook(conn.page, fbEmail, fbPass);
    }
  }

  _fbLoggedIn = isLoggedIn;
  return { page: conn.page, loggedIn: isLoggedIn };
}

// --- Cleanup: close browser connections ---
export async function cleanup(platform?: string): Promise<void> {
  try {
    if (!platform || platform === 'instagram') {
      if (_igBrowser) { await _igBrowser.close().catch(function() {}); }
      _igBrowser = null;
      _igPage = null;
      _igLoggedIn = null;
    }
    if (!platform || platform === 'facebook') {
      if (_fbBrowser) { await _fbBrowser.close().catch(function() {}); }
      _fbBrowser = null;
      _fbPage = null;
      _fbLoggedIn = null;
    }
  } catch (e: any) {
    console.log('[BrightData] Erro no cleanup: ' + e.message);
  }
}

// --- Keep-alive: ping platform to keep session fresh ---
export async function keepAlive(platform: 'instagram' | 'facebook'): Promise<{ alive: boolean; url: string; error?: string }> {
  try {
    var cookies = loadCookiesFromEnv(platform);
    if (!cookies) {
      // Check /tmp fallback
      var cPath = cookiePath(platform);
      if (!fs.existsSync(cPath)) {
        return { alive: false, url: '', error: 'Sem cookies salvos para ' + platform };
      }
    }
    console.log('[BrightData] Keep-alive para ' + platform + '...');
    var conn = await connectBrowser(platform);
    var page = conn.page;
    var url = platform === 'instagram' ? 'https://www.instagram.com/' : 'https://www.facebook.com/';
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(function(r) { setTimeout(r, 4000); });
    var currentUrl = page.url();
    var isAlive = platform === 'instagram'
      ? !currentUrl.includes('/accounts/login')
      : !currentUrl.includes('/login');
    if (isAlive) {
      // Refresh cookies after successful ping
      await saveCookies(page, platform);
      // Mark session as active so getIGSession/getFBSession reuse it
      if (platform === 'instagram') { _igLoggedIn = true; _igPage = page; }
      else { _fbLoggedIn = true; _fbPage = page; }
      console.log('[BrightData] Keep-alive ' + platform + ': SESSAO VIVA (cookies refreshidos, sessao marcada activa)');
    } else {
      console.log('[BrightData] Keep-alive ' + platform + ': SESSAO EXPIRADA (redirect para login)');
    }
    return { alive: isAlive, url: currentUrl };
  } catch (e: any) {
    return { alive: false, url: '', error: e.message };
  }
}

// --- Import cookies from user (raw JSON array) ---
export async function importCookies(platform: 'instagram' | 'facebook', cookiesJson: any[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!Array.isArray(cookiesJson) || cookiesJson.length === 0) {
    return { success: false, count: 0, error: 'Cookies invalidos — esperado array JSON' };
  }
  // Filter to only relevant domains
  var domains = platform === 'instagram'
    ? ['.instagram.com', 'instagram.com', '.i.instagram.com', '.cdninstagram.com']
    : ['.facebook.com', 'facebook.com', '.m.facebook.com', '.fbcdn.net'];
  var filtered = cookiesJson.filter(function(c: any) {
    return domains.some(function(d) { return (c.domain || '').includes(d.replace('.', '')); });
  });
  var toSave = filtered.length > 0 ? filtered : cookiesJson; // use all if filter removes everything
  // Save to env var + /tmp
  var b64 = saveCookiesToEnv(platform, toSave);
  if (!b64) {
    return { success: false, count: 0, error: 'Falha ao guardar cookies' };
  }
  // Just save — verification happens via keep_alive or next send
  // (browser verification here causes issues with BrightData blocked cookies)
  return { success: true, count: toSave.length, saved: true, message: toSave.length + ' cookies guardados (env + /tmp). Usa keep_alive ou ai_send_ig para verificar.' };
}

// --- Status check ---
export function getStatus(): {
  configured: boolean;
  token_set: boolean;
  customer_id_set: boolean;
  zone_set: boolean;
  ws_endpoint_set: boolean;
  ig_session: boolean | null;
  fb_session: boolean | null;
  cookies_ig: boolean;
  cookies_fb: boolean;
  ig_cookies_persistent: boolean;
  fb_cookies_persistent: boolean;
  ig_username: string;
  fb_email: string;
} {
  ensureCookieDir();
  return {
    configured: !!BRIGHT_DATA_WS_ENDPOINT || !!(BRIGHT_DATA_CUSTOMER_ID && BRIGHT_DATA_ZONE_PASS),
    ws_endpoint_set: !!BRIGHT_DATA_WS_ENDPOINT,
    customer_id_set: !!BRIGHT_DATA_CUSTOMER_ID,
    zone_set: !!BRIGHT_DATA_ZONE,
    ig_session: _igLoggedIn,
    fb_session: _fbLoggedIn,
    cookies_ig: fs.existsSync(cookiePath('instagram')),
    cookies_fb: fs.existsSync(cookiePath('facebook')),
    ig_cookies_persistent: hasPersistentCookies('instagram'),
    fb_cookies_persistent: hasPersistentCookies('facebook'),
    ig_username: process.env.IG_USERNAME ? '***' + process.env.IG_USERNAME.slice(-3) : 'not set',
    fb_email: process.env.FB_EMAIL ? '***' + process.env.FB_EMAIL.slice(-3) : 'not set',
  };
}
