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
  tt: { cookies: null, loggedIn: false, expiresAt: 0, localStorage: null }
};

// Pending IG 2FA context
let ig2FA = {
  active: false,
  context: null,
  page: null,
  createdAt: 0
};

// Pending FB 2FA context
let fb2FA = {
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
  if (fb2FA.page) {
    try { await fb2FA.page.close(); } catch(e) {}
    fb2FA.page = null;
  }
  if (fb2FA.context) {
    try { await fb2FA.context.close(); } catch(e) {}
    fb2FA.context = null;
  }
  fb2FA.active = false;
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

    // reCAPTCHA v3 / Enterprise (check for grecaptcha in window)
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
      // Check for enterprise render params in scripts
      if (!sitekey) {
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
          const m = s.textContent.match(/sitekey['":\s]+['"]([\w-]+)['"]/i);
          if (m) { sitekey = m[1]; break; }
        }
      }
      const isEnterprise = !!window.grecaptcha.enterprise;
      return { type: isEnterprise ? 'recaptcha_v3' : 'recaptcha_v3', sitekey, found: true, enterprise: isEnterprise };
    }

    // reCAPTCHA Enterprise iframe (no grecaptcha object yet, but iframe present)
    const rcEnterpriseFrames = document.querySelectorAll('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"], iframe[src*="google.com/recaptcha"]');
    if (rcEnterpriseFrames.length > 0) {
      let sitekey = '';
      for (const f of rcEnterpriseFrames) {
        const m = f.src.match(/k=([^&]+)/);
        if (m) { sitekey = m[1]; break; }
      }
      if (!sitekey) {
        const el = document.querySelector('[data-sitekey]');
        if (el) sitekey = el.getAttribute('data-sitekey');
      }
      if (!sitekey) {
        const rcScript = document.querySelector('script[src*="recaptcha/api.js"], script[src*="recaptcha/enterprise.js"]');
        if (rcScript) {
          const m = rcScript.src.match(/render=([^&]+)/);
          if (m) sitekey = m[1];
        }
      }
      return { type: 'recaptcha_v2', sitekey, found: true, enterprise: true };
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

    // Fill username with nativeInputValueSetter (Web Bloks)
    console.log('[IG] Filling username:', CREDS.ig.user);
    try {
      const userFillResult = await page.evaluate((username) => {
        const input = document.querySelector('input[name="username"]')
                   || document.querySelector('input[aria-label="Número de celular, nome de usuário ou email"]')
                   || document.querySelector('input[autocomplete="username"]')
                   || document.querySelector('input[type="text"]');
        if (!input) return { found: false };
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, username);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, value: input.value };
      }, CREDS.ig.user);
      console.log('[IG] Username fill result:', JSON.stringify(userFillResult));
      if (!userFillResult.found || !userFillResult.value) {
        await page.fill(userSel, CREDS.ig.user);
      }
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
      console.log('[IG] Filling password with nativeInputValueSetter...');
      // Web Bloks needs native setter (same as phone input)
      const passFillResult = await page.evaluate((pwd) => {
        const input = document.querySelector('input[name="password"]') 
                   || document.querySelector('input[type="password"]')
                   || document.querySelector('input[aria-label="Senha"]');
        if (!input) return { found: false };
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, pwd);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, value: input.value };
      }, CREDS.ig.pass);
      console.log('[IG] Password fill result:', JSON.stringify(passFillResult));
      
      // Fallback to .type() if native setter didn't stick
      if (!passFillResult.found || !passFillResult.value) {
        const el = await page.$(passSel);
        if (el) { await el.click(); await sleep(300); await el.type(CREDS.ig.pass, { delay: 30 }); }
      }
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

    // Check for 2FA (improved detection for Web Bloks)
    const is2FAPage = await detectIG2FAPage(page);
    if (is2FAPage) {
      console.log('[IG] 2FA page detected!');
      ig2FA.active = true; ig2FA.context = ctx; ig2FA.page = page; ig2FA.createdAt = Date.now();
      return { success: false, needs2FA: true, message: '2FA requerido. Chame /ig/send-2fa para enviar o SMS.', screenshot };
    }

    // Additional 2FA check: if we're still on a challenge URL with Continuar button
    const pageTextAfter = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
    const stillOnChallenge = afterUrl.includes('challenge') || afterUrl.includes('two_factor');
    if (stillOnChallenge) {
      console.log('[IG] Still on challenge URL, treating as 2FA');
      ig2FA.active = true; ig2FA.context = ctx; ig2FA.page = page; ig2FA.createdAt = Date.now();
      return { success: false, needs2FA: true, message: '2FA/challenge detectado. Chame /ig/send-2fa para enviar o SMS.', screenshot };
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
        /senha incorreta/i, /Senha incorreta/i, /password.*incorrect/i,
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
        // If password incorrect, try "Receber código" (login via code)
        if (pageTextAfter.includes('Receber código') && pageTextAfter.includes('Senha incorreta')) {
          console.log('[IG] Password rejected, trying login via code...');
          try {
            // Click "Receber código" link
            await page.getByRole('link', { name: 'Receber código' }).click({ timeout: 5000 }).catch(async () => {
              await page.click('text=Receber código', { timeout: 3000 });
            });
            await sleep(5000);
            const codePageUrl = page.url();
            const codePageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
            console.log('[IG] Code page URL:', codePageUrl);
            console.log('[IG] Code page text:', codePageText.substring(0, 300));
            
            // If we're on a code entry page (not password reset), save context
            if (!codePageUrl.includes('password/reset') && !codePageUrl.includes('reset')) {
              ig2FA.active = true; ig2FA.context = ctx; ig2FA.page = page; ig2FA.createdAt = Date.now();
              const codeSs = await page.screenshot({ encoding: 'base64', fullPage: false });
              return { success: false, needsLoginCode: true, message: 'Senha rejeitada. Página de código atingida. Chame /ig/verify-2fa {code}.', url: codePageUrl, pageText: codePageText.substring(0, 500), screenshot: codeSs };
            }
            
            // If it went to password reset, check what's there
            if (codePageUrl.includes('password/reset')) {
              // Password reset page might have option to send code to phone
              // Try filling phone and continuing
              console.log('[IG] On password reset page, trying to get login code...');
              const phoneInput = await page.$('input[aria-label="Número do celular"]') || await page.$('input[type="text"]');
              if (phoneInput) {
                const nativeSetter = 'Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set';
                await page.evaluate((ps) => {
                  const s = eval(ps);
                  const input = document.querySelector('input[aria-label="Número do celular"]') || document.querySelector('input[type="text"]');
                  if (input) { s.call(input, '+244925049405'); input.dispatchEvent(new Event('input', {bubbles:true})); input.dispatchEvent(new Event('change', {bubbles:true})); }
                }, nativeSetter);
                await sleep(1000);
                try {
                  await page.getByRole('button', { name: 'Continuar' }).click({ timeout: 5000 });
                  await sleep(5000);
                  const afterCodeUrl = page.url();
                  const afterCodeText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
                  console.log('[IG] After phone submit URL:', afterCodeUrl);
                  console.log('[IG] After phone submit text:', afterCodeText.substring(0, 300));
                  
                  ig2FA.active = true; ig2FA.context = ctx; ig2FA.page = page; ig2FA.createdAt = Date.now();
                  const finalSs = await page.screenshot({ encoding: 'base64', fullPage: false });
                  return { success: false, needsLoginCode: true, message: 'Código de login enviado para o telefone. Verifica o SMS e chame /ig/verify-2fa {code}.', url: afterCodeUrl, pageText: afterCodeText.substring(0, 500), screenshot: finalSs };
                } catch(e) {
                  console.log('[IG] Continuar click failed:', e.message);
                }
              }
            }
          } catch(e) {
            console.log('[IG] Receber código flow error:', e.message);
          }
        }
        
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
  // Web Bloks 2FA: detect by text patterns BEFORE code input appears
  // The page shows phone number + Continuar button, code input only appears AFTER SMS sent
  const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '').catch(() => '');
  const url2 = page.url();
  console.log('[IG] detect2FA URL:', url2, 'text snippet:', pageText.substring(0, 300));
  
  // Check if this is a password reset page (NOT 2FA)
  const isPasswordReset = url2.includes('password/reset') 
    || url2.includes('reset/password')
    || pageText.includes('Redefinir sua senha')
    || pageText.includes('Reset your password')
    || (pageText.includes('Esqueceu a senha') && !pageText.includes('código de segurança'));
  if (isPasswordReset) return false;

  // Strong indicators of 2FA page (Web Bloks framework)
  const is2FA = pageText.includes('verificação de duas etapas') 
    || pageText.includes('two-factor authentication')
    || pageText.includes('Enter your security code')
    || pageText.includes('Digite o código de segurança')
    || pageText.includes('Insira o código')
    || pageText.includes('Enviamos um código')
    || pageText.includes('Enviaremos um código')
    || pageText.includes('enviaremos um código')
    || (pageText.includes('código de verificação') && !pageText.includes('Esqueceu a senha'))
    || pageText.includes('verification code')
    || pageText.includes('enter the code')
    || pageText.includes('Digite o código')
    // Web Bloks shows masked phone + Continuar on 2FA page
    || (pageText.includes('Continuar') && pageText.match(/\+\d{1,3}\s*\*{3,}/))
    // Masked phone patterns like "****405" or "terminando em"
    || (pageText.includes('Continuar') && (pageText.match(/\*{3,}\d{2,4}/) || pageText.includes('terminando em')))
    || (pageText.includes('Continuar') && pageText.includes('Número do celular') && url2.includes('challenge'))
    // "Enviar código" button (not "Receber código" link which is forgot password)
    || pageText.includes('Enviar código')
    // Code input exists (standard flow)
    || (await page.$('input[name="verificationCode"], input[inputmode="numeric"][aria-label*="código"], input[maxlength="6"][inputmode="numeric"]').catch(() => null));
  
  return is2FA;
}

async function igSend2FA(phone) {
  if (!ig2FA.active || !ig2FA.page) {
    return { success: false, error: 'Nenhum contexto 2FA ativo. Chame /ig/login primeiro.' };
  }
  try {
    const page = ig2FA.page;
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
    const currentUrl = page.url();
    console.log('[IG send-2fa] URL:', currentUrl);
    console.log('[IG send-2fa] Text:', pageText.substring(0, 300));

    // If phone number provided, fill using nativeInputValueSetter
    if (phone) {
      const fillResult = await page.evaluate((phoneNumber) => {
        const input = document.querySelector('input[aria-label="Número do celular"]') 
                   || document.querySelector('input[type="text"]')
                   || document.querySelector('input[name="email"]')
                   || document.querySelector('input');
        if (!input) return { found: false };
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, phoneNumber);
        input.dispatchEvent(new Event('focus', { bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { found: true, value: input.value };
      }, phone);
      console.log('[IG send-2fa] Fill result:', JSON.stringify(fillResult));
      await sleep(1500);
    }

    // Click Continuar using mouse click (most realistic for Web Bloks)
    let clicked = false;
    
    // Method 1: Get bounding box and use mouse.click (most reliable for Web Bloks)
    try {
      const btnBox = await page.locator('[role="button"]').filter({ hasText: 'Continuar' }).first().boundingBox({ timeout: 5000 });
      if (btnBox) {
        const x = btnBox.x + btnBox.width / 2;
        const y = btnBox.y + btnBox.height / 2;
        console.log('[IG send-2fa] Clicking via mouse.click at', x, y);
        await page.mouse.click(x, y);
        clicked = true;
      }
    } catch(e) {
      console.log('[IG send-2fa] mouse.click failed:', e.message);
    }

    // Method 2: JS click with full event simulation
    if (!clicked) {
      const clickResult = await page.evaluate(() => {
        const buttons = document.querySelectorAll('[role="button"], button, div[role="button"]');
        for (const btn of buttons) {
          const text = (btn.innerText || '').trim();
          if (text === 'Continuar' || text === 'Enviar código' || text === 'Enviar') {
            // Full event simulation
            const rect = btn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
            return { clicked: true, text: text, method: 'full_events' };
          }
        }
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) { submitBtn.click(); return { clicked: true, text: 'submit' }; }
        return { clicked: false };
      });
      clicked = clickResult.clicked;
      console.log('[IG send-2fa] Click result:', JSON.stringify(clickResult));
    }

    // Method 3: Playwright getByRole as last resort
    if (!clicked) {
      try {
        await page.getByRole('button', { name: 'Continuar' }).click({ timeout: 5000, force: true });
        clicked = true;
      } catch(e) {}
    }

    if (!clicked) {
      const ss = await page.screenshot({ encoding: 'base64', fullPage: false });
      return { success: false, error: 'Botão não encontrado', pageText: pageText.substring(0, 500), url: currentUrl, screenshot: ss };
    }

    // Wait for page to change
    await sleep(6000);
    const afterUrl = page.url();
    const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
    const ss = await page.screenshot({ encoding: 'base64', fullPage: false });
    console.log('[IG send-2fa] After URL:', afterUrl);
    console.log('[IG send-2fa] After text:', afterText.substring(0, 300));

    // Check if we need to click Continuar again (2-click flow)
    if ((afterText.includes('Enviamos um código') || afterText.includes('Enviaremos um código') || afterText.includes('enviaremos um código')) && afterText.includes('Continuar')) {
      console.log('[IG send-2fa] Clicking Continuar AGAIN via mouse.click to send SMS');
      try {
        const btnBox2 = await page.locator('[role="button"]').filter({ hasText: 'Continuar' }).first().boundingBox({ timeout: 5000 });
        if (btnBox2) {
          await page.mouse.click(btnBox2.x + btnBox2.width / 2, btnBox2.y + btnBox2.height / 2);
        } else {
          await page.evaluate(() => {
            const buttons = document.querySelectorAll('[role="button"]');
            for (const btn of buttons) {
              if ((btn.innerText || '').trim() === 'Continuar') {
                const rect = btn.getBoundingClientRect();
                btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 }));
                btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 }));
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 }));
                return;
              }
            }
          });
        }
      } catch(e) {
        console.log('[IG send-2fa] Second click error:', e.message);
      }
      await sleep(8000);  // Wait longer for SMS to actually send
      const finalText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
      const finalSs = await page.screenshot({ encoding: 'base64', fullPage: false });
      return { success: true, message: 'Código SMS enviado! Verifica o telefone.', url: page.url(), pageText: finalText, screenshot: finalSs };
    }

    // Check if we're now on a code entry page
    const hasCodeInput = await page.$('input[aria-label="Insira o código"]') 
      || await page.$('input[inputmode="numeric"]') 
      || await page.$('input[maxlength="6"]');
    
    if (hasCodeInput || afterText.includes('Insira o código') || afterText.includes('código de verificação')) {
      return { success: true, message: 'Página de código atingida. Verifica o telefone.', url: afterUrl, pageText: afterText.substring(0, 500), screenshot: ss };
    }

    // Page progressed but unclear state
    if (afterUrl !== currentUrl) {
      return { success: true, message: 'Página avançou. Verifica o estado.', url: afterUrl, pageText: afterText.substring(0, 500), screenshot: ss };
    }

    return { success: false, error: 'Página não avançou após clicar Continuar.', url: afterUrl, pageText: afterText.substring(0, 500), screenshot: ss };

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
    const currentUrl = page.url();
    console.log('[IG verify-2fa] URL:', currentUrl);

    // Find code input - try nativeInputValueSetter first (Web Bloks)
    const codeInputSel = 'input[aria-label="Insira o código"]'
      || 'input[name="verificationCode"]'
      || 'input[inputmode="numeric"]'
      || 'input[maxlength="6"]';
    
    const fillResult = await page.evaluate((code) => {
      const input = document.querySelector('input[aria-label="Insira o código"]')
                 || document.querySelector('input[name="verificationCode"]')
                 || document.querySelector('input[inputmode="numeric"]')
                 || document.querySelector('input[maxlength="6"]')
                 || document.querySelector('input[type="text"]');
      if (!input) return { found: false };
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(input, code);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true, value: input.value };
    }, code);
    console.log('[IG verify-2fa] Fill result:', JSON.stringify(fillResult));
    await sleep(1500);

    if (!fillResult.found) {
      return { success: false, error: 'Campo de código não encontrado', url: currentUrl, pageText: await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '') };
    }

    // Submit via JS click (Web Bloks compatible)
    const submitResult = await page.evaluate(() => {
      const buttons = document.querySelectorAll('[role="button"], button');
      for (const btn of buttons) {
        const text = (btn.innerText || '').trim();
        if (text === 'Continuar' || text === 'Confirmar' || text === 'Enviar' || text === 'Next' || text === 'Submeter') {
          btn.click();
          return { clicked: true, text };
        }
      }
      document.querySelector('button[type="submit"]')?.click();
      return { clicked: false };
    });
    console.log('[IG verify-2fa] Submit:', JSON.stringify(submitResult));

    await sleep(8000);
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    console.log('[IG] After 2FA URL:', afterUrl);

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

    if (!afterUrl.includes('login') && !afterUrl.includes('challenge') && !afterUrl.includes('2fa')) {
      // Login success!
      const cookies = await ctx.cookies();
      await saveIGSession(cookies);
      await close2FAContext();
      return { success: true, message: 'Login OK com 2FA!', screenshot };
    }

    await close2FAContext();
    return { success: false, error: '2FA verificação falhou. URL: ' + afterUrl, screenshot };

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
    await page.goto('https://www.instagram.com/' + encodeURIComponent(targetUsername) + '/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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
    await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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
    await page.goto('https://www.facebook.com/login/', { waitUntil: 'load', timeout: 45000 });
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

    // Debug: verify fields were filled
    const fbFormDebug = await page.evaluate(() => {
      const email = document.querySelector('input[name="email"]');
      const pass = document.querySelector('input[name="pass"]');
      return { emailVal: email ? email.value : 'NONE', passLen: pass ? pass.value.length : -1 };
    });
    console.log('[FB] Form debug:', JSON.stringify(fbFormDebug));

    // Click login
    await page.click('button[name="login"]').catch(() => page.click('#loginbutton').catch(() => page.keyboard.press('Enter')));
    await sleep(5000);
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log('[FB] After login URL:', afterUrl, 'text:', afterText.substring(0, 200));

    // Check for 2FA / checkpoint / CAPTCHA
    if (afterUrl.includes('captcha') || afterUrl.includes('challenge') || afterUrl.includes('checkpoint') || afterUrl.includes('two_factor') || afterUrl.includes('two_step_verification')) {
      const pageTextFull = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
      console.log('[FB] Challenge/checkpoint page text:', pageTextFull.substring(0, 300));

      // two_step_verification URL is ALWAYS 2FA
      const isTwoStepUrl = afterUrl.includes('two_step_verification') || afterUrl.includes('two_factor');

      // Check if this is a 2FA code page (not just a CAPTCHA)
      const isFB2FA = isTwoStepUrl
        || pageTextFull.includes('two-factor') 
        || pageTextFull.includes('authentication code')
        || pageTextFull.includes('Enter login code')
        || pageTextFull.includes('enter the code')
        || pageTextFull.includes('código de autenticação')
        || pageTextFull.includes('código de login')
        || pageTextFull.includes('recuperação')
        || pageTextFull.includes('recovery code')
        || pageTextFull.includes('Get a code')
        || pageTextFull.includes('Obter um código')
        || pageTextFull.includes('Send code')
        || pageTextFull.includes('Enviar código')
        || (afterUrl.includes('checkpoint') && (pageTextFull.includes('Continuar') || pageTextFull.includes('Continue')))
        || await page.$('input[name="approvals_code"]').catch(() => null)
        || await page.$('input[inputmode="numeric"]').catch(() => null);

      if (isFB2FA) {
        console.log('[FB] 2FA page detected! Saving context...');
        const screenshot2 = await page.screenshot({ encoding: 'base64', fullPage: false });
        fb2FA.active = true;
        fb2FA.context = ctx;
        fb2FA.page = page;
        fb2FA.createdAt = Date.now();
        return { success: false, needs2FA: true, message: '2FA do Facebook requerido. Chame /fb/send-2fa para enviar o código ou /fb/verify-2fa {code} se já tem o código.', screenshot: screenshot2, url: afterUrl, pageText: pageTextFull.substring(0, 500) };
      }

      // Otherwise try CAPTCHA
      console.log('[FB] CAPTCHA/challenge detected! Trying to solve...');
      const captchaResult = await checkAndSolveCaptcha(page, 'button[name="login"]');
      if (captchaResult.solved) {
        await sleep(5000);
        await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
        const afterCaptchaUrl = page.url();
        console.log('[FB] After CAPTCHA URL:', afterCaptchaUrl);

        if (!afterCaptchaUrl.includes('login') && !afterCaptchaUrl.includes('captcha') && !afterCaptchaUrl.includes('checkpoint')) {
          // Success after CAPTCHA
          await page.goto('https://www.facebook.com/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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

    // Check for 2FA even if not on checkpoint URL (some 2FA pages stay on login URL)
    const fb2FACheck = await page.evaluate(() => {
      const text = document.body?.innerText?.substring(0, 2000) || '';
      return {
        hasCodeInput: !!(document.querySelector('input[name="approvals_code"]') 
          || document.querySelector('input[inputmode="numeric"]')
          || document.querySelector('#approvals_code')),
        text: text,
        hasGetCode: text.includes('Get a code') || text.includes('Obter um código') || text.includes('Send code') || text.includes('Enviar código'),
        hasTwoFactor: text.toLowerCase().includes('two-factor') || text.toLowerCase().includes('2-factor') || text.includes('authentication code'),
        hasRecovery: text.toLowerCase().includes('recovery code') || text.toLowerCase().includes('código de recuperação')
      };
    }).catch(() => ({ hasCodeInput: false, text: '', hasGetCode: false, hasTwoFactor: false, hasRecovery: false }));
    
    if (fb2FACheck.hasCodeInput || fb2FACheck.hasTwoFactor || fb2FACheck.hasGetCode || fb2FACheck.hasRecovery) {
      console.log('[FB] 2FA detected (non-checkpoint URL)! codeInput:', fb2FACheck.hasCodeInput, '2fa:', fb2FACheck.hasTwoFactor, 'getCode:', fb2FACheck.hasGetCode);
      const screenshot2fa = await page.screenshot({ encoding: 'base64', fullPage: false });
      fb2FA.active = true;
      fb2FA.context = ctx;
      fb2FA.page = page;
      fb2FA.createdAt = Date.now();
      return { success: false, needs2FA: true, message: '2FA do Facebook requerido. Chame /fb/send-2fa para enviar o código ou /fb/verify-2fa {code} se já tem o código.', screenshot: screenshot2fa, url: afterUrl, pageText: fb2FACheck.text.substring(0, 500) };
    }

    const errorEl = await page.$('#error_box').catch(() => null);
    if (errorEl) {
      const errorText = await errorEl.textContent().catch(() => 'unknown');
      await ctx.close();
      return { success: false, error: 'Login form error: ' + errorText.trim(), screenshot };
    }

    // Success
    await page.goto('https://www.facebook.com/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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
    const cookieNames = finalCookies.map(c => c.name);
    console.log('[FB] Cookie names:', cookieNames.join(', '));
    const userId = finalCookies.find(c => c.name === 'c_user');
    const xsCookie = finalCookies.find(c => c.name === 'xs');
    if (userId || xsCookie) {
      sessions.fb = { cookies: finalCookies, loggedIn: true, userId: userId ? userId.value : null, dtsg: fbDtsg, expiresAt: Date.now() + 3600000 };
      console.log('[FB] Login OK! userId=' + (userId ? userId.value : 'null') + ' xs=' + (xsCookie ? 'yes' : 'no'));
      await ctx.close();
      return { success: true, screenshot };
    }

    // Extra wait and retry cookie check
    console.log('[FB] No c_user/xs yet, waiting more...');
    await sleep(5000);
    const retryCookies = await ctx.cookies();
    const retryNames = retryCookies.map(c => c.name);
    console.log('[FB] Retry cookies:', retryNames.join(', '));
    const retryUser = retryCookies.find(c => c.name === 'c_user');
    const retryXs = retryCookies.find(c => c.name === 'xs');
    if (retryUser || retryXs) {
      sessions.fb = { cookies: retryCookies, loggedIn: true, userId: retryUser ? retryUser.value : null, dtsg: fbDtsg, expiresAt: Date.now() + 3600000 };
      console.log('[FB] Login OK on retry!');
      await ctx.close();
      return { success: true, screenshot };
    }

    await ctx.close();
    return { success: false, error: 'Login failed - no session cookies. Cookies: ' + cookieNames.join(', '), afterUrl, afterText: afterText.substring(0, 300), screenshot };

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
    await page.goto('https://www.facebook.com/' + encodeURIComponent(targetUsername), { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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
    await page.goto('https://www.facebook.com/messages/t/' + userId + '/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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
// FACEBOOK 2FA FUNCTIONS
// ============================================

async function fbSend2FA() {
  if (!fb2FA.active || !fb2FA.page) {
    return { success: false, error: 'Nenhum contexto 2FA ativo para Facebook. Chame /fb/login primeiro.' };
  }
  try {
    const page = fb2FA.page;
    const currentUrl = page.url();
    console.log('[FB send-2fa] URL:', currentUrl);

    // Wait for page content to load (FB 2FA is JS-rendered)
    await sleep(3000);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    
    // Try to get text - check main page and iframes
    let pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
    console.log('[FB send-2fa] Main page text:', pageText.substring(0, 300));

    // Check if content is in an iframe
    if (!pageText || pageText.length < 20) {
      console.log('[FB send-2fa] Main page empty, checking iframes...');
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const frameText = await frame.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
          if (frameText.length > 20) {
            console.log('[FB send-2fa] Found text in frame:', frame.url().substring(0, 80), frameText.substring(0, 200));
            pageText = frameText;
            break;
          }
        } catch(e) {}
      }
    }

    // If still empty, try waiting longer
    if (!pageText || pageText.length < 20) {
      console.log('[FB send-2fa] Still empty, waiting 5s more...');
      await sleep(5000);
      pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
      // Check all frames again
      const frames = page.frames();
      for (const frame of frames) {
        try {
          const ft = await frame.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
          if (ft.length > pageText.length) pageText = ft;
        } catch(e) {}
      }
      console.log('[FB send-2fa] After wait text:', pageText.substring(0, 300));
    }

    // Take screenshot for debugging
    const ss = await page.screenshot({ encoding: 'base64', fullPage: false });

    let pageDebug = null;
    let frameDebug = [];

    // Check for and solve CAPTCHA first (FB often puts reCAPTCHA before 2FA code)
    if (pageText.includes('reCAPTCHA') || pageText.includes('recaptcha') || pageText.includes('verificação de segurança')) {
      console.log('[FB send-2fa] CAPTCHA/verification page detected');
      
      // Debug: dump page structure
      pageDebug = await page.evaluate(() => {
        const allElements = document.querySelectorAll('*');
        const buttons = [];
        const inputs = [];
        const iframes = [];
        for (const el of allElements) {
          const tag = el.tagName;
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && rect.top > 0) {
            if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'IFRAME') {
              const info = { tag, text: (el.innerText||'').substring(0,50), id: el.id, name: el.name, type: el.type, src: (el.src||'').substring(0,100), w: Math.round(rect.width), h: Math.round(rect.height) };
              if (tag === 'BUTTON' || tag === 'A') buttons.push(info);
              if (tag === 'INPUT') inputs.push(info);
              if (tag === 'IFRAME') iframes.push(info);
            }
          }
        }
        // Also check for grecaptcha
        const hasGrecaptcha = !!window.grecaptcha;
        const hasEnterprise = hasGrecaptcha && !!window.grecaptcha.enterprise;
        // Check for data-sitekey
        const sitekeyEl = document.querySelector('[data-sitekey]');
        const sitekey = sitekeyEl ? sitekeyEl.getAttribute('data-sitekey') : null;
        // Check for recaptcha scripts
        const rcScripts = [];
        document.querySelectorAll('script').forEach(s => {
          if (s.src && (s.src.includes('recaptcha') || s.src.includes('captcha'))) rcScripts.push(s.src.substring(0, 120));
          if (s.textContent && s.textContent.includes('sitekey')) rcScripts.push('INLINE: ' + s.textContent.substring(0, 100));
        });
        return { buttons, inputs, iframes, hasGrecaptcha, hasEnterprise, sitekey, rcScripts, html: document.documentElement.outerHTML.substring(0, 2000) };
      }).catch(e => ({ error: e.message }));
      console.log('[FB send-2fa] Page debug:', JSON.stringify(pageDebug, null, 2).substring(0, 2000));

      // Check frames too
      frameDebug = [];
      let recaptchaSitekey = pageDebug.sitekey;
      for (const frame of page.frames()) {
        try {
          const fUrl = frame.url();
          if (fUrl.includes('about:blank')) continue;
          // Extract sitekey from recaptcha iframe URL
          if (fUrl.includes('recaptcha') && !recaptchaSitekey) {
            const m = fUrl.match(/k=([^&]+)/);
            if (m) recaptchaSitekey = m[1];
          }
          const fText = await frame.evaluate(() => document.body?.innerText?.substring(0, 200) || '').catch(() => '');
          const fInputs = await frame.evaluate(() => {
            return Array.from(document.querySelectorAll('input, button, [role="button"]')).map(e => ({
              tag: e.tagName, type: e.type, name: e.name, id: e.id, text: (e.innerText||'').substring(0,30)
            }));
          }).catch(() => []);
          if (fText || fInputs.length > 0) {
            frameDebug.push({ url: fUrl.substring(0, 100), text: fText.substring(0, 100), elements: fInputs });
          }
        } catch(e) {}
      }
      console.log('[FB send-2fa] Frames:', JSON.stringify(frameDebug));
      console.log('[FB send-2fa] Recaptcha sitekey:', recaptchaSitekey || 'NOT FOUND');

      // Solve reCAPTCHA Enterprise - try multiple approaches
      if (recaptchaSitekey) {
        console.log('[FB send-2fa] Solving reCAPTCHA Enterprise, sitekey:', recaptchaSitekey);
        
        // Approach 1: Try clicking the checkbox directly in the anchor frame
        let checkboxClicked = false;
        for (const frame of page.frames()) {
          if (frame.url().includes('recaptcha/enterprise/anchor')) {
            try {
              // The checkbox is a div with role="checkbox"
              const checkbox = frame.locator('#recaptcha-anchor, .rc-anchor-center-item, [role="checkbox"]').first();
              if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
                await checkbox.click({ timeout: 5000 });
                checkboxClicked = true;
                console.log('[FB send-2fa] Clicked reCAPTCHA checkbox!');
                break;
              }
              // Fallback: click by coordinates
              const box = await checkbox.boundingBox({ timeout: 3000 }).catch(() => null);
              if (box) {
                // Click the center of the checkbox area
                const clickX = box.x + 28; // checkbox is on the left side
                const clickY = box.y + box.height / 2;
                await page.mouse.click(clickX, clickY);
                checkboxClicked = true;
                console.log('[FB send-2fa] Clicked reCAPTCHA via mouse at', clickX, clickY);
                break;
              }
            } catch(e) {
              console.log('[FB send-2fa] Checkbox click error:', e.message);
            }
          }
        }

        if (checkboxClicked) {
          console.log('[FB send-2fa] Waiting for reCAPTCHA to process...');
          await sleep(8000);
          // Check if page advanced
          pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
          for (const frame of page.frames()) {
            try {
              const ft = await frame.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
              if (ft.length > pageText.length) pageText = ft;
            } catch(e) {}
          }
          console.log('[FB send-2fa] After checkbox text:', pageText.substring(0, 300));
          
          // If reCAPTCHA passed, page should no longer show the notice
          if (!pageText.includes('reCAPTCHA') && !pageText.includes('recaptcha')) {
            console.log('[FB send-2fa] reCAPTCHA passed! Page advanced.');
          } else {
            console.log('[FB send-2fa] reCAPTCHA still showing, trying Capsolver...');
          }
        }

        // Approach 2: If checkbox didn't work, use Capsolver
        if (pageText.includes('reCAPTCHA') || pageText.includes('recaptcha')) {
          try {
            const taskId = await createCapsolverTask({
              type: 'ReCaptchaV2EnterpriseTaskProxyLess',
              websiteURL: currentUrl,
              websiteKey: recaptchaSitekey,
              enterprisePayload: {}
            });
            console.log('[FB send-2fa] Capsolver task:', taskId);
            const solution = await getCapsolverResult(taskId);
            if (solution && solution.gRecaptchaResponse) {
              console.log('[FB send-2fa] Capsolver solved! Token length:', solution.gRecaptchaResponse.length);
              // Inject into the fbsbx captcha iframe which wraps the reCAPTCHA
              for (const frame of page.frames()) {
                if (frame.url().includes('fbsbx.com/captcha')) {
                  try {
                    await frame.evaluate((token) => {
                      // Set the token in the hidden input that Facebook reads
                      const input = document.querySelector('input[name="captcha_response"], input[name="recaptcha_response"], #captcha_response');
                      if (input) {
                        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        nativeSetter.call(input, token);
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                      // Also try to call any callback
                      if (window.submitCaptcha) window.submitCaptcha(token);
                      if (window.onCaptchaSolved) window.onCaptchaSolved(token);
                    }, solution.gRecaptchaResponse);
                    console.log('[FB send-2fa] Token injected in fbsbx frame');
                  } catch(e) {
                    console.log('[FB send-2fa] fbsbx inject error:', e.message);
                  }
                }
              }
              // Also inject in recaptcha anchor frame
              for (const frame of page.frames()) {
                if (frame.url().includes('recaptcha/enterprise/anchor')) {
                  try {
                    await frame.evaluate((token) => {
                      document.getElementById('recaptcha-token').value = token;
                      // Trigger the response callback
                      if (window.___grecaptcha_cfg) {
                        const clients = window.___grecaptcha_cfg.clients;
                        for (const id in clients) {
                          const client = clients[id];
                          for (const prop in client) {
                            if (client[prop] && typeof client[prop].callback === 'function') {
                              client[prop].callback(token);
                            }
                          }
                        }
                      }
                    }, solution.gRecaptchaResponse);
                    console.log('[FB send-2fa] Token injected in anchor frame');
                  } catch(e) {}
                }
              }
              await sleep(8000);
              pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
              for (const frame of page.frames()) {
                try {
                  const ft = await frame.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
                  if (ft.length > pageText.length) pageText = ft;
                } catch(e) {}
              }
              console.log('[FB send-2fa] After Capsolver text:', pageText.substring(0, 300));
            }
          } catch(e) {
            console.log('[FB send-2fa] Capsolver error:', e.message);
          }
        }
      }

      // First try Capsolver
      const captchaResult = await solveCaptcha(page);
      if (captchaResult) {
        console.log('[FB send-2fa] CAPTCHA solved!');
        await sleep(2000);
      } else {
        console.log('[FB send-2fa] Capsolver could not detect/solve CAPTCHA');
      }

      // Try to click any visible button to proceed
      let btnClicked = false;
      
      for (const sel of ['button', '[role="button"]', 'a[href]', 'input[type="submit"]']) {
        try {
          const btns = await page.$$(sel);
          for (const btn of btns) {
            try {
              const box = await btn.boundingBox({ timeout: 2000 }).catch(() => null);
              if (box && box.width > 30 && box.height > 15) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                console.log('[FB send-2fa] Clicked:', sel, 'at', Math.round(box.x), Math.round(box.y));
                btnClicked = true;
                break;
              }
            } catch(e) {}
          }
          if (btnClicked) break;
        } catch(e) {}
      }

      if (btnClicked) {
        console.log('[FB send-2fa] Button clicked, waiting 10s...');
        await sleep(10000);
        pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
        for (const frame of page.frames()) {
          try {
            const ft = await frame.evaluate(() => document.body?.innerText?.substring(0, 1500) || '');
            if (ft.length > pageText.length) pageText = ft;
          } catch(e) {}
        }
        console.log('[FB send-2fa] After click text:', pageText.substring(0, 300));
      }
    }

    // If the code input is already visible, just tell user to verify
    const hasCodeInput = await page.$('input[name="approvals_code"]') 
      || await page.$('input[inputmode="numeric"]')
      || await page.$('#approvals_code');
    
    // Check in all frames too
    let codeInputInFrame = false;
    if (!hasCodeInput) {
      for (const frame of page.frames()) {
        try {
          const hasInput = await frame.$('input[name="approvals_code"], input[inputmode="numeric"], #approvals_code, input[type="text"]').catch(() => null);
          if (hasInput) { codeInputInFrame = true; break; }
        } catch(e) {}
      }
    }

    if (hasCodeInput || codeInputInFrame || pageText.includes('Enter login code') || pageText.includes('código de login') || pageText.includes('authentication code')) {
      return { success: true, message: 'Pagina 2FA pronta. O código pode já ter sido enviado para o teu telefone. Chame /fb/verify-2fa {code} com o código recebido.', url: page.url(), pageText: pageText.substring(0, 500), screenshot: ss };
    }

    // Try to click "Get a code" / "Send code" links
    let clicked = false;
    const codeLinkTexts = ['Get a code', 'Obter um código', 'Send code', 'Enviar código', 'Resend code', 'Reenviar código', 'Text me a code', 'Enviar SMS'];
    
    for (const linkText of codeLinkTexts) {
      try {
        const el = page.getByText(linkText, { exact: false }).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.click({ timeout: 5000 });
          console.log('[FB send-2fa] Clicked:', linkText);
          clicked = true;
          break;
        }
      } catch(e) {}
    }

    // Try in all frames
    if (!clicked) {
      for (const frame of page.frames()) {
        const linkResult = await frame.evaluate((texts) => {
          const els = document.querySelectorAll('a, [role="link"], button, [role="button"], span, div');
          for (const el of els) {
            const t = (el.innerText || '').trim().toLowerCase();
            for (const s of texts) {
              if (t.includes(s.toLowerCase()) && t.length < 100) {
                el.click();
                return { clicked: true, text: el.innerText.trim().substring(0, 50) };
              }
            }
          }
          return { clicked: false };
        }, codeLinkTexts).catch(() => ({ clicked: false }));
        if (linkResult.clicked) {
          clicked = true;
          console.log('[FB send-2fa] Clicked in frame:', linkResult.text);
          break;
        }
      }
    }

    // Try submit/continue button in all frames
    if (!clicked) {
      for (const frame of page.frames()) {
        try {
          const btns = await frame.$$('button, [role="button"], input[type="submit"]');
          for (const btn of btns) {
            const txt = await btn.innerText().catch(() => '') || await btn.getAttribute('value').catch(() => '') || '';
            if (/continue|continuar|submit|enviar|get code|send/i.test(txt)) {
              await btn.click();
              clicked = true;
              console.log('[FB send-2fa] Clicked button in frame:', txt);
              break;
            }
          }
          if (clicked) break;
        } catch(e) {}
      }
    }

    await sleep(5000);
    const afterUrl = page.url();
    const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
    const afterFrames = page.frames();
    let fullAfterText = afterText;
    for (const frame of afterFrames) {
      try {
        const ft = await frame.evaluate(() => document.body?.innerText?.substring(0, 1000) || '');
        if (ft.length > fullAfterText.length) fullAfterText = ft;
      } catch(e) {}
    }
    
    console.log('[FB send-2fa] After URL:', afterUrl);
    console.log('[FB send-2fa] After text:', fullAfterText.substring(0, 300));

    if (fullAfterText.includes('Enter login code') || fullAfterText.includes('código de login') || fullAfterText.includes('code has been sent') || fullAfterText.includes('código foi enviado')) {
      return { success: true, message: 'Código 2FA enviado! Verifica o telefone e chame /fb/verify-2fa {code}.', url: afterUrl, pageText: fullAfterText.substring(0, 500), screenshot: ss };
    }

    // Even if we couldn't find text, the code might have been sent already
    return { 
      success: clicked, 
      message: clicked ? 'Botão clicado. Verifica o telefone para o código 2FA e chame /fb/verify-2fa {code}.' : 'Nenhum botão encontrado, mas a página 2FA está ativa. Verifica o telefone e tenta /fb/verify-2fa {code}.', 
      url: afterUrl, 
      pageText: fullAfterText.substring(0, 500), 
      screenshot: ss, 
      needs2FA: true,
      debug: pageDebug || undefined,
      frames: frameDebug && frameDebug.length > 0 ? frameDebug : undefined
    };

  } catch(e) {
    return { success: false, error: e.message };
  }
}

async function fbVerify2FA(code) {
  if (!fb2FA.active || !fb2FA.page) {
    return { success: false, error: 'Nenhum contexto 2FA ativo para Facebook. Chame /fb/login primeiro.' };
  }
  try {
    const page = fb2FA.page;
    const ctx = fb2FA.context;
    const currentUrl = page.url();
    console.log('[FB verify-2fa] URL:', currentUrl, 'code:', code);

    // Find code input - check main page and all frames
    const codeSelectors = [
      'input[name="approvals_code"]',
      '#approvals_code', 
      'input[inputmode="numeric"]',
      'input[type="text"][name*="code"]',
      'input[name="code"]',
      'input[autocomplete="one-time-code"]',
      'input[type="text"]'
    ];

    let filled = false;
    let targetFrame = null;

    // First try main page
    for (const sel of codeSelectors) {
      const input = await page.$(sel).catch(() => null);
      if (input) {
        await page.evaluate((sel, code) => {
          const el = document.querySelector(sel);
          if (el) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(el, code);
            el.dispatchEvent(new Event('focus', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, sel, code);
        filled = true;
        console.log('[FB verify-2fa] Filled code input on main page:', sel);
        break;
      }
    }

    // Try all frames
    if (!filled) {
      for (const frame of page.frames()) {
        for (const sel of codeSelectors) {
          try {
            const input = await frame.$(sel).catch(() => null);
            if (input) {
              await frame.evaluate((sel, code) => {
                const el = document.querySelector(sel);
                if (el) {
                  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                  nativeSetter.call(el, code);
                  el.dispatchEvent(new Event('focus', { bubbles: true }));
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                }
              }, sel, code);
              filled = true;
              targetFrame = frame;
              console.log('[FB verify-2fa] Filled code input in frame:', frame.url().substring(0, 60), sel);
              break;
            }
          } catch(e) {}
        }
        if (filled) break;
      }
    }

    if (!filled) {
      const ss = await page.screenshot({ encoding: 'base64', fullPage: false });
      return { success: false, error: 'Nenhum campo de código encontrado na página.', url: currentUrl, screenshot: ss };
    }

    await sleep(1000);

    // Click submit/continue - try main page and all frames
    let submitted = false;
    const submitSelectors = [
      'button#checkpointSubmitButton',
      'button[name="submit"]',
      '#login_form button[type="submit"]',
      'button[type="submit"]'
    ];

    // Try main page first
    for (const sel of submitSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click({ timeout: 5000 });
          submitted = true;
          console.log('[FB verify-2fa] Clicked submit on main page:', sel);
          break;
        }
      } catch(e) {}
    }

    // Try continue/text button on main page
    if (!submitted) {
      try {
        await page.getByRole('button', { name: /continue|continuar|enviar|submit/i }).first().click({ timeout: 5000 });
        submitted = true;
        console.log('[FB verify-2fa] Clicked Continue on main page');
      } catch(e) {}
    }

    // Try all frames
    if (!submitted) {
      for (const frame of page.frames()) {
        try {
          const btns = await frame.$$('button, [role="button"], input[type="submit"]');
          for (const btn of btns) {
            const txt = await btn.innerText().catch(() => '') || await btn.getAttribute('value').catch(() => '') || '';
            if (/continue|continuar|submit|enviar|save|salvar/i.test(txt) && txt.length < 50) {
              await btn.click();
              submitted = true;
              console.log('[FB verify-2fa] Clicked button in frame:', txt);
              break;
            }
          }
          if (submitted) break;
        } catch(e) {}
      }
    }

    // Last resort: Enter key on main page
    if (!submitted) {
      await page.keyboard.press('Enter');
      submitted = true;
      console.log('[FB verify-2fa] Pressed Enter');
    }

    await sleep(8000);
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log('[FB verify-2fa] After URL:', afterUrl);
    console.log('[FB verify-2fa] After text:', afterText.substring(0, 200));

    // Check if we got past 2FA
    if (!afterUrl.includes('checkpoint') && !afterUrl.includes('two_factor') && !afterUrl.includes('challenge')) {
      // Check for save device / trusted browser prompt
      const hasSaveDevice = afterText.includes('Save this device') || afterText.includes('Salvar') || afterText.includes('save browser') || afterText.includes('trusted');
      if (hasSaveDevice) {
        try {
          await page.getByRole('button', { name: /continue|continuar|save|salvar|don't save|nao salvar/i }).first().click({ timeout: 5000 }).catch(() => {});
          await sleep(5000);
        } catch(e) {}
      }

      // Try to finalize login
      await page.goto('https://www.facebook.com/', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
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
      const xsCookie = finalCookies.find(c => c.name === 'xs');
      
      if (userId || xsCookie) {
        sessions.fb = { cookies: finalCookies, loggedIn: true, userId: userId ? userId.value : null, dtsg: fbDtsg, expiresAt: Date.now() + 3600000 };
        fb2FA.active = false; fb2FA.page = null; fb2FA.context = null;
        console.log('[FB] 2FA OK! userId=' + (userId ? userId.value : 'null'));
        await ctx.close();
        return { success: true, message: 'Login com 2FA bem-sucedido!', method: '2fa_verified' };
      }
    }

    // Still on 2FA page - code might be wrong
    const hasError = afterText.includes('incorrect') || afterText.includes('incorret') || afterText.includes('invalid') || afterText.includes('Wrong code') || afterText.includes('Código incorreto');
    if (hasError) {
      const ss = await page.screenshot({ encoding: 'base64', fullPage: false });
      return { success: false, error: 'Código 2FA incorreto.', url: afterUrl, pageText: afterText.substring(0, 300), screenshot: ss };
    }

    // Keep context alive for retry
    const ss = await page.screenshot({ encoding: 'base64', fullPage: false });
    return { success: false, error: 'Estado incerto após 2FA. Pode tentar novamente com /fb/verify-2fa.', url: afterUrl, pageText: afterText.substring(0, 300), screenshot: ss, needs2FA: true };

  } catch(e) {
    return { success: false, error: e.message };
  }
}

// --- TIKTOK LOGIN + CAPTCHA ---

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
    await page.goto('https://www.tiktok.com/login', { waitUntil: 'load', timeout: 45000 });
    await sleep(3000);

    // Take screenshot to debug login page state
    const loginSs = await page.screenshot({ encoding: 'base64', fullPage: false });
    const loginPageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    console.log('[TT] Login page text:', loginPageText.substring(0, 200));

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
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});

    const afterUrl = page.url();
    console.log('[TT] After login URL:', afterUrl);

    // CAPTCHA detection + solving
    if (afterUrl.includes('verify') || afterUrl.includes('captcha') || afterUrl.includes('challenge')) {
      console.log('[TT] CAPTCHA detected! Solving...');
      const screenshot2 = await page.screenshot({ encoding: 'base64', fullPage: false });

      const captchaResult = await checkAndSolveCaptcha(page, 'button[data-e2e="login-button"]');
      if (captchaResult.solved) {
        await sleep(5000);
        await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
        const afterCaptchaUrl = page.url();
        console.log('[TT] After CAPTCHA URL:', afterCaptchaUrl);

        if (!afterCaptchaUrl.includes('login') && !afterCaptchaUrl.includes('verify') && !afterCaptchaUrl.includes('captcha')) {
          // Verify session is actually valid by checking for logged-in indicators
          const validSession = await verifyTTSession(page);
          if (validSession) {
            const lsData = await page.evaluate(() => { try { return JSON.stringify(localStorage); } catch(e) { return '{}'; } });
            sessions.tt = { cookies: await ctx.cookies(), loggedIn: true, expiresAt: Date.now() + 3600000, localStorage: lsData };
            console.log('[TT] Login OK after CAPTCHA!');
            await ctx.close();
            return { success: true, method: 'captcha_solved' };
          }
        }
      }

      await ctx.close();
      return { success: false, error: 'CAPTCHA nao resolvido', needsCaptcha: true, screenshot: screenshot2 };
    }

    // Verify session is actually valid (verifyTTSession navigates to @me)
    const validSession = await verifyTTSession(page);
    if (validSession) {
      // Save localStorage for session transfer (TikTok stores auth tokens there)
      let lsData = '{}';
      try { lsData = await page.evaluate(() => JSON.stringify(localStorage)); } catch(e) { console.log('[TT] localStorage save error:', e.message.substring(0, 80)); }
      sessions.tt = { cookies: await ctx.cookies(), loggedIn: true, expiresAt: Date.now() + 3600000, localStorage: lsData };
      console.log('[TT] Login OK!');
      await ctx.close();
      return { success: true };
    }

    const failSs = await page.screenshot({ encoding: 'base64', fullPage: false });
    const failText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    await ctx.close();
    return { success: false, error: 'Login falhou - sessao invalida', url: page.url(), pageText: failText, screenshot: failSs };
  } catch (err) {
    console.error('[TT] Login error:', err.message);
    try { await ctx.close(); } catch(e) {}
    return { success: false, error: err.message };
  }
}

// Verify TikTok session is actually valid (not a guest session)
async function verifyTTSession(page) {
  try {
    // Navigate to /@me to force authentication check
    const currentUrl = page.url();
    if (!currentUrl.includes('/@me')) {
      await page.goto('https://www.tiktok.com/@me', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await sleep(3000);
    }
    
    const url = page.url();
    console.log('[TT] verifyTTSession URL after @me:', url);
    
    // KEY CHECK: If /@me didn't redirect to /login, user IS logged in
    // TikTok ALWAYS redirects unauthenticated /@me to /login
    if (url.includes('/login')) {
      console.log('[TT] @me redirected to login - NOT logged in');
      return false;
    }
    
    // Secondary: check page content for profile indicators
    const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
    // Real profiles show follower counts, not login prompts
    const hasFollowers = pageText.match(/\d+\.?\d*K?\s*Seguidores/i);
    const hasRealProfile = hasFollowers || pageText.includes('Editar perfil') || pageText.includes('Edit profile');
    
    const isValid = hasRealProfile || url.includes('/@me');
    console.log('[TT] Session valid:', isValid, 'hasFollowers:', !!hasFollowers, 'hasRealProfile:', hasRealProfile, 'url:', url);
    return isValid;
  } catch(e) {
    console.log('[TT] verifyTTSession error:', e.message);
    return false;
  }
}

// ============================================
// TIKTOK SEND DM
// ============================================

async function ttSendDM(targetUsername, message, useProxy = true) {
  const loginResult = await ttLogin();
  if (!loginResult.success) return loginResult;

  console.log('[TT] Sending DM to @' + targetUsername);
  const ctx = await createContext(false, useProxy);
  const page = await ctx.newPage();
  await page.addInitScript(STEALTH_JS);

  // Navigate to tiktok.com first to set domain for cookies
  await page.goto('https://www.tiktok.com', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await ctx.addCookies(sessions.tt.cookies);
  
  // Restore localStorage (TikTok stores auth tokens here)
  if (sessions.tt.localStorage) {
    try {
      await page.evaluate((lsJson) => {
        const items = JSON.parse(lsJson);
        for (const [key, value] of Object.entries(items)) {
          try { localStorage.setItem(key, value); } catch(e) {}
        }
      }, sessions.tt.localStorage);
      console.log('[TT] Restored localStorage');
    } catch(e) {
      console.log('[TT] localStorage restore error:', e.message.substring(0, 80));
    }
  } else {
    console.log('[TT] WARNING: No localStorage saved from login');
  }

  try {
    // Navigate to target profile
    console.log('[TT] Navigating to profile...');
    await page.goto('https://www.tiktok.com/@' + encodeURIComponent(targetUsername), { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await sleep(5000);

    const profileUrl = page.url();
    const profileTitle = await page.title().catch(() => '');
    console.log('[TT] Profile URL:', profileUrl, 'Title:', profileTitle);

    // Check if redirected to login
    if (profileUrl.includes('/login') || profileTitle.toLowerCase().includes('login') || profileTitle.toLowerCase().includes('tiktok - make')) {
      const ss = await page.screenshot({ encoding: 'base64', fullPage: false });
      await ctx.close();
      sessions.tt = { cookies: null, loggedIn: false, expiresAt: 0 };
      return { success: false, error: 'Sessao TT expirada, refaz login', screenshot: ss };
    }

    // Extract userId for API fallback
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
    console.log('[TT] Target userId:', userId || 'not found');

    const debugSs = await page.screenshot({ encoding: 'base64', fullPage: false });

    // === METHOD 1: UI - Click Message button on profile (most reliable) ===
    console.log('[TT] Looking for Message button (UI method)...');

    // Strategy A: data-e2e selectors (TikTok's test attributes)
    let msgBtn = null;
    const e2eSelectors = [
      '[data-e2e="profile-icon-message"]',
      'button[data-e2e*="message"]',
      'div[data-e2e*="message"]',
      'span[data-e2e*="message"]',
    ];
    for (const sel of e2eSelectors) {
      try {
        const els = await page.$$(sel);
        for (const el of els) {
          const box = await el.boundingBox().catch(() => null);
          if (box && box.width > 0 && box.height > 0) {
            msgBtn = el;
            console.log('[TT] Found via e2e:', sel);
            break;
          }
        }
        if (msgBtn) break;
      } catch(e) {}
    }

    // Strategy B: Exact text match on buttons/links
    if (!msgBtn) {
      const textBtns = ['Message', 'Mensagem', 'Enviar mensagem', 'Send message'];
      for (const txt of textBtns) {
        try {
          const locator = page.locator('button, a, div[role="button"], span[role="button"]').filter({ hasText: txt }).first();
          const box = await locator.boundingBox({ timeout: 2000 }).catch(() => null);
          if (box && box.width > 0) {
            msgBtn = locator;
            console.log('[TT] Found via text:', txt);
            break;
          }
        } catch(e) {}
      }
    }

    // Strategy C: 3-dot menu -> Send message
    if (!msgBtn) {
      console.log('[TT] Trying 3-dot menu...');
      try {
        const moreSel = '[data-e2e="profile-icon-more"], [data-e2e*="more"], button[aria-label*="More" i]';
        const moreBtn = await page.$(moreSel);
        if (moreBtn) {
          const box = await moreBtn.boundingBox().catch(() => null);
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            await sleep(2500);
            // Look for send message option in dropdown
            const ddOptions = ['Send message', 'Enviar mensagem', 'Mensagem'];
            for (const opt of ddOptions) {
              try {
                const ddItem = page.locator('div, span, a, button').filter({ hasText: opt }).first();
                const ddBox = await ddItem.boundingBox({ timeout: 1500 }).catch(() => null);
                if (ddBox && ddBox.width > 0) {
                  msgBtn = ddItem;
                  console.log('[TT] Found in dropdown:', opt);
                  break;
                }
              } catch(e) {}
            }
          }
        }
      } catch(e) {
        console.log('[TT] 3-dot menu error:', e.message.substring(0, 80));
      }
    }

    // Strategy D: Get all clickable elements and find one near "Message" text
    if (!msgBtn) {
      console.log('[TT] Trying broad search...');
      try {
        const result = await page.evaluate(() => {
          const allEls = document.querySelectorAll('button, a, div[role="button"], span[role="button"], [tabindex="0"]');
          for (const el of allEls) {
            const text = (el.innerText || '').trim().toLowerCase();
            if (text === 'message' || text === 'mensagem' || text === 'enviar mensagem' || text === 'send message') {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return { index: Array.from(allEls).indexOf(el), text: el.innerText.trim(), w: rect.width, h: rect.height };
              }
            }
          }
          return null;
        });
        if (result && result.index >= 0) {
          const allEls = await page.$$('button, a, div[role="button"], span[role="button"], [tabindex="0"]');
          if (allEls[result.index]) msgBtn = allEls[result.index];
          console.log('[TT] Found via broad search:', result.text);
        }
      } catch(e) {}
    }

    if (msgBtn) {
      // Click the Message button
      console.log('[TT] Clicking Message button...');
      const btnBox = await msgBtn.boundingBox().catch(() => null);
      if (btnBox) {
        await page.mouse.click(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
      } else {
        await msgBtn.click();
      }

      console.log('[TT] Waiting for chat to open...');
      await sleep(6000);

      // Look for chat input (TikTok uses contenteditable div)
      const chatInputSelectors = [
        'div[contenteditable="true"]',
        'div[data-e2e="chat-input"]',
        'textarea[data-e2e="chat-input"]',
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="mensagem" i]',
        'input[type="text"][data-e2e="chat-input"]',
        'div[role="textbox"]',
        '[data-e2e="chat-input"]',
      ];

      let chatInput = null;
      for (const sel of chatInputSelectors) {
        try {
          const el = await page.$(sel);
          if (el) {
            const box = await el.boundingBox().catch(() => null);
            if (box && box.width > 0 && box.height > 0) {
              chatInput = el;
              console.log('[TT] Found chat input:', sel);
              break;
            }
          }
        } catch(e) {}
      }

      if (chatInput) {
        await chatInput.click();
        await sleep(800);

        // Detect tag to choose fill method
        const tag = await chatInput.evaluate(el => el.tagName.toLowerCase());
        console.log('[TT] Input tag:', tag);

        if (tag === 'div') {
          // Contenteditable div - keyboard typing required
          await page.keyboard.type(message, { delay: 80 });
        } else {
          // Regular input/textarea - use fill
          await chatInput.fill(message);
        }

        await sleep(500);

        // Send: try Enter, then look for send button
        await page.keyboard.press('Enter');
        console.log('[TT] Pressed Enter to send');
        await sleep(3000);

        // Try clicking a send button if Enter didn't work
        const sendBtn = await page.$('[data-e2e="chat-send"], button[aria-label*="Send" i], div[aria-label*="Send" i], button[data-e2e*="send"]');
        if (sendBtn) {
          const sbBox = await sendBtn.boundingBox().catch(() => null);
          if (sbBox) {
            await page.mouse.click(sbBox.x + sbBox.width / 2, sbBox.y + sbBox.height / 2);
            console.log('[TT] Clicked send button');
            await sleep(2000);
          }
        }

        const afterSs = await page.screenshot({ encoding: 'base64', fullPage: false });
        const afterText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
        console.log('[TT] After send text:', afterText.substring(0, 200));

        await ctx.close();
        return { success: true, platform: 'TikTok', recipient: targetUsername, method: 'browser_ui', screenshot: afterSs };
      } else {
        // Chat input not found - might need to handle a different UI state
        const noInputSs = await page.screenshot({ encoding: 'base64', fullPage: false });
        const noInputText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
        console.log('[TT] No chat input found. Page text:', noInputText.substring(0, 200));
        await ctx.close();
        return { success: false, error: 'Chat input nao encontrado apos clicar Message', url: page.url(), pageText: noInputText.substring(0, 500), screenshot: noInputSs };
      }
    }

    // === METHOD 2: API fallback ===
    if (!userId) {
      await ctx.close();
      return { success: false, error: 'Nenhum botao de mensagem encontrado e userId nao detectado para @' + targetUsername, screenshot: debugSs };
    }

    console.log('[TT] UI method failed, trying API method...');
    const cookies = sessions.tt.cookies.map(c => c.name + '=' + c.value).join('; ');
    const msToken = sessions.tt.cookies.find(c => c.name === 'msToken');
    let verifyFp = '';
    try {
      verifyFp = await page.evaluate(() => {
        if (window.byted_acrawler) return window.byted_acrawler.sign || '';
        for (const s of document.querySelectorAll('script')) {
          const m = s.textContent.match(/verifyFp['":\s]+['"]([^'"]+)['"]/);
          if (m) return m[1];
        }
        return document.cookie.split('; ').find(c => c.startsWith('s_v_web_id='))?.replace('s_v_web_id=', '') || '';
      });
    } catch(e) {}

    let freshMsToken = msToken ? msToken.value : '';
    if (!freshMsToken) {
      try {
        freshMsToken = await page.evaluate(() => {
          if (window.__msToken) return window.__msToken;
          const meta = document.querySelector('meta[name="msToken"]');
          if (meta) return meta.getAttribute('content');
          return '';
        });
      } catch(e) {}
    }

    const sendResult = await page.evaluate(async ({ cookies, userId, message, msToken, verifyFp }) => {
      const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies };
      if (msToken) headers['X-Ms-Token'] = msToken;
      try {
        const createParams = new URLSearchParams({ to_user_id: userId, from: 'webapp', count: '1', verifyFp: verifyFp || '' });
        const createResp = await fetch('https://www.tiktok.com/api/chat/create/', { method: 'POST', headers, body: createParams.toString(), credentials: 'include' });
        const createBody = await createResp.text();
        let roomId = null;
        try { const cd = JSON.parse(createBody); roomId = cd.data?.room_id || cd.room_id || cd.id; } catch(e) {}
        const sendParams = new URLSearchParams({ recipient_user_id: userId, message_type: 'text', content: message, client_message_id: crypto.randomUUID(), from: 'webapp' });
        if (roomId) sendParams.append('room_id', roomId);
        if (verifyFp) sendParams.append('verifyFp', verifyFp);
        const sendResp = await fetch('https://www.tiktok.com/api/chat/send_message/', { method: 'POST', headers, body: sendParams.toString(), credentials: 'include' });
        const sendBody = await sendResp.text();
        return { createStatus: createResp.status, sendStatus: sendResp.status, sendBody: sendBody.substring(0, 500), roomId };
      } catch(e) { return { error: e.message }; }
    }, { cookies, userId, message, msToken: freshMsToken, verifyFp });

    console.log('[TT] API result:', JSON.stringify(sendResult).substring(0, 500));
    const sendParsed = typeof sendResult.sendBody === 'string' ? (() => { try { return JSON.parse(sendResult.sendBody); } catch(e) { return {}; }})() : {};
    if (sendParsed.status_code === '0' || sendParsed.data || sendParsed.message_id) {
      await ctx.close();
      return { success: true, platform: 'TikTok', recipient: targetUsername, method: 'api' };
    }

    // === METHOD 3: Navigate to inbox and try from there ===
    console.log('[TT] API also failed, trying inbox...');
    await page.goto('https://www.tiktok.com/messages', { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await sleep(3000);
    const inboxText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
    const inboxSs = await page.screenshot({ encoding: 'base64', fullPage: false });
    console.log('[TT] Inbox text:', inboxText.substring(0, 200));

    await ctx.close();
    return { success: false, error: 'Todos metodos falharam para @' + targetUsername, apiDetails: sendResult, screenshot: inboxSs };
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
    const { phone } = req.body;
    const result = await igSend2FA(phone || '+244925049405');
    res.json(result);
  }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/ig/verify-2fa', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, error: 'Codigo invalido (4-8 digitos)' });
    const result = await igVerify2FA(code); res.json(result);
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

app.post('/fb/send-2fa', authMiddleware, async (req, res) => {
  try { const result = await fbSend2FA(); res.json(result); }
  catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.post('/fb/verify-2fa', authMiddleware, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !/^\d{4,8}$/.test(code)) return res.status(400).json({ success: false, error: 'Codigo invalido (4-8 digitos)' });
    const result = await fbVerify2FA(code);
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
    tt: { cookies: null, loggedIn: false, expiresAt: 0, localStorage: null }
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