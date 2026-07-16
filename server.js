// ============================================
// MBA Brain - Playwright DM Service v3
// Local Deploy - IG + FB + TikTok
// Capsolver CAPTCHA Integration
// ============================================

const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json({ limit: '2mb' }));

const API_KEY = process.env.API_KEY || 'mba-brain-2024';
const PORT = process.env.PORT || 3000;

// --- Capsolver Config ---
const CAPSOLVER_KEY = process.env.CAPSOLVER_KEY || 'CAP-F1411C5C0F2E91FBAE262ED46E4332BEFEB3DABD60C2A69A707535925B0791D0';

// --- State ---
let browserNoProxy = null;
let browserWithProxy = null;
let browserLockNP = false;
let browserLockWP = false;

// Sessions (NO cookie caching - fresh login every DM)
let sessions = {
  ig: { cookies: null, loggedIn: false, dsUserId: null, igD: null, csrftoken: null, sessionId: null, expiresAt: 0 },
  fb: { cookies: null, loggedIn: false, userId: null, dtsg: null, expiresAt: 0 },
  tt: { cookies: null, loggedIn: false, expiresAt: 0 }
};

// Pending IG 2FA context
let ig2FA = {
  active: false,
  context: null,
  page: null,
  createdAt: 0
};

// --- Credentials ---
const CREDS = {
  ig: { user: process.env.IG_USER || 'jesuainecristiano78', pass: process.env.IG_PASS || '9adJpLRGPX#YGx$', email: process.env.IG_EMAIL || '' },
  fb: { email: process.env.FB_EMAIL || '+244925049405', pass: process.env.FB_PASS || 'Jesus888#' },
  tt: { user: process.env.TT_USER || 'batmanjustice5', pass: process.env.TT_PASS || 'Jesus888$' }
};

// --- Proxy config ---
// Set PROXY_HOST + PROXY_PORT env vars to enable proxy (e.g. Angola proxy when running locally)
// On Railway: leave empty = no proxy, Capsolver handles CAPTCHAs
const PROXY_HOST = process.env.PROXY_HOST || '';
const PROXY_PORT = process.env.PROXY_PORT || '';

function getProxyAddress() {
  if (PROXY_HOST && PROXY_PORT) return PROXY_HOST + ':' + PROXY_PORT;
  return null;
}

// --- Helpers ---
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'] || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!key || key !== API_KEY) {
    return res.status(401).json({ success: false, error: 'API key invalida' });
  }
  next();
}

// Cleanup expired 2FA contexts
function cleanup2FA() {
  if (ig2FA.active && Date.now() - ig2FA.createdAt > 300000) {
    console.log('[IG] 2FA context expired, cleaning up');
    close2FAContext();
  }
}

async function close2FAContext() {
  if (ig2FA.page) {
    try { await ig2FA.page.close(); } catch(e) {}
    ig2FA.page = null;
  }
  if (ig2FA.context) {
    try { await ig2FA.context.close(); } catch(e) {}
    ig2FA.context = null;
  }
  ig2FA.active = false;
}

// --- Stealth injection script ---
const STEALTH_JS = `() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  delete navigator.__proto__.webdriver;
  window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
  const origQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (p) =>
    p.name === 'notifications' ? Promise.resolve({ state: Notification.permission }) : origQuery(p);
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const p = Object.create(PluginArray.prototype);
      const chrome = Object.create(Plugin.prototype);
      chrome.name = 'Chrome PDF Plugin'; chrome.filename = 'internal-pdf-viewer'; chrome.description = 'Portable Document Format'; chrome.length = 1;
      Object.defineProperty(chrome, 0, { get: () => Object.create(MimeType.prototype) });
      const widevine = Object.create(Plugin.prototype);
      widevine.name = 'Widevine Content Decryption Module'; widevine.filename = 'widevinecdm.dll'; widevine.description = 'Enables Widevine licenses for playback of HTML audio/video content.'; widevine.length = 1;
      Object.defineProperty(widevine, 0, { get: () => Object.create(MimeType.prototype) });
      Object.defineProperty(p, 0, { get: () => chrome });
      Object.defineProperty(p, 1, { get: () => widevine });
      Object.defineProperty(p, 'length', { get: () => 2 });
      return p;
    }
  });
  Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
  Object.defineProperty(navigator, 'platform', { get: () => 'Linux armv81' });
  Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 });
  Object.defineProperty(navigator, 'connection', {
    get: () => ({
      effectiveType: '4g', rtt: 50, downlink: 10, saveData: false,
      addEventListener: () => {}, removeEventListener: () => {}
    })
  });
  Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
  const getParam = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 37445) return 'ARM';
    if (param === 37446) return 'ARM';
    return getParam.call(this, param);
  };
  const getParam2 = WebGL2RenderingContext.prototype.getParameter;
  if (getParam2) {
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      if (param === 37445) return 'ARM';
      if (param === 37446) return 'ARM';
      return getParam2.call(this, param);
    };
  }
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type) {
    if (type === 'image/png' || type === undefined) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const style = ctx.fillStyle;
        ctx.fillStyle = 'rgba(0,0,1,0.003)';
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = style;
      }
    }
    return origToDataURL.apply(this, arguments);
  };
  const origGetter = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow');
  HTMLIFrameElement.prototype.__defineGetter__('contentWindow', function() {
    const w = origGetter.call(this);
    if (w) {
      try { Object.defineProperty(w.navigator, 'webdriver', { get: () => false }); } catch(e) {}
    }
    return w;
  });
  document.$cdc_asdjflasutopfhvcZLmcfl_ = undefined;
  window.cdc_adoQpoasnfa76pfcZLmcfl_Array = undefined;
}`;

// ============================================
// CAPSOLVER CAPTCHA SOLVING
// ============================================

async function createCapsolverTask(task) {
  const resp = await fetch('https://api.capsolver.com/createTask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientKey: CAPSOLVER_KEY, task })
  });
  const data = await resp.json();
  if (data.errorId) {
    throw new Error('Capsolver createTask error: ' + (data.errorDescription || data.errorCode));
  }
  return data.taskId;
}

async function getCapsolverResult(taskId, maxWait = 120) {
  const start = Date.now();
  while (Date.now() - start < maxWait * 1000) {
    await sleep(3000);
    const resp = await fetch('https://api.capsolver.com/getTaskResult', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientKey: CAPSOLVER_KEY, taskId })
    });
    const data = await resp.json();
    if (data.status === 'ready') return data.solution;
    if (data.errorId) throw new Error('Capsolver error: ' + (data.errorDescription || data.errorCode));
    console.log('[Capsolver] Waiting... status:', data.status);
  }
  throw new Error('Capsolver timeout after ' + maxWait + 's');
}

async function solveCaptcha(page) {
  const pageUrl = page.url();
  console.log('[Capsolver] Detecting CAPTCHA on:', pageUrl);

  // Detect CAPTCHA type
  const captchaInfo = await page.evaluate(() => {
    // reCAPTCHA v2
    const rc2Frames = document.querySelectorAll('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"]');
    if (rc2Frames.length > 0) {
      let sitekey = '';
      for (const f of rc2Frames) {
        const m = f.src.match(/k=([^&]+)/);
        if (m) { sitekey = m[1]; break; }
      }
      if (!sitekey) {
        const rcScript = document.querySelector('script[src*="recaptcha"]');
        if (rcScript) {
          const m = rcScript.src.match(/render=([^&]+)/);
          if (m) sitekey = m[1];
        }
      }
      if (!sitekey) {
        // Check for data-sitekey attribute
        const el = document.querySelector('[data-sitekey]');
        if (el) sitekey = el.getAttribute('data-sitekey');
      }
      return { type: 'recaptcha_v2', sitekey, found: true };
    }

    // reCAPTCHA v3 (invisible, check for grecaptcha in window)
    if (window.grecaptcha) {
      let sitekey = '';
      const el = document.querySelector('[data-sitekey]');
      if (el) sitekey = el.getAttribute('data-sitekey');
      if (!sitekey) {
        const rcScript = document.querySelector('script[src*="recaptcha/api.js"]');
        if (rcScript) {
          const m = rcScript.src.match(/render=([^&]+)/);
          if (m) sitekey = m[1];
        }
      }
      return { type: 'recaptcha_v3', sitekey, found: true };
    }

    // hCaptcha
    const hcFrames = document.querySelectorAll('iframe[src*="hcaptcha"], iframe[title*="hCaptcha"]');
    if (hcFrames.length > 0) {
      let sitekey = '';
      const el = document.querySelector('[data-sitekey]');
      if (el) sitekey = el.getAttribute('data-sitekey');
      for (const f of hcFrames) {
        const m = f.src.match(/sitekey=([^&]+)/);
        if (m) { sitekey = m[1]; break; }
      }
      return { type: 'hcaptcha', sitekey, found: true };
    }

    // Arkose Labs / FunCaptcha (Facebook uses this)
    const arkoseFrames = document.querySelectorAll('iframe[src*="arkose"], iframe[src*="funcaptcha"], iframe[id*="fc-token"], iframe[src*="arkoselabs"]');
    if (arkoseFrames.length > 0) {
      let publicKey = '';
      for (const f of arkoseFrames) {
        const m = f.src.match(/pk=([^&]+)/);
        if (m) { publicKey = m[1]; break; }
      }
      // Also check for arkose scripts
      if (!publicKey) {
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
          const m = s.textContent.match(/["']([\w-]{20,})["'].*?Arkose|publicKey\s*[:=]\s*["']([\w-]+)["']/);
          if (m) { publicKey = m[1] || m[2]; break; }
        }
      }
      return { type: 'arkose', sitekey: publicKey, found: true };
    }

    // Cloudflare Turnstile
    const turnstileDiv = document.querySelector('[data-turnstile-sitekey], .cf-turnstile, #cf-turnstile');
    if (turnstileDiv) {
      const sitekey = turnstileDiv.getAttribute('data-sitekey') || '';
      return { type: 'turnstile', sitekey, found: true };
    }
    const turnstileFrame = document.querySelector('iframe[src*="challenges.cloudflare.com"]');
    if (turnstileFrame) {
      return { type: 'turnstile', sitekey: '', found: true };
    }

    // Generic: any iframe with captcha in src
    const anyCaptchaFrame = document.querySelector('iframe[src*="captcha" i], iframe[src*="challenge" i]');
    if (anyCaptchaFrame) {
      return { type: 'unknown_iframe', found: true, src: anyCaptchaFrame.src.substring(0, 200) };
    }

    return { found: false };
  });

  console.log('[Capsolver] Detection result:', JSON.stringify(captchaInfo));

  if (!captchaInfo.found) {
    console.log('[Capsolver] No CAPTCHA detected');
    return null;
  }

  const siteUrl = pageUrl;

  try {
    let solution = null;

    switch (captchaInfo.type) {
      case 'recaptcha_v2': {
        if (!captchaInfo.sitekey) { console.log('[Capsolver] No sitekey for reCAPTCHA v2'); return null; }
        console.log('[Capsolver] Solving reCAPTCHA v2, sitekey:', captchaInfo.sitekey);
        const taskId = await createCapsolverTask({
          type: 'ReCaptchaV2TaskProxyLess',
          websiteURL: siteUrl,
          websiteKey: captchaInfo.sitekey
        });
        solution = await getCapsolverResult(taskId);
        if (solution && solution.gRecaptchaResponse) {
          await page.evaluate((token) => {
            const ta = document.getElementById('g-recaptcha-response');
            if (ta) { ta.value = token; ta.innerHTML = token; }
            const ta2 = document.querySelector('textarea[name="g-recaptcha-response"]');
            if (ta2) { ta2.value = token; ta2.innerHTML = token; }
            // Callback
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
              for (const c of Object.values(window.___grecaptcha_cfg.clients)) {
                if (c && c[j]) {
                  try { c[j].callback(token); } catch(e) {}
                }
              }
            }
          }, solution.gRecaptchaResponse);
          console.log('[Capsolver] reCAPTCHA v2 token injected');
        }
        break;
      }

      case 'recaptcha_v3': {
        if (!captchaInfo.sitekey) { console.log('[Capsolver] No sitekey for reCAPTCHA v3'); return null; }
        console.log('[Capsolver] Solving reCAPTCHA v3, sitekey:', captchaInfo.sitekey);
        const taskId = await createCapsolverTask({
          type: 'ReCaptchaV3TaskProxyLess',
          websiteURL: siteUrl,
          websiteKey: captchaInfo.sitekey,
          pageAction: 'submit'
        });
        solution = await getCapsolverResult(taskId);
        if (solution && solution.gRecaptchaResponse) {
          await page.evaluate((token) => {
            const ta = document.getElementById('g-recaptcha-response');
            if (ta) { ta.value = token; ta.innerHTML = token; }
            if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
              for (const c of Object.values(window.___grecaptcha_cfg.clients)) {
                if (c && c[j]) {
                  try { c[j].callback(token); } catch(e) {}
                }
              }
            }
          }, solution.gRecaptchaResponse);
          console.log('[Capsolver] reCAPTCHA v3 token injected');
        }
        break;
      }

      case 'hcaptcha': {
        if (!captchaInfo.sitekey) { console.log('[Capsolver] No sitekey for hCaptcha'); return null; }
        console.log('[Capsolver] Solving hCaptcha, sitekey:', captchaInfo.sitekey);
        const taskId = await createCapsolverTask({
          type: 'HCaptchaTaskProxyLess',
          websiteURL: siteUrl,
          websiteKey: captchaInfo.sitekey
        });
        solution = await getCapsolverResult(taskId);
        if (solution && solution.gRecaptchaResponse) {
          await page.evaluate((token) => {
            const ta = document.querySelector('textarea[name="h-captcha-response"]');
            if (ta) { ta.value = token; ta.innerHTML = token; }
            const ta2 = document.getElementById('h-captcha-response');
            if (ta2) { ta2.value = token; ta2.innerHTML = token; }
            if (window.hcaptcha) {
              try { window.hcaptcha.setResponse(token); } catch(e) {}
            }
          }, solution.gRecaptchaResponse);
          console.log('[Capsolver] hCaptcha token injected');
        }
        break;
      }

      case 'arkose': {
        if (!captchaInfo.sitekey) { console.log('[Capsolver] No publickey for Arkose'); return null; }
        console.log('[Capsolver] Solving Arkose/FunCaptcha, pk:', captchaInfo.sitekey);
        const taskId = await createCapsolverTask({
          type: 'FunCaptchaTaskProxyLess',
          websiteURL: siteUrl,
          websitePublicKey: captchaInfo.sitekey,
          funcaptchaApiJSSubdomain: ''
        });
        solution = await getCapsolverResult(taskId);
        if (solution && solution.token) {
          await page.evaluate((token) => {
            const input = document.getElementById('arkose_token') || document.querySelector('input[name="arkoseToken"]') || document.querySelector('input[name="captcha_token"]');
            if (input) { input.value = token; }
            // Also try setting via callback
            if (window.onArkoseSolved) {
              try { window.onArkoseSolved(token); } catch(e) {}
            }
          }, solution.token);
          console.log('[Capsolver] Arkose token injected');
        }
        break;
      }

      case 'turnstile': {
        console.log('[Capsolver] Solving Cloudflare Turnstile');
        const sitekey = captchaInfo.sitekey || '0x4AAAAAAAxkJ4QnHJYBPnHl'; // common default
        const taskId = await createCapsolverTask({
          type: 'AntiTurnstileTaskProxyLess',
          websiteURL: siteUrl,
          websiteKey: sitekey,
          metadata: { action: '' }
        });
        solution = await getCapsolverResult(taskId);
        if (solution && solution.token) {
          await page.evaluate((token) => {
            const input = document.querySelector('input[name="cf-turnstile-response"]') || document.querySelector('[name="ct_turnstile_token"]');
            if (input) { input.value = token; }
            const ta = document.getElementById('cf-turnstile-response');
            if (ta) { ta.value = token; }
            // Callback
            if (window.turnstile) {
              try { window.turnstileCallback(token); } catch(e) {}
            }
          }, solution.token);
          console.log('[Capsolver] Turnstile token injected');
        }
        break;
      }

      default:
        console.log('[Capsolver] Unknown CAPTCHA type, cannot solve');
        return null;
    }

    return solution;
  } catch (err) {
    console.error('[Capsolver] Solve error:', err.message);
    return null;
  }
}

// Helper: check for CAPTCHA, solve it, then click submit
async function checkAndSolveCaptcha(page, submitSelector) {
  console.log('[Capsolver] Checking for CAPTCHA...');
  const screenshot1 = await page.screenshot({ encoding: 'base64', fullPage: false }).catch(() => '');

  const solution = await solveCaptcha(page);
  if (solution) {
    console.log('[Capsolver] CAPTCHA solved! Clicking submit:', submitSelector);
    await sleep(1000);
    // Click the submit button after solving
    try {
      const btn = page.locator(submitSelector).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        await sleep(5000);
        return { solved: true, solution };
      }
    } catch(e) {
      console.log('[Capsolver] Submit click error:', e.message.substring(0, 80));
    }
    // Try pressing Enter as fallback
    await page.keyboard.press('Enter').catch(() => {});
    await sleep(5000);
    return { solved: true, solution };
  }
  return { solved: false, screenshot: screenshot1 };
}

// ============================================
// BROWSER MANAGEMENT (Dual: with/without proxy)
// ============================================

async function getBrowser(useProxy = false) {
  if (useProxy) {
    if (browserWithProxy && browserWithProxy.isConnected()) return browserWithProxy;
    if (browserLockWP) {
      for (let i = 0; i < 30; i++) { await sleep(1000); if (browserWithProxy && browserWithProxy.isConnected()) return browserWithProxy; }
    }
    browserLockWP = true;
    try {
      const proxyAddr = getProxyAddress();
      console.log('[Browser] Launching Chromium WITH proxy:', proxyAddr);
      const launchArgs = [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-infobars',
        '--window-size=393,851', '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ];
      if (proxyAddr) launchArgs.push('--proxy-server=http://' + proxyAddr);
      browserWithProxy = await chromium.launch({
        headless: true,
        args: launchArgs,
        ignoreDefaultArgs: ['--enable-automation']
      });
      console.log('[Browser] Chromium OK (proxy: ' + proxyAddr + ')');
      return browserWithProxy;
    } finally { browserLockWP = false; }
  } else {
    if (browserNoProxy && browserNoProxy.isConnected()) return browserNoProxy;
    if (browserLockNP) {
      for (let i = 0; i < 30; i++) { await sleep(1000); if (browserNoProxy && browserNoProxy.isConnected()) return browserNoProxy; }
    }
    browserLockNP = true;
    try {
      console.log('[Browser] Launching Chromium (no proxy)...');
      const launchArgs = [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-infobars',
        '--window-size=393,851', '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process'
      ];
      browserNoProxy = await chromium.launch({
        headless: true,
        args: launchArgs,
        ignoreDefaultArgs: ['--enable-automation']
      });
      console.log('[Browser] Chromium OK (no proxy)');
      return browserNoProxy;
    } finally { browserLockNP = false; }
  }
}

function createContext(mobile = false, useProxy = false) {
  const ctxOpts = mobile ? {
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'Africa/Luanda',
    isMobile: true,
    hasTouch: true,
    bypassCSP: true,
    timeout: 60000,
    screen: { width: 393, height: 851, deviceScaleFactor: 3 }
  } : {
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'Africa/Luanda',
    bypassCSP: true,
    timeout: 60000
  };
  return (useProxy ? browserWithProxy : browserNoProxy).newContext(ctxOpts);
}

// ============================================
// INSTAGRAM LOGIN + 2FA + CAPTCHA
// ============================================

async function igLogin() {
  if (sessions.ig.loggedIn && sessions.ig.cookies && Date.now() < sessions.ig.expiresAt) {
    console.log('[IG] Using cached session');
    return { success: true, cached: true, sessionId: sessions.ig.sessionId };
  }
  return igLoginInternal();
}

async function igLoginInternal() {
  await close2FAContext();

  console.log('[IG] Starting mobile browser login...', CREDS.ig.user);
  const useProxy = !!getProxyAddress();
  const br = await getBrowser(useProxy);
  const ctx = await createContext(true, useProxy);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  try {
    // Visit homepage first
    try {
      await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3000 + Math.random() * 2000);
    } catch(e) {
      console.log('[IG] Homepage nav timeout (continuing):', e.message.substring(0, 80));
    }

    // Go to login page
    try {
      await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch(e) {
      console.log('[IG] Navigation timeout (continuing):', e.message.substring(0, 80));
    }
    await sleep(4000 + Math.random() * 3000);

    const debugUrl = page.url();
    const debugTitle = await page.title().catch(() => '');
    console.log('[IG] Page URL:', debugUrl, 'Title:', debugTitle);

    // Check if already logged in
    if (!debugUrl.includes('/accounts/login')) {
      console.log('[IG] Already logged in!');
      const cookies = await ctx.cookies();
      await saveIGSession(cookies);
      await ctx.close();
      return { success: true, cached: false };
    }

    // Find username input
    let userSel = null;
    const userSelectors = [
      'input[name="username"]',
      'input[name="email"]',
      'input[aria-label="Número de celular, nome de usuário ou email"]',
      'input[aria-label="Phone number, username, or email"]',
      'input[autocomplete="username"]'
    ];
    for (const sel of userSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000, state: 'visible' });
        userSel = sel;
        console.log('[IG] Found username input:', sel);
        break;
      } catch(e) { continue; }
    }

    if (!userSel) {
      const errSs = await page.screenshot({ encoding: 'base64', fullPage: false });
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || 'empty');
      await ctx.close();
      return {
        success: false,
        error: 'Campo de login nao encontrado.',
        url: debugUrl, title: debugTitle, bodyPreview: bodyText, screenshot: errSs
      };
    }

    // Fill username
    console.log('[IG] Filling username:', CREDS.ig.user);
    try {
      await page.fill(userSel, CREDS.ig.user);
    } catch(e) {
      const el = await page.$(userSel);
      await el.click();
      await el.type(CREDS.ig.user, { delay: 50 });
    }
    await sleep(500 + Math.random() * 500);

    // Find and fill password
    const passSelectors = ['input[name="password"]', 'input[name="pass"]', 'input[type="password"]', 'input[aria-label="Senha"]', 'input[aria-label="Password"]'];
    let passSel = null;
    for (const sel of passSelectors) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) { passSel = sel; break; }
      } catch(e) { continue; }
    }
    if (!passSel) { await page.keyboard.press('Tab'); await sleep(300); passSel = 'input:focus'; }

    if (passSel) {
      console.log('[IG] Filling password...');
      const el = await page.$(passSel);
      if (el) { await el.click(); await sleep(300); await el.type(CREDS.ig.pass, { delay: 30 }); }
    }

    await sleep(800 + Math.random() * 500);

    // Submit
    console.log('[IG] Submitting login...');
    let submitted = false;
    try {
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitBtn.click(); submitted = true; console.log('[IG] Clicked submit button');
      }
    } catch(e) {}
    if (!submitted) {
      try { await page.click('text=Entrar', { timeout: 3000 }); submitted = true; } catch(e) {}
    }
    if (!submitted) {
      try { await page.click('text=Log in', { timeout: 2000 }); submitted = true; } catch(e) {}
    }
    if (!submitted) { await page.keyboard.press('Enter'); submitted = true; }

    console.log('[IG] Waiting for response...');
    await sleep(8000);
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    console.log('[IG] After login URL:', afterUrl);

    // Check for CAPTCHA after login submit
    if (afterUrl.includes('challenge') && (afterUrl.includes('captcha') || afterUrl.includes('verify'))) {
      console.log('[IG] CAPTCHA detected after login! Solving...');
      const captchaResult = await checkAndSolveCaptcha(page, 'button[type="submit"]');
      if (captchaResult.solved) {
        await sleep(5000);
        const afterCaptchaUrl = page.url();
        console.log('[IG] After CAPTCHA solve URL:', afterCaptchaUrl);
        if (!afterCaptchaUrl.includes('/accounts/login') && !afterCaptchaUrl.includes('challenge')) {
          const cookies = await ctx.cookies();
          await saveIGSession(cookies);
          await ctx.close();
          return { success: true, method: 'captcha_solved' };
        }
      }
    }

    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });

    // Check for 2FA
    const is2FAPage = await detectIG2FAPage(page);
    if (is2FAPage) {
      console.log('[IG] 2FA page detected!');
      ig2FA.active = true; ig2FA.context = ctx; ig2FA.page = page; ig2FA.createdAt = Date.now();
      return { success: false, needs2FA: true, message: '2FA requerido. Chame /ig/verify-2fa com o código.', screenshot };
    }

    // Check for "Receber código"
    const pageTextAfter = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
    if (pageTextAfter.includes('Receber código') || pageTextAfter.includes('receber um código')) {
      console.log('[IG] "Receber código" detected...');
      try {
        await page.click('text=Receber código', { timeout: 5000 });
        await sleep(5000);
        ig2FA.active = true; ig2FA.context = ctx; ig2FA.page = page; ig2FA.createdAt = Date.now();
        return { success: false, needs2FA: true, message: 'Instagram pediu código SMS. Chame /ig/verify-2fa {code}.', screenshot };
      } catch(e) {}
    }

    // Login success
    if (!afterUrl.includes('/accounts/login') && !afterUrl.includes('challenge')) {
      const cookies = await ctx.cookies();
      await saveIGSession(cookies);
      await ctx.close();
      return { success: true, cached: false, screenshot };
    }

    // Check for errors
    let loginError = '';
    const errorEl = await page.$('#slfErrorAlert') || await page.$('[id*="Error"]') || await page.$('[role="alert"]');
    if (errorEl) loginError = (await errorEl.textContent().catch(() => '')).trim();
    if (!loginError) {
      const errorPatterns = [
        /as informações de login.*incorretas/i, /the (password|username|information) you (entered|provided) (is )?(incorrect|wrong)/i,
        /your (password|username) (was )?incorrect/i, /couldn't log you in/i, /não foi possível fazer login/i,
        /usuário não encontrado/i, /user not found/i
      ];
      for (const pat of errorPatterns) { const m = pageTextAfter.match(pat); if (m) { loginError = m[0]; break; } }
    }

    if (loginError) {
      const ignorePatterns = ['senha está visível', 'password is visible', 'mostrar senha', 'show password'];
      const isRealError = !ignorePatterns.some(p => loginError.toLowerCase().includes(p));
      if (isRealError) {
        if (CREDS.ig.email && !CREDS.ig.user.includes('@')) {
          console.log('[IG] Username failed, retrying with email:', CREDS.ig.email);
          await ctx.close();
          const origUser = CREDS.ig.user; CREDS.ig.user = CREDS.ig.email;
          try { return await igLoginInternal(); } finally { CREDS.ig.user = origUser; }
        }
        await ctx.close();
        return { success: false, error: 'IG login: ' + loginError, screenshot };
      }
    }

    if (afterUrl.includes('challenge')) {
      await ctx.close();
      return { success: false, error: 'Instagram challenge detectado.', screenshot, challenge: true, url: afterUrl };
    }

    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 600) || 'empty');
    await ctx.close();
    return { success: false, error: 'Login falhou - estado desconhecido', url: afterUrl, pageText, screenshot };

  } catch (err) {
    console.error('[IG] Login error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

async function detectIG2FAPage(page) {
  const url = page.url();
  if (url.includes('two_factor') || url.includes('2fa')) return true;
  const has2FAElements = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const hasCodeInput = !!document.querySelector('input[name="verificationCode"], input[inputmode="numeric"], input[maxlength="6"]');
    return (text.includes('código de verificação') || text.includes('verification code') || text.includes('enter the code') || text.includes('Digite o código')) && hasCodeInput;
  }).catch(() => false);
  return has2FAElements;
}

async function igSend2FA(phone) {
  if (!ig2FA.active || !ig2FA.page) {
    return { success: false, error: 'Nenhum contexto 2FA ativo. Chame /ig/login primeiro.' };
  }
  try {
    const page = ig2FA.page;
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
    console.log('[IG] 2FA page text:', pageText.substring(0, 300));
    console.log('[IG] 2FA URL:', page.url());

    // Debug: dump all interactive elements
    const debugInfo = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')].map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder,
        ariaLabel: i.getAttribute('aria-label'), value: i.value, visible: i.offsetParent !== null
      }));
      const clickables = [...document.querySelectorAll('button, [role="button"], a, [type="submit"], div.x1lliihq')].map(e => ({
        tag: e.tagName, text: e.innerText?.substring(0, 50), role: e.getAttribute('role'),
        type: e.getAttribute('type'), className: e.className?.substring(0, 80), visible: e.offsetParent !== null
      }));
      return { inputs, clickables };
    });
    console.log('[IG] 2FA debug:', JSON.stringify(debugInfo).substring(0, 1000));

    // If phone number provided, fill using nativeInputValueSetter (for Web Bloks framework)
    let phoneFilled = false;
    let fillResult = { found: false };
    if (phone) {
      // Web Bloks uses custom input handling - need native value setter
      fillResult = await page.evaluate((phoneNumber) => {
        const input = document.querySelector('input[aria-label="Número do celular"]') 
                   || document.querySelector('input[type="text"]');
        if (!input) return { found: false };
        
        // Use native input value setter to bypass framework
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, phoneNumber);
        
        // Dispatch all possible events that Web Bloks might listen to
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: phoneNumber[phoneNumber.length-1] }));
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: phoneNumber[phoneNumber.length-1] }));
        
        return { found: true, value: input.value, tagName: input.tagName };
      }, phone);
      
      console.log('[IG] Native fill result:', JSON.stringify(fillResult));
      phoneFilled = fillResult.found && fillResult.value && fillResult.value.length > 3;
      
      // Verify from Playwright side
      if (fillResult.found) {
        await sleep(1000);
        const pwVal = await page.locator('input[aria-label="Número do celular"]').inputValue().catch(() => '');
        console.log('[IG] Playwright inputValue:', pwVal);
        if (pwVal && pwVal.length > 3) phoneFilled = true;
      }

      // If native setter didn't work, try Playwright locator fill
      if (!phoneFilled && fillResult.found) {
        try {
          const inputLocator = page.locator('input[aria-label="Número do celular"]');
          await inputLocator.click();
          await sleep(300);
          await inputLocator.pressSequentially(phone, { delay: 100 });
          await sleep(1000);
          const val = await inputLocator.inputValue();
          console.log('[IG] pressSequentially value:', val);
          phoneFilled = val && val.length > 3;
        } catch(e) {
          console.log('[IG] pressSequentially failed:', e.message);
        }
      }
    }

    console.log('[IG] phoneFilled:', phoneFilled);

    // Click send/continue button - prefer locator for React compatibility
    let clicked = false;

    // Try Playwright locator with getByRole first (most reliable for React)
    try {
      const continueBtn = page.getByRole('button', { name: 'Continuar' });
      if (await continueBtn.isVisible()) {
        console.log('[IG] Clicking via getByRole: Continuar');
        await continueBtn.click();
        clicked = true;
      }
    } catch(e) {
      console.log('[IG] getByRole failed:', e.message);
    }

    if (!clicked) {
      const sendSelectors = [
        'button:has-text("Enviar código")', 'button:has-text("Enviar")', 'button:has-text("Send code")', 'button:has-text("Send")',
        'button:has-text("Receber código")', 'button:has-text("Continuar")', 'button:has-text("Continue")',
        'button[type="submit"]', 'button:has-text("Next")', 'button:has-text("Próximo")',
        'div[role="button"]:has-text("Continuar")', 'div[role="button"]:has-text("Enviar")',
        'a:has-text("Continuar")', 'a:has-text("Enviar")',
      ];
      for (const sel of sendSelectors) {
        try {
          const locator = page.locator(sel).first();
          if (await locator.isVisible()) {
            console.log('[IG] Clicking via locator:', sel);
            await locator.click();
            clicked = true;
            break;
          }
        } catch(e) { continue; }
      }
    }

    if (!clicked) {
      try {
        await page.getByText('Continuar').click({ timeout: 3000 });
        console.log('[IG] Clicked via getByText: Continuar');
        clicked = true;
      } catch(e) {
        console.log('[IG] getByText failed:', e.message);
      }
    }

    if (!clicked) {
      return { success: false, error: 'Botão de envio não encontrado', screenshot, pageText: pageText.substring(0, 500), debugInfo };
    }

    await sleep(6000);
    const afterSs = await page.screenshot({ encoding: 'base64', fullPage: false });
    const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 800) || '');
    const afterUrl = page.url();
    console.log('[IG] After click URL:', afterUrl);
    console.log('[IG] After click text:', afterText.substring(0, 300));

    // Always include debug info in response
    const result = { screenshot: afterSs, pageText: afterText, afterUrl, phoneFilled, fillResult, debugInfo };

    // Check if we're now on a code entry page
    // Web Bloks pages might not have standard input elements
    // Detect by page text: "Insira o código" or "Enviamos um código"
    let isCodeEntryPage = afterText.includes('Insira o código') || afterText.includes('Enviamos um código') || afterText.includes('Enter the code');
    
    // Also check for standard code inputs
    if (!isCodeEntryPage) {
      const codeInputs = await page.$$('input[maxlength="6"]');
      for (const ci of codeInputs) {
        if (await ci.isVisible()) { isCodeEntryPage = true; break; }
      }
    }
    if (!isCodeEntryPage) {
      const numInput = await page.$('input[inputmode="numeric"]');
      if (numInput && await numInput.isVisible()) isCodeEntryPage = true;
    }
    if (!isCodeEntryPage) {
      const vcInput = await page.$('input[name="verificationCode"]');
      if (vcInput && await vcInput.isVisible()) isCodeEntryPage = true;
    }

    if (isCodeEntryPage) {
      // If we see "Enviamos um código" but also "Continuar", need to click again
      if (afterText.includes('Enviamos um código') && afterText.includes('Continuar')) {
        console.log('[IG] On confirmation page, clicking Continuar to actually send code');
        try {
          await page.getByRole('button', { name: 'Continuar' }).click({ timeout: 5000 });
          await sleep(5000);
          const finalText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
          const finalSs = await page.screenshot({ encoding: 'base64', fullPage: false });
          return { success: true, message: 'Código SMS enviado! Verifica o teu telefone.', screenshot: finalSs, pageText: finalText, afterUrl: page.url() };
        } catch(e) {
          console.log('[IG] Second continue click failed:', e.message);
        }
      }
      return { success: true, message: 'Página de código 2FA atingida. Verifica o teu telefone.', ...result };
    }

    // If page text changed, it progressed
    if (afterText !== pageText) {
      return { success: true, message: 'Página avançou. Verifica o estado.', ...result };
    }

    return { success: false, error: 'Página não avançou após clicar Continuar. O número pode estar errado ou a página requer outra ação.', ...result };


  } catch(e) {
    return { success: false, error: e.message };
  }
}

async function igVerify2FA(code) {
  if (!ig2FA.active || !ig2FA.page) {
    return { success: false, error: 'Nenhum contexto 2FA ativo' };
  }
  try {
    const page = ig2FA.page;
    const ctx = ig2FA.context;

    // Debug: dump ALL elements on the page to understand structure
    const pageDebug = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const interesting = [];
      for (const el of allElements) {
        const tag = el.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'].includes(tag)) {
          interesting.push({ tag, type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, 
            ariaLabel: el.getAttribute('aria-label'), value: el.value, visible: el.offsetParent !== null,
            maxLength: el.maxLength, inputMode: el.inputMode });
        }
        if (el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true') {
          interesting.push({ tag, contentEditable: true, text: el.innerText?.substring(0, 50), className: el.className?.substring(0, 60), visible: el.offsetParent !== null });
        }
        if (el.getAttribute('role') === 'textbox' || el.getAttribute('role') === 'search') {
          interesting.push({ tag, role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label'), className: el.className?.substring(0, 60), visible: el.offsetParent !== null });
        }
        // Check for Web Bloks input patterns
        if (el.className && typeof el.className === 'string' && (el.className.includes('input') || el.className.includes('field') || el.className.includes('code'))) {
          if (['DIV', 'SPAN', 'LABEL'].includes(tag) && el.offsetParent !== null) {
            interesting.push({ tag, className: el.className.substring(0, 80), text: el.innerText?.substring(0, 30), role: el.getAttribute('role') });
          }
        }
      }
      return interesting;
    });
    console.log('[IG] Verify page elements:', JSON.stringify(pageDebug).substring(0, 2000));

    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    const pageUrl = page.url();
    console.log('[IG] Verify 2FA page:', pageUrl);
    console.log('[IG] Verify 2FA text:', pageText.substring(0, 300));

    let codeEntered = false;

    // Approach 1: Standard input elements
    const codeInput = await page.$('input[name="verificationCode"]') || await page.$('input[inputmode="numeric"]') || await page.$('input[maxlength="6"]');
    if (codeInput) {
      console.log('[IG] Found standard code input');
      const nativeSetter = `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set`;
      await page.evaluate((c, ns) => {
        const input = document.querySelector('input[name="verificationCode"]') || document.querySelector('input[inputmode="numeric"]') || document.querySelector('input[maxlength="6"]');
        if (input) { eval(ns).call(input, c); input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); }
      }, code, nativeSetter);
      codeEntered = true;
    }

    // Approach 2: contenteditable element
    if (!codeEntered) {
      const ce = await page.$('[contenteditable="true"]');
      if (ce && await ce.isVisible()) {
        console.log('[IG] Found contenteditable, using execCommand');
        await ce.click();
        await sleep(300);
        await page.evaluate(() => document.execCommand('selectAll'));
        await page.evaluate(() => document.execCommand('delete'));
        await page.keyboard.type(code, { delay: 80 });
        codeEntered = true;
      }
    }

    // Approach 3: role="textbox"
    if (!codeEntered) {
      const textbox = await page.$('[role="textbox"]');
      if (textbox && await textbox.isVisible()) {
        console.log('[IG] Found role=textbox');
        await textbox.click();
        await sleep(300);
        await page.keyboard.type(code, { delay: 80 });
        codeEntered = true;
      }
    }

    // Approach 4: Click the code label area, then type (Web Bloks may create input on focus)
    if (!codeEntered) {
      console.log('[IG] Trying click-on-label + keyboard approach');
      // Try clicking on different areas where the code input might be
      const clickTargets = [
        'text=Insira o código',
        'text=Insira um código', 
        'label:has-text("código")',
      ];
      for (const target of clickTargets) {
        try {
          const el = page.locator(target).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            await sleep(800);
            // After clicking, check if an input appeared
            const newInput = await page.$('input:visible');
            if (newInput) {
              console.log('[IG] Input appeared after clicking:', target);
              const val = await newInput.inputValue();
              console.log('[IG] Input current value:', val);
              // Use native setter
              await page.evaluate((c) => {
                const inp = document.querySelector('input:visible');
                if (inp) {
                  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                  s.call(inp, c);
                  inp.dispatchEvent(new Event('input', {bubbles:true}));
                  inp.dispatchEvent(new Event('change', {bubbles:true}));
                }
              }, code);
              codeEntered = true;
              break;
            }
            // Try typing directly
            await page.keyboard.type(code, { delay: 80 });
            codeEntered = true;
            break;
          }
        } catch(e) { continue; }
      }
    }

    // Approach 5: Click on the page center area and type (last resort)
    if (!codeEntered) {
      console.log('[IG] Last resort: click center + type');
      const viewport = page.viewportSize();
      await page.mouse.click(viewport.width / 2, viewport.height / 2 - 30);
      await sleep(500);
      await page.keyboard.type(code, { delay: 80 });
      codeEntered = true;
    }

    console.log('[IG] codeEntered:', codeEntered);
    await sleep(1500);

    // Submit - click Continuar
    let submitted = false;
    try {
      const continueBtn = page.getByRole('button', { name: 'Continuar' });
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
        submitted = true;
        console.log('[IG] Submitted via getByRole Continuar');
      }
    } catch(e) {}

    if (!submitted) {
      const submitSelectors = ['button[type="submit"]', 'button:has-text("Confirmar")', 'button:has-text("Next")', 'div[role="button"]:has-text("Continuar")'];
      for (const sel of submitSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible()) { await btn.click(); submitted = true; break; }
        } catch(e) {}
      }
    }
    if (!submitted) await page.keyboard.press('Enter');

    await sleep(8000);
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log('[IG] After 2FA URL:', afterUrl);
    console.log('[IG] After 2FA text:', afterText.substring(0, 200));

    // Check CAPTCHA after 2FA
    if (afterUrl.includes('challenge') || afterUrl.includes('captcha') || afterUrl.includes('verify')) {
      console.log('[IG] CAPTCHA after 2FA! Solving...');
      const captchaResult = await checkAndSolveCaptcha(page, 'button[type="submit"]');
      if (captchaResult.solved) {
        await sleep(5000);
        const afterCaptchaUrl = page.url();
        if (!afterCaptchaUrl.includes('challenge') && !afterCaptchaUrl.includes('login')) {
          const cookies = await ctx.cookies();
          await saveIGSession(cookies);
          await close2FAContext();
          return { success: true, message: 'Login OK após 2FA + CAPTCHA!', screenshot };
        }
      }
    }

    if (!afterUrl.includes('login') && !afterUrl.includes('challenge') && !afterUrl.includes('2fa') && !afterUrl.includes('password/reset')) {
      const cookies = await ctx.cookies();
      await saveIGSession(cookies);
      await close2FAContext();
      return { success: true, message: 'Login OK com 2FA!', screenshot };
    }

    // Check if code was wrong (page still shows same content)
    if (afterText.includes('código incorreto') || afterText.includes('incorrect code') || afterText.includes('wrong code')) {
      await close2FAContext();
      return { success: false, error: 'Código incorreto. Tente novamente.', screenshot, afterUrl, afterText };
    }

    await close2FAContext();
    return { success: false, error: '2FA verificação falhou. URL: ' + afterUrl, screenshot, afterUrl, afterText, pageDebug };

  } catch(e) {
    console.error('[IG] 2FA verify error:', e.message);
    await close2FAContext();
    return { success: false, error: e.message };
  }
}

async function saveIGSession(cookies) {
  const dsUserId = cookies.find(c => c.name === 'ds_user_id');
  const igD = cookies.find(c => c.name === 'ig_d');
  const csrftoken = cookies.find(c => c.name === 'csrftoken');
  const sessionId = cookies.find(c => c.name === 'sessionid');
  sessions.ig = {
    cookies, loggedIn: true,
    dsUserId: dsUserId ? dsUserId.value : null,
    igD: igD ? igD.value : null,
    csrftoken: csrftoken ? csrftoken.value : null,
    sessionId: sessionId ? sessionId.value : null,
    expiresAt: Date.now() + 3600000
  };
}

// ============================================
// INSTAGRAM SEND DM
// ============================================

async function igSendDM(targetUsername, message, useProxy = true) {
  // Fresh login every time
  console.log('[IG] Fresh login before DM...');
  const loginResult = await igLogin();
  if (!loginResult.success) {
    if (loginResult.needs2FA) return { ...loginResult, hint: 'Complete 2FA primeiro' };
    return loginResult;
  }

  console.log('[IG] Sending DM to @' + targetUsername);
  const br = await getBrowser(useProxy);
  const ctx = await createContext(false, useProxy);
  await ctx.addCookies(sessions.ig.cookies);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  try {
    const cookies = sessions.ig.cookies.map(c => c.name + '=' + c.value).join('; ');

    // Get user ID
    await page.goto('https://www.instagram.com/' + encodeURIComponent(targetUsername) + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);

    const userId = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        let m = s.textContent.match(/"user_id"\s*:\s*"?(\d+)/);
        if (m) return m[1];
        m = s.textContent.match(/"pk"\s*:\s*(\d+)/);
        if (m) return m[1];
        m = s.textContent.match(/"id"\s*:\s*"(\d+)"/);
        if (m) return m[1];
        m = s.textContent.match(/profilePage_(\d+)/);
        if (m) return m[1];
      }
      return null;
    });

    console.log('[IG] Target userId:', userId || 'not found');

    // Method 1: API
    const apiResult = await page.evaluate(async ({ cookies, targetUsername, message, userId }) => {
      try {
        let csrftoken = '';
        for (const p of cookies.split('; ')) { if (p.startsWith('csrftoken=')) csrftoken = p.split('=')[1]; }

        let inboxId = null;
        const searchResp = await fetch('https://www.instagram.com/api/v1/direct_v2/ranked_recipients/?mode=raven&show_threads=true&query=' + encodeURIComponent(targetUsername), {
          headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrftoken, 'Cookie': cookies }
        });
        if (searchResp.ok) {
          const searchData = await searchResp.json();
          const users = searchData?.ranked_recipients || searchData?.inbox?.threads || [];
          for (const item of users) {
            const thread = item.thread || item;
            if (thread.users) {
              for (const u of thread.users) {
                if (u.username === targetUsername || u.pk?.toString() === userId) { inboxId = thread.thread_id || thread.thread_v2_id || thread.pk; break; }
              }
            }
          }
        }

        const sendBody = {
          recipient_users: userId ? [[parseInt(userId)]] : [],
          client_context: crypto.randomUUID(),
          thread_id: inboxId || '0',
          text: message
        };
        const sendResp = await fetch('https://www.instagram.com/api/v1/direct_v2/threads/broadcast/text/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': csrftoken, 'Cookie': cookies },
          body: Object.keys(sendBody).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(typeof sendBody[k] === 'object' ? JSON.stringify(sendBody[k]) : sendBody[k])).join('&'),
          credentials: 'include'
        });
        return { status: sendResp.status, body: (await sendResp.text()).substring(0, 500) };
      } catch(e) { return { error: e.message }; }
    }, { cookies, targetUsername, message, userId });

    console.log('[IG] API result:', apiResult.status, apiResult.body?.substring(0, 200) || apiResult.error);

    if (apiResult.status === 200) {
      try {
        const parsed = JSON.parse(apiResult.body);
        if (parsed.status === 'ok' || parsed.payload) {
          await ctx.close();
          return { success: true, platform: 'Instagram', recipient: targetUsername, recipientUid: userId, method: 'api' };
        }
      } catch(e) {}
    }

    // Method 2: Browser UI
    console.log('[IG] API failed, trying browser UI...');
    await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);

    const searchInput = await page.$('input[placeholder*="Search"]') || await page.$('input[placeholder*="search" i]') || await page.$('input[name="query"]') || await page.$('input[type="text"]');
    if (searchInput) {
      await searchInput.fill(targetUsername);
      await sleep(3000);

      const firstResult = await page.$('button[class*="user"]') || await page.$('div[role="button"]') || await page.$('a[href*="/direct/"]');
      if (firstResult) {
        await firstResult.click();
        await sleep(3000);

        const msgArea = await page.$('div[contenteditable="true"]') || await page.$('textarea[placeholder*="Message"]') || await page.$('textarea');
        if (msgArea) {
          await msgArea.click();
          await msgArea.fill(message);
          await sleep(500);
          await page.keyboard.press('Enter');
          await sleep(2000);
          await ctx.close();
          return { success: true, platform: 'Instagram', recipient: targetUsername, method: 'browser_ui' };
        }
      }
    }

    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    await ctx.close();
    return { success: false, error: 'DM falhou para @' + targetUsername, apiStatus: apiResult.status, screenshot };

  } catch (err) {
    console.error('[IG] Send DM error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

// ============================================
// FACEBOOK LOGIN + CAPTCHA
// ============================================

async function fbLogin() {
  if (sessions.fb.loggedIn && sessions.fb.cookies && Date.now() < sessions.fb.expiresAt) {
    console.log('[FB] Using cached session');
    return { success: true, cached: true };
  }

  console.log('[FB] Starting browser login...');
  const useProxy = !!getProxyAddress();
  const br = await getBrowser(useProxy);
  const ctx = await createContext(false, useProxy);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  try {
    await page.goto('https://www.facebook.com/login/', { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(2000);
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });

    const currentUrl = page.url();
    if (currentUrl.includes('facebook.com/home') || currentUrl.includes('facebook.com/?sk=welcome')) {
      console.log('[FB] Already logged in!');
      const cookies = await ctx.cookies();
      const fbDtsg = await page.evaluate(() => {
        try {
          const el = document.querySelector('[name="fb_dtsg"]');
          if (el) return el.value;
          for (const s of document.querySelectorAll('script')) {
            const m = s.textContent.match(/"token":"([^"]+)"/);
            if (m && s.textContent.includes('dtsg')) return m[1];
          }
          return null;
        } catch(e) { return null; }
      });
      const userId = cookies.find(c => c.name === 'c_user');
      sessions.fb = { cookies, loggedIn: true, userId: userId ? userId.value : null, dtsg: fbDtsg, expiresAt: Date.now() + 3600000 };
      await ctx.close();
      return { success: true, cached: false, screenshot };
    }

    // Fill form
    console.log('[FB] Filling login form...');
    await page.fill('input[name="email"]', CREDS.fb.email).catch(() => page.fill('#email', CREDS.fb.email).catch(() => {}));
    await page.fill('input[name="pass"]', CREDS.fb.pass).catch(() => page.fill('#pass', CREDS.fb.pass).catch(() => {}));
    await sleep(1000);

    // Click login
    await page.click('button[name="login"]').catch(() => page.click('#loginbutton').catch(() => page.keyboard.press('Enter')));
    await sleep(5000);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    console.log('[FB] After login URL:', afterUrl);

    // Check for CAPTCHA
    if (afterUrl.includes('captcha') || afterUrl.includes('challenge') || afterUrl.includes('checkpoint')) {
      console.log('[FB] CAPTCHA/challenge detected! Trying to solve...');
      const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
      console.log('[FB] Page text:', pageText.substring(0, 200));

      const captchaResult = await checkAndSolveCaptcha(page, 'button[name="login"]');
      if (captchaResult.solved) {
        await sleep(5000);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        const afterCaptchaUrl = page.url();
        console.log('[FB] After CAPTCHA URL:', afterCaptchaUrl);

        if (!afterCaptchaUrl.includes('login') && !afterCaptchaUrl.includes('captcha') && !afterCaptchaUrl.includes('checkpoint')) {
          // Success after CAPTCHA
          await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
          await sleep(3000);
          const fbDtsg = await page.evaluate(() => {
            const el = document.querySelector('[name="fb_dtsg"]');
            if (el) return el.value;
            return null;
          });
          const finalCookies = await ctx.cookies();
          const userId = finalCookies.find(c => c.name === 'c_user');
          if (userId) {
            sessions.fb = { cookies: finalCookies, loggedIn: true, userId: userId.value, dtsg: fbDtsg, expiresAt: Date.now() + 3600000 };
            console.log('[FB] Login OK after CAPTCHA! userId=' + userId.value);
            await ctx.close();
            return { success: true, method: 'captcha_solved' };
          }
        }
      }

      const screenshot3 = await page.screenshot({ encoding: 'base64', fullPage: false });
      await ctx.close();
      return { success: false, error: 'CAPTCHA/challenge nao resolvido. URL: ' + afterUrl, checkpoint: true, screenshot: screenshot3 };
    }

    const errorEl = await page.$('#error_box').catch(() => null);
    if (errorEl) {
      const errorText = await errorEl.textContent().catch(() => 'unknown');
      await ctx.close();
      return { success: false, error: 'Login form error: ' + errorText.trim(), screenshot };
    }

    // Success
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);

    const fbDtsg = await page.evaluate(() => {
      try {
        const el = document.querySelector('[name="fb_dtsg"]');
        if (el) return el.value;
        for (const s of document.querySelectorAll('script')) {
          if (s.textContent.includes('dtsg')) { const m = s.textContent.match(/"token"\s*:\s*"([^"]+)"/); if (m) return m[1]; }
        }
        return null;
      } catch(e) { return null; }
    });

    const finalCookies = await ctx.cookies();
    const userId = finalCookies.find(c => c.name === 'c_user');
    if (userId) {
      sessions.fb = { cookies: finalCookies, loggedIn: true, userId: userId.value, dtsg: fbDtsg, expiresAt: Date.now() + 3600000 };
      console.log('[FB] Login OK! userId=' + userId.value);
      await ctx.close();
      return { success: true, screenshot };
    }

    await ctx.close();
    return { success: false, error: 'Login failed - no session cookies', screenshot };

  } catch (err) {
    console.error('[FB] Login error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

// ============================================
// FACEBOOK SEND DM
// ============================================

async function fbSendDM(targetUsername, message, useProxy = true) {
  const loginResult = await fbLogin();
  if (!loginResult.success) return loginResult;

  console.log('[FB] Sending DM to @' + targetUsername);
  const br = await getBrowser(useProxy);
  const ctx = await createContext(false, useProxy);
  await ctx.addCookies(sessions.fb.cookies);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  try {
    await page.goto('https://www.facebook.com/' + encodeURIComponent(targetUsername), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);

    const userId = await page.evaluate(() => {
      const meta = document.querySelector('meta[property="al:ios:url"]');
      if (meta) { const m = meta.content.match(/\/(\d+)/); if (m) return m[1]; }
      for (const s of document.querySelectorAll('script')) {
        let m = s.textContent.match(/"entity_id"\s*:\s*"(\d+)"/);
        if (m) return m[1];
        m = s.textContent.match(/"userID"\s*:\s*"(\d+)"/);
        if (m) return m[1];
      }
      return null;
    });

    if (!userId) {
      await ctx.close();
      return { success: false, error: 'Could not find user ID for @' + targetUsername };
    }

    console.log('[FB] Target userId:', userId);

    // Try API with dtsg
    if (sessions.fb.dtsg) {
      const cookies = sessions.fb.cookies.map(c => c.name + '=' + c.value).join('; ');
      const apiResult = await page.evaluate(async ({ cookies, dtsg, userId, ownId, message }) => {
        try {
          const resp = await fetch('https://www.facebook.com/messaging/send/?dpr=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies, 'X-FB-LSD': dtsg },
            body: 'fb_dtsg=' + encodeURIComponent(dtsg) + '&body=' + encodeURIComponent(message) + '&action=send&recipient_id=' + userId + '&source=source%3Achat_web&__user=' + ownId + '&__a=1',
            credentials: 'include'
          });
          return { status: resp.status, body: (await resp.text()).substring(0, 500) };
        } catch(e) { return { error: e.message }; }
      }, { cookies, dtsg: sessions.fb.dtsg, userId, ownId: sessions.fb.userId, message });

      if (apiResult.status >= 200 && apiResult.status < 300) {
        await ctx.close();
        return { success: true, platform: 'Facebook', recipient: targetUsername, recipientUid: userId, method: 'api' };
      }
    }

    // Fallback: UI
    await page.goto('https://www.facebook.com/messages/t/' + userId + '/', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);
    const msgInput = await page.$('div[contenteditable="true"][role="textbox"]') || await page.$('textarea[name="message_body"]');
    if (msgInput) {
      await msgInput.click();
      await msgInput.fill(message);
      await page.keyboard.press('Enter');
      await sleep(2000);
      await ctx.close();
      return { success: true, platform: 'Facebook', recipient: targetUsername, recipientUid: userId, method: 'browser_ui' };
    }

    await ctx.close();
    return { success: false, error: 'All DM methods failed for @' + targetUsername };
  } catch (err) {
    console.error('[FB] Send DM error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

// ============================================
// TIKTOK LOGIN + CAPTCHA
// ============================================

async function ttLogin() {
  if (sessions.tt.loggedIn && sessions.tt.cookies && Date.now() < sessions.tt.expiresAt) {
    console.log('[TT] Using cached session');
    return { success: true, cached: true };
  }

  console.log('[TT] Starting browser login...');
  const useProxy = !!getProxyAddress();
  const br = await getBrowser(useProxy);
  const ctx = await createContext(false, useProxy);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  try {
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'networkidle', timeout: 45000 });
    await sleep(3000);

    const usePhoneBtn = await page.$('span:has-text("Use phone / email / username")');
    if (usePhoneBtn) { await usePhoneBtn.click(); await sleep(2000); }

    const emailTab = await page.$('div[data-e2e="login-tab-email"]');
    if (emailTab) { await emailTab.click(); await sleep(1000); }

    const userInput = await page.$('input[name="username"]') || await page.$('input[placeholder*="username"]');
    if (userInput) await userInput.fill(CREDS.tt.user);

    const passInput = await page.$('input[name="password"]') || await page.$('input[type="password"]');
    if (passInput) await passInput.fill(CREDS.tt.pass);

    await sleep(1000);

    const loginBtn = await page.$('button[data-e2e="login-button"]') || await page.$('button[type="submit"]');
    if (loginBtn) await loginBtn.click();
    else await page.keyboard.press('Enter');

    await sleep(5000);
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    console.log('[TT] After login URL:', afterUrl);

    // CAPTCHA detection + solving
    if (afterUrl.includes('verify') || afterUrl.includes('captcha') || afterUrl.includes('challenge')) {
      console.log('[TT] CAPTCHA detected! Solving...');
      const screenshot2 = await page.screenshot({ encoding: 'base64', fullPage: false });

      const captchaResult = await checkAndSolveCaptcha(page, 'button[data-e2e="login-button"]');
      if (captchaResult.solved) {
        await sleep(5000);
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        const afterCaptchaUrl = page.url();
        console.log('[TT] After CAPTCHA URL:', afterCaptchaUrl);

        if (!afterCaptchaUrl.includes('login') && !afterCaptchaUrl.includes('verify') && !afterCaptchaUrl.includes('captcha')) {
          const cookies = await ctx.cookies();
          const sessionId = cookies.find(c => c.name === 'sessionid');
          if (sessionId || !afterCaptchaUrl.includes('login')) {
            sessions.tt = { cookies, loggedIn: true, expiresAt: Date.now() + 3600000 };
            console.log('[TT] Login OK after CAPTCHA!');
            await ctx.close();
            return { success: true, method: 'captcha_solved' };
          }
        }
      }

      await ctx.close();
      return { success: false, error: 'CAPTCHA nao resolvido', needsCaptcha: true, screenshot: screenshot2 };
    }

    const cookies = await ctx.cookies();
    const sessionId = cookies.find(c => c.name === 'sessionid');
    if (sessionId || !afterUrl.includes('login')) {
      sessions.tt = { cookies, loggedIn: true, expiresAt: Date.now() + 3600000 };
      console.log('[TT] Login OK!');
      await ctx.close();
      return { success: true };
    }

    // Double check via profile
    await page.goto('https://www.tiktok.com/@me', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await sleep(3000);
    if (!page.url().includes('login')) {
      sessions.tt = { cookies: await ctx.cookies(), loggedIn: true, expiresAt: Date.now() + 3600000 };
      await ctx.close();
      return { success: true };
    }

    await ctx.close();
    return { success: false, error: 'Login failed' };
  } catch (err) {
    console.error('[TT] Login error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

// ============================================
// TIKTOK SEND DM
// ============================================

async function ttSendDM(targetUsername, message, useProxy = true) {
  const loginResult = await ttLogin();
  if (!loginResult.success) return loginResult;

  console.log('[TT] Sending DM to @' + targetUsername);
  const br = await getBrowser(useProxy);
  const ctx = await createContext(false, useProxy);
  await ctx.addCookies(sessions.tt.cookies);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  try {
    await page.goto('https://www.tiktok.com/@' + encodeURIComponent(targetUsername), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(3000);

    const userId = await page.evaluate(() => {
      for (const s of document.querySelectorAll('script')) {
        let m = s.textContent.match(/"userId"\s*:\s*"(\d+)"/);
        if (m) return m[1];
        m = s.textContent.match(/"id"\s*:\s*"(\d+)"/);
        if (m) return m[1];
        m = s.textContent.match(/"uid"\s*:\s*(\d+)/);
        if (m) return m[1];
      }
      return null;
    });

    if (!userId) {
      await ctx.close();
      return { success: false, error: 'Could not find user ID for @' + targetUsername };
    }

    console.log('[TT] Target userId:', userId);
    const cookies = sessions.tt.cookies.map(c => c.name + '=' + c.value).join('; ');

    // Method 1: API
    const sendResult = await page.evaluate(async ({ cookies, userId, message }) => {
      try {
        const resp = await fetch('https://www.tiktok.com/api/chat/send_message/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies },
          body: 'recipient_user_id=' + userId + '&message_type=text&content=' + encodeURIComponent(message) + '&client_message_id=' + crypto.randomUUID(),
          credentials: 'include'
        });
        return { status: resp.status, body: await resp.text() };
      } catch(e) { return { error: e.message }; }
    }, { cookies, userId, message });

    if (sendResult.status >= 200 && sendResult.status < 300) {
      try {
        const p = JSON.parse(sendResult.body);
        if (p.status_code === '0' || p.data || p.ok) {
          await ctx.close();
          return { success: true, platform: 'TikTok', recipient: targetUsername, recipientUid: userId, method: 'api' };
        }
      } catch(e) {}
    }

    // Method 2: UI
    await page.goto('https://www.tiktok.com/@' + encodeURIComponent(targetUsername), { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await sleep(2000);

    const msgBtn = await page.$('div[data-e2e="user-post-item-message"]') || await page.$('button:has-text("Message")');
    if (msgBtn) {
      await msgBtn.click();
      await sleep(3000);
      const msgInput = await page.$('div[contenteditable="true"]') || await page.$('textarea[data-e2e="chat-input"]');
      if (msgInput) {
        await msgInput.click();
        await msgInput.fill(message);
        await page.keyboard.press('Enter');
        await sleep(2000);
        await ctx.close();
        return { success: true, platform: 'TikTok', recipient: targetUsername, recipientUid: userId, method: 'browser_ui' };
      }
    }

    await ctx.close();
    return { success: false, error: 'All DM methods failed for @' + targetUsername, apiStatus: sendResult.status };
  } catch (err) {
    console.error('[TT] Send DM error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

// ============================================
// API ROUTES
// ============================================

app.get('/health', (req, res) => {
  cleanup2FA();
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    proxy: getProxyAddress(),
    capsolver: CAPSOLVER_KEY ? 'configured' : 'missing',
    sessions: {
      ig: sessions.ig.loggedIn ? 'logged_in' : 'logged_out',
      fb: sessions.fb.loggedIn ? 'logged_in' : 'logged_out',
      tt: sessions.tt.loggedIn ? 'logged_in' : 'logged_out'
    },
    ig2FA: ig2FA.active ? 'waiting_for_code' : 'none'
  });
});

// --- INSTAGRAM ROUTES ---

app.post('/ig/login', authMiddleware, async (req, res) => {
  try { cleanup2FA(); const result = await igLogin(); res.json(result); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/ig/send-2fa', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.body || {};
    const result = await igSend2FA(phone);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/ig/verify-2fa', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, error: 'Codigo invalido (4-8 digitos)' });
    const result = await igVerify2FA(code); res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// Debug endpoint - inspect 2FA page without closing context
app.post('/ig/2fa-debug', authMiddleware, async (req, res) => {
  try {
    if (!ig2FA.active || !ig2FA.page) return res.json({ active: false, error: 'Nenhum contexto 2FA ativo' });
    const page = ig2FA.page;
    const pageDebug = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const interesting = [];
      for (const el of allElements) {
        const tag = el.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT', 'IFRAME'].includes(tag)) {
          interesting.push({ tag, type: el.type, name: el.name, id: el.id, placeholder: el.placeholder,
            ariaLabel: el.getAttribute('aria-label'), value: el.value, visible: el.offsetParent !== null,
            maxLength: el.maxLength, inputMode: el.inputMode });
        }
        if (el.contentEditable === 'true' || el.getAttribute('contenteditable') === 'true') {
          interesting.push({ tag, contentEditable: true, text: el.innerText?.substring(0, 50), className: el.className?.substring(0, 60), visible: el.offsetParent !== null });
        }
        if (el.getAttribute('role') === 'textbox' || el.getAttribute('role') === 'search' || el.getAttribute('role') === 'button') {
          interesting.push({ tag, role: el.getAttribute('role'), text: el.innerText?.substring(0, 40), ariaLabel: el.getAttribute('aria-label'), className: el.className?.substring(0, 60), visible: el.offsetParent !== null });
        }
      }
      return interesting;
    });
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 800) || '');
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    res.json({ active: true, url: page.url(), pageText, pageDebug, hasScreenshot: true });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/ig/send', authMiddleware, async (req, res) => {
  try {
    const { username, message, noProxy } = req.body;
    if (!username || !message) return res.status(400).json({ success: false, error: 'username e message obrigatorios' });
    const result = await igSendDM(username, message, !noProxy);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// --- FACEBOOK ROUTES ---

app.post('/fb/login', authMiddleware, async (req, res) => {
  try { const result = await fbLogin(); res.json(result); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/fb/send', authMiddleware, async (req, res) => {
  try {
    const { username, message, noProxy } = req.body;
    if (!username || !message) return res.status(400).json({ success: false, error: 'username e message obrigatorios' });
    const result = await fbSendDM(username, message, !noProxy);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// --- TIKTOK ROUTES ---

app.post('/tt/login', authMiddleware, async (req, res) => {
  try { const result = await ttLogin(); res.json(result); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/tt/send', authMiddleware, async (req, res) => {
  try {
    const { username, message, noProxy } = req.body;
    if (!username || !message) return res.status(400).json({ success: false, error: 'username e message obrigatorios' });
    const result = await ttSendDM(username, message, !noProxy);
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// --- UNIFIED ROUTES ---

app.post('/send', authMiddleware, async (req, res) => {
  try {
    const { platform, username, message, noProxy } = req.body;
    if (!platform || !username || !message) return res.status(400).json({ success: false, error: 'platform, username e message obrigatorios' });
    const useProxy = !noProxy;
    let result;
    if (platform === 'instagram' || platform === 'ig') result = await igSendDM(username, message, useProxy);
    else if (platform === 'facebook' || platform === 'fb') result = await fbSendDM(username, message, useProxy);
    else if (platform === 'tiktok' || platform === 'tt') result = await ttSendDM(username, message, useProxy);
    else return res.status(400).json({ success: false, error: 'Platform invalida: ig, fb, tt' });
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/login', authMiddleware, async (req, res) => {
  try {
    const { platform } = req.body;
    if (!platform) return res.status(400).json({ success: false, error: 'platform obrigatorio' });
    let result;
    if (platform === 'instagram' || platform === 'ig') result = await igLogin();
    else if (platform === 'facebook' || platform === 'fb') result = await fbLogin();
    else if (platform === 'tiktok' || platform === 'tt') result = await ttLogin();
    else return res.status(400).json({ success: false, error: 'Platform invalida' });
    res.json(result);
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/clear', authMiddleware, async (req, res) => {
  await close2FAContext();
  sessions = {
    ig: { cookies: null, loggedIn: false, dsUserId: null, igD: null, csrftoken: null, sessionId: null, expiresAt: 0 },
    fb: { cookies: null, loggedIn: false, userId: null, dtsg: null, expiresAt: 0 },
    tt: { cookies: null, loggedIn: false, expiresAt: 0 }
  };
  if (browserNoProxy) { await browserNoProxy.close().catch(() => {}); browserNoProxy = null; }
  if (browserWithProxy) { await browserWithProxy.close().catch(() => {}); browserWithProxy = null; }
  res.json({ success: true, message: 'Todas as sessoes limpas' });
});

// ============================================
// START
// ============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('MBA Playwright Service v3 - Local');
  console.log('Port: ' + PORT);
  console.log('Proxy: ' + getProxyAddress());
  console.log('Capsolver: ' + (CAPSOLVER_KEY ? 'configured' : 'MISSING'));
  console.log('Platforms: IG (2FA+CAPTCHA), FB (CAPTCHA), TikTok (CAPTCHA)');
  console.log('========================================');
});