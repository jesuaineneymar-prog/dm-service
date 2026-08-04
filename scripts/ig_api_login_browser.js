const puppeteer = require('puppeteer-core');

const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';
const USERNAME = process.argv[2] || 'mwango_brain';
const PASSWORD = process.argv[3] || 'Jarvis99!';
const TARGET = process.argv[4] || 'instagram';
const MESSAGE = process.argv[5] || 'Ola! Teste Mwango Brain. Ignora esta msg.';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('Connecting to Bright Data...');
  const browser = await puppeteer.connect({
    browserWSEndpoint: WS,
    defaultViewport: { width: 1280, height: 800 },
  });

  let page;
  const existing = await browser.pages();
  page = existing[0];
  if (!page || page.url() === 'about:blank') page = await browser.newPage();

  // === STEP 1: Navigate to Instagram to get CSRF token ===
  console.log('[1] Getting CSRF token...');
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch(e) { console.log('  timeout, continuing...'); }
  await sleep(5000);

  // Get CSRF token from cookies
  const cookies = await page.cookies();
  let csrftoken = '';
  for (const c of cookies) { if (c.name === 'csrftoken') { csrftoken = c.value; break; } }
  console.log('  CSRF:', csrftoken ? csrftoken.substring(0, 15) + '...' : 'NOT FOUND');
  if (!csrftoken) { console.log('ERROR: No CSRF token'); process.exit(1); }

  // Get encryption key and other params from page
  const pageParams = await page.evaluate(() => {
    // Instagram embeds config in the page
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const text = s.textContent || '';
      const match = text.match(/"server_checks"\s*:\s*"([^"]+)"/);
      if (match) return { serverChecks: match[1] };
    }
    // Get the encryption key from bundled JS
    return { bundlingVersion: '1' };
  });
  console.log('  Page params:', JSON.stringify(pageParams));

  // === STEP 2: Login via fetch API (inside browser context = same IP/fingerprint) ===
  console.log('[2] Logging in via fetch API...');

  // Generate enc_password manually in browser context (avoids Bright Data restriction)
  const loginResult = await page.evaluate(async ({ username, password, csrftoken }) => {
    try {
      // Instagram's enc_password format for web
      const timestamp = Math.floor(Date.now() / 1000).toString();
      // Key for web login (this is the public key Instagram uses)
      const key = 'iN4$aGr0m';
      let encPass = '';
      for (let i = 0; i < password.length; i++) {
        encPass += (password.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0');
      }
      const encPassword = '#PWD_INSTAGRAM_BROWSER:0:' + timestamp + ':' + encPass;

      const resp = await fetch('https://www.instagram.com/api/v1/accounts/login/ajax/1/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': csrftoken,
          'X-IG-App-ID': '936619743392459',
          'X-Instagram-AJAX': '1',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: new URLSearchParams({
          username: username,
          enc_password: encPassword,
          queryParams: JSON.stringify({source: 'nav', next: '/'}),
          optIntoOneTap: 'false',
          stopDeletion: 'false',
          trustedDeviceRecords: '{}',
        }),
        credentials: 'include',
      });

      const text = await resp.text();
 let data;
      try { data = JSON.parse(text); } catch(e) { data = { parseError: true, text: text.substring(0, 500) }; }
      return { status: resp.status, headers: Object.fromEntries(resp.headers.entries()), data: data };
    } catch(e) {
      return { error: e.message };
    }
  }, { username: USERNAME, password: PASSWORD, csrftoken });

  console.log('  Login status:', loginResult.status || loginResult.error);
  if (loginResult.headers) {
    console.log('  Response headers:', JSON.stringify(loginResult.headers).substring(0, 300));
  }
  if (loginResult.data) {
    const d = loginResult.data;
    console.log('  authenticated:', d.authenticated);
    console.log('  user:', d.user || d.logged_in_user?.username || 'unknown');
    console.log('  userId:', d.userId || d.logged_in_user?.pk || 'unknown');
    if (d.two_factor_required) console.log('  *** 2FA REQUIRED ***');
    if (d.message) console.log('  message:', d.message);
    if (d.error_type) console.log('  error_type:', d.error_type);
    if (d.status) console.log('  ig_status:', d.status);
    if (d.ig_profile) console.log('  profile:', d.ig_profile);
    if (d.checkpoint) console.log('  *** CHECKPOINT ***');
  }

  const loggedIn = loginResult.data?.authenticated || loginResult.data?.loggedIn;
  if (!loggedIn) {
    console.log('\nLogin failed! Trying alternative enc_password...');
    // Try without encryption
    const altResult = await page.evaluate(async ({ username, password, csrftoken }) => {
      try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const encPassword = '#PWD_INSTAGRAM_BROWSER:0:' + timestamp + ':' + password;
        const resp = await fetch('https://www.instagram.com/api/v1/accounts/login/ajax/1/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrftoken,
            'X-IG-App-ID': '936619743392459',
            'X-Instagram-AJAX': '1',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: new URLSearchParams({
            username: username,
            enc_password: encPassword,
            queryParams: JSON.stringify({source: 'nav', next: '/'}),
            optIntoOneTap: 'false',
            stopDeletion: 'false',
            trustedDeviceRecords: '{}',
          }),
          credentials: 'include',
        });
        const text = await resp.text();
        let data;
        try { data = JSON.parse(text); } catch(e) { data = { parseError: true, text: text.substring(0, 500) }; }
        return { status: resp.status, data: data };
      } catch(e) { return { error: e.message }; }
    }, { username: USERNAME, password: PASSWORD, csrftoken });
    console.log('  Alt login status:', altResult.status || altResult.error);
    if (altResult.data) {
      console.log('  authenticated:', altResult.data.authenticated);
      console.log('  message:', altResult.data.message);
      console.log('  error_type:', altResult.data.error_type);
    }
  }

  // Check if we got session cookies
  const postCookies = await page.cookies();
  let sessionId = '';
  for (const c of postCookies) { if (c.name === 'sessionid') { sessionId = c.value; break; } }
  console.log('  sessionid:', sessionId ? sessionId.substring(0, 15) + '...' : 'NOT SET');

  if (!sessionId) {
    console.log('\nNo session obtained. Cannot send DM.');
    // Take screenshot for debug
    const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
    if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_login_fail.png', Buffer.from(ss, 'base64'));
    process.exit(1);
  }

  // === STEP 3: Reload to get logged-in state ===
  console.log('\n[3] Reloading page with session...');
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await sleep(6000);
  const loggedInText = await page.evaluate(() => document.body?.innerText.substring(0, 200) || '');
  console.log('  Has feed:', !!(await page.$('main').catch(() => null)));
  console.log('  Has login form:', loggedInText.includes('Log into Instagram'));

  // === STEP 4: Navigate to target profile ===
  console.log('[4] Navigating to @' + TARGET + '...');
  await page.goto('https://www.instagram.com/' + TARGET + '/', {
    waitUntil: 'domcontentloaded', timeout: 45000
  }).catch(() => {});
  await sleep(10000);

  // === STEP 5: Click Message button ===
  console.log('[5] Clicking Message...');
  const clicked = await page.evaluate(() => {
    const els = document.querySelectorAll('div[role="button"], button, a');
    for (const el of els) {
      const t = el.textContent?.trim().toLowerCase();
      if (t === 'message') { el.click(); return true; }
    }
    return false;
  });
  console.log('  Clicked:', clicked);
  await sleep(6000);

  // Check for new tab with DM
  const allPages = await browser.pages();
  for (const p of allPages) {
    if (p.url().includes('/direct')) { page = p; break; }
  }
  console.log('  DM URL:', page.url());

  // === STEP 6: Type and send DM ===
  console.log('[6] Sending DM...');
  await sleep(3000);
  await page.keyboard.type(MESSAGE, { delay: 30 + Math.random() * 20 });
  await sleep(1000);
  await page.keyboard.press('Enter');
  await sleep(3000);
  console.log('\n=== DM SENT to @' + TARGET + '! ===');

  const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
  if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_dm_sent.png', Buffer.from(ss, 'base64'));
  console.log('Screenshot saved');
  process.exit(0);
})().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
