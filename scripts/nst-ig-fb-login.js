/**
 * Aura v4 — NSTBrowser IG & FB Login Automation
 * 
 * Uses NSTBrowser API + Puppeteer (puppeteer-core) to automate
 * Instagram and Facebook login with anti-detect browser profiles.
 * 
 * Requires: NSTBrowser client running locally on port 8899
 * 
 * CommonJS only. Uses puppeteer-core (no bundled Chromium).
 */

const puppeteer = require('puppeteer-core');

// ─── Config ───────────────────────────────────────────────────────────
const NST_BASE_URL = 'http://127.0.0.1:8899';

const IG_CREDS = {
  username: 'jesuaine07',
  password: 'X2VpFZY@)u-H%89',
};

const FB_CREDS = {
  phone: '+244925049405',
  password: 'Jesus888@',
};

// ─── NSTBrowser API Helpers ──────────────────────────────────────────

/**
 * Check if NSTBrowser local API is reachable.
 */
async function checkNSTBrowserRunning() {
  try {
    const res = await fetch(`${NST_BASE_URL}/`, { method: 'GET', signal: AbortSignal.timeout(5000) });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Create an NSTBrowser anti-detect profile.
 * @param {object} options - Profile config (name, platform)
 * @returns {object} The created profile data
 */
async function createNSTProfile({ name, platform = 'windows', note = '' }) {
  const body = {
    name,
    platform,
    note: note || `Aura v4 profile - ${name}`,
    // Anti-detect settings
    config: {
      fingerprint: {
        canvas: 'random',
        webgl: 'random',
        audio: 'random',
        font: 'random',
      },
    },
  };

  console.log(`[NST] Creating profile "${name}"...`);
  const res = await fetch(`${NST_BASE_URL}/profile/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NST profile creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`[NST] Profile created! ID: ${data.data?.id || data.id || 'unknown'}`);
  return data;
}

/**
 * Connect to an NSTBrowser profile and return a Puppeteer browser instance.
 * @param {string} profileId - The NSTBrowser profile ID
 * @param {boolean} headless - Whether to run in headless mode
 * @returns {Promise<{ browser, page, wsUrl, debugUrl }>}
 */
async function connectToProfile(profileId, headless = false) {
  console.log(`[NST] Connecting to profile ${profileId} (headless: ${headless})...`);

  const params = new URLSearchParams({
    id: profileId,
    headless: headless ? '1' : '0',
  });

  const res = await fetch(`${NST_BASE_URL}/connect?${params.toString()}`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NST connect failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const wsUrl = data.data?.ws?.puppeteer || data.data?.ws || data.ws;
  const debugUrl = data.data?.ws?.selenium || data.data?.debugUrl || null;

  if (!wsUrl) {
    throw new Error(`No WebSocket URL returned. Full response: ${JSON.stringify(data)}`);
  }

  console.log(`[NST] WebSocket URL received: ${wsUrl.substring(0, 60)}...`);
  if (debugUrl) {
    console.log(`[NST] Debug URL: ${debugUrl}`);
  }

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsUrl,
    defaultViewport: { width: 1280, height: 800 },
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  return { browser, page, wsUrl, debugUrl };
}

/**
 * Login to Instagram via browser automation.
 * Strategy: Visit homepage first (avoid 429), then navigate to login.
 */
async function loginInstagram(page) {
  const { username, password } = IG_CREDS;
  console.log(`\n[IG] Starting Instagram login for @${username}...`);

  try {
    // Step 1: Visit homepage first to warm cookies / avoid 429
    console.log('[IG] Step 1: Navigating to instagram.com homepage...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 3000)); // let the page settle
    console.log('[IG] Homepage loaded.');

    // Step 2: Navigate to login page
    console.log('[IG] Step 2: Navigating to login page...');
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Fill username
    console.log('[IG] Step 3: Filling username...');
    const usernameInput = await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type(username, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));

    // Step 4: Fill password
    console.log('[IG] Step 4: Filling password...');
    const passwordInput = await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type(password, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));

    // Step 5: Click login button
    console.log('[IG] Step 5: Clicking login button...');
    const loginBtn = await page.waitForSelector('button[type="submit"]', { timeout: 10000 });
    await loginBtn.click();

    // Step 6: Wait for navigation / login completion
    console.log('[IG] Step 6: Waiting for login to complete (up to 30s)...');
    try {
      await page.waitForFunction(
        () => {
          // Check if we left the login page
          return !window.location.pathname.includes('/accounts/login');
        },
        { timeout: 30000 }
      );
      console.log(`[IG] ✅ Login successful! Current URL: ${page.url()}`);
    } catch (waitErr) {
      // Check if there's an error message on the page
      const errorEl = await page.$('.cpIbm, ._ac6e, [role="alert"]');
      if (errorEl) {
        const errorText = await page.evaluate(el => el.textContent, errorEl);
        console.error(`[IG] ❌ Login error on page: ${errorText}`);
      } else {
        console.warn('[IG] ⚠️ Could not confirm login within timeout. Page may still be loading.');
        console.warn(`[IG] Current URL: ${page.url()}`);
      }
    }

    // Step 7: Handle "Save Login Info" popup if present
    try {
      const notNowBtn = await page.waitForSelector('button', { timeout: 5000 });
      const btnText = await page.evaluate(el => el.textContent, notNowBtn);
      if (btnText.includes('Not Now') || btnText.includes('Agora não')) {
        await notNowBtn.click();
        console.log('[IG] Dismissed "Save Login Info" prompt.');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      // No popup, that's fine
    }

    // Step 8: Handle notifications popup
    try {
      const notNowBtn = await page.waitForSelector('button', { timeout: 5000 });
      const btnText = await page.evaluate(el => el.textContent, notNowBtn);
      if (btnText.includes('Not Now') || btnText.includes('Agora não')) {
        await notNowBtn.click();
        console.log('[IG] Dismissed notifications prompt.');
      }
    } catch (e) {
      // No popup
    }

    console.log(`[IG] Final URL: ${page.url()}`);
    return true;
  } catch (err) {
    console.error(`[IG] ❌ Login automation failed: ${err.message}`);
    return false;
  }
}

/**
 * Login to Facebook via browser automation.
 */
async function loginFacebook(page) {
  const { phone, password } = FB_CREDS;
  console.log(`\n[FB] Starting Facebook login for ${phone}...`);

  try {
    // Step 1: Navigate to facebook.com
    console.log('[FB] Step 1: Navigating to facebook.com...');
    await page.goto('https://www.facebook.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await new Promise(r => setTimeout(r, 3000));
    console.log('[FB] Facebook loaded.');

    // Step 2: Fill phone/email
    console.log('[FB] Step 2: Filling phone number...');
    const emailInput = await page.waitForSelector('#email', { timeout: 15000 });
    await emailInput.click({ clickCount: 3 });
    await emailInput.type(phone, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));

    // Step 3: Fill password
    console.log('[FB] Step 3: Filling password...');
    const passInput = await page.waitForSelector('#pass', { timeout: 10000 });
    await passInput.click({ clickCount: 3 });
    await passInput.type(password, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));

    // Step 4: Press Enter to submit
    console.log('[FB] Step 4: Pressing Enter to submit...');
    await passInput.press('Enter');

    // Step 5: Wait for login
    console.log('[FB] Step 5: Waiting for login to complete (up to 30s)...');
    try {
      await page.waitForFunction(
        () => {
          // Check if we're no longer on the login page
          const url = window.location.href;
          return !url.includes('/login') && !url.includes('login.php');
        },
        { timeout: 30000 }
      );
      console.log(`[FB] ✅ Login successful! Current URL: ${page.url()}`);
    } catch (waitErr) {
      // Check for error messages
      const errorEl = await page.$('#error_box, .login_error_box, [role="alert"]');
      if (errorEl) {
        const errorText = await page.evaluate(el => el.textContent, errorEl);
        console.error(`[FB] ❌ Login error on page: ${errorText}`);
      } else {
        console.warn('[FB] ⚠️ Could not confirm login within timeout.');
        console.warn(`[FB] Current URL: ${page.url()}`);
      }
    }

    console.log(`[FB] Final URL: ${page.url()}`);
    return true;
  } catch (err) {
    console.error(`[FB] ❌ Login automation failed: ${err.message}`);
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Aura v4 — NSTBrowser IG & FB Login        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Check if NSTBrowser is running
  console.log(`[CHECK] Pinging NSTBrowser at ${NST_BASE_URL}...`);
  const isRunning = await checkNSTBrowserRunning();
  if (!isRunning) {
    console.error('');
    console.error('❌ NSTBrowser is NOT running locally!');
    console.error('');
    console.error('To fix this:');
    console.error('  1. Install NSTBrowser from https://www.nstbrowser.com/');
    console.error('  2. Open NSTBrowser and make sure it is running');
    console.error(`  3. Verify the API is accessible at ${NST_BASE_URL}`);
    console.error('  4. Re-run this script');
    console.error('');
    process.exitCode = 1;
    return;
  }
  console.log('[CHECK] ✅ NSTBrowser is running!');

  let igBrowser = null;
  let fbBrowser = null;

  try {
    // ── Instagram Login ────────────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log('  INSTAGRAM LOGIN');
    console.log('═'.repeat(50));

    const igProfile = await createNSTProfile({ name: 'aura-ig-jesuaine07' });
    const igProfileId = igProfile.data?.id || igProfile.id;

    const ig = await connectToProfile(igProfileId, false);
    igBrowser = ig.browser;
    if (ig.debugUrl) console.log(`[IG] Debug URL: ${ig.debugUrl}`);

    await loginInstagram(ig.page);

    // Keep IG browser open for a moment so user can verify
    console.log('[IG] Keeping browser open for 10 seconds for verification...');
    await new Promise(r => setTimeout(r, 10000));

    // ── Facebook Login ─────────────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log('  FACEBOOK LOGIN');
    console.log('═'.repeat(50));

    const fbProfile = await createNSTProfile({ name: 'aura-fb-mwango' });
    const fbProfileId = fbProfile.data?.id || fbProfile.id;

    const fb = await connectToProfile(fbProfileId, false);
    fbBrowser = fb.browser;
    if (fb.debugUrl) console.log(`[FB] Debug URL: ${fb.debugUrl}`);

    await loginFacebook(fb.page);

    console.log('\n[FB] Keeping browser open for 10 seconds for verification...');
    await new Promise(r => setTimeout(r, 10000));

    // ── Done ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(50));
    console.log('  ✅ All login automations completed!');
    console.log('═'.repeat(50));

  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    // Disconnect browsers (but keep NST profiles alive)
    if (igBrowser) {
      try { await igBrowser.disconnect(); } catch (e) { /* ignore */ }
    }
    if (fbBrowser) {
      try { await fbBrowser.disconnect(); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = {
  checkNSTBrowserRunning,
  createNSTProfile,
  connectToProfile,
  loginInstagram,
  loginFacebook,
};

if (require.main === module) {
  main();
}
