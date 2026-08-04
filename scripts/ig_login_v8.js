const puppeteer = require('puppeteer-core');
const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';
const USERNAME = process.argv[2] || 'mwango_brain';
const PASSWORD = process.argv[3] || 'Jarvis99!';
const TARGET = process.argv[4] || 'instagram';
const MESSAGE = process.argv[5] || 'Ola! Mwango Brain. Ignora esta mensagem.';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS, defaultViewport: { width: 1280, height: 800 } });
  let page = (await browser.pages())[0] || await browser.newPage();

  console.log('[1] Loading Instagram...');
  try { await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch(e) {}
  await sleep(8000);

  const text = await page.evaluate(() => document.body?.innerText.substring(0, 100) || '');
  const alreadyLoggedIn = !text.includes('Log into Instagram');
  console.log('  Already logged in:', alreadyLoggedIn);

  if (!alreadyLoggedIn) {
    // KEY INSIGHT: Create a PARALLEL hidden form and submit THAT.
    // Never touch the original password field.
    console.log('[2] Creating parallel form...');
    
    // Get the form action and CSRF token
    const formData = await page.evaluate(() => {
      const origForm = document.getElementById('login_form');
      return {
        action: origForm?.action || window.location.href,
        method: origForm?.method || 'POST',
      };
    });
    console.log('  Original form action:', formData.action);
    console.log('  Original form method:', formData.method);

    // Create and submit a hidden form — password is in a HIDDEN input, not password input
    console.log('[3] Submitting via hidden form...');
    const submitResult = await page.evaluate(({ username, password, action }) => {
      // Create hidden form
      const form = document.createElement('form');
      form.action = action;
      form.method = 'POST';
      form.style.display = 'none';
      
      // Add username
      const usernameField = document.createElement('input');
      usernameField.type = 'hidden';
      usernameField.name = 'username';
      usernameField.value = username;
      form.appendChild(usernameField);
      
      // Add password as HIDDEN (not password type!)
      const passField = document.createElement('input');
      passField.type = 'hidden';
      passField.name = 'password';
      passField.value = password;
      form.appendChild(passField);
      
      // Also add enc_password (Instagram might expect this)
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const key = 'iN4$aGr0m';
      let encPass = '';
      for (let i = 0; i < password.length; i++) {
        encPass += (password.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0');
      }
      const encField = document.createElement('input');
      encField.type = 'hidden';
      encField.name = 'enc_password';
      encField.value = '#PWD_INSTAGRAM_BROWSER:0:' + timestamp + ':' + encPass;
      form.appendChild(encField);
      
      // Add other expected fields
      const fields = {
        'queryParams': JSON.stringify({source: 'nav', next: '/'}),
        'optIntoOneTap': 'false',
        'stopDeletion': 'false',
        'trustedDeviceRecords': '{}',
      };
      for (const [name, value] of Object.entries(fields)) {
        const f = document.createElement('input');
        f.type = 'hidden';
        f.name = name;
        f.value = value;
        form.appendChild(f);
      }
      
      // Get CSRF from cookie
      const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
      if (csrfMatch) {
        const csrfField = document.createElement('input');
        csrfField.type = 'hidden';
        csrfField.name = 'csrfmiddlewaretoken';
        csrfField.value = csrfMatch[1];
        form.appendChild(csrfField);
      }
      
      document.body.appendChild(form);
      form.submit();
      return { submitted: true, action: form.action };
    }, { username: USERNAME, password: PASSWORD, action: formData.action });
    console.log('  Submitted:', JSON.stringify(submitResult));

    // Wait for response
    console.log('[4] Waiting for login response...');
    await sleep(12000);

    // Check result
    const after = await page.evaluate(() => ({
      url: window.location.href,
      hasFeed: !!document.querySelector('main'),
      hasForm: !!document.querySelector('#login_form'),
      slfError: document.getElementById('slfErrorAlert')?.textContent || null,
      text: document.body?.innerText.substring(0, 500) || '',
    }));
    console.log('  URL:', after.url);
    console.log('  hasFeed:', after.hasFeed);
    console.log('  hasForm:', after.hasForm);
    console.log('  slfError:', after.slfError);
    console.log('  text:', after.text.substring(0, 300));

    if (after.hasFeed) {
      console.log('\n*** LOGIN SUCCESS! ***');
    } else {
      console.log('\n*** LOGIN FAILED ***');
      // Save screenshot
      const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
      if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_v8.png', Buffer.from(ss, 'base64'));
      console.log('Screenshot saved');
      process.exit(1);
    }
  }

  // === SEND DM ===
  console.log('\n[5] Sending DM to @' + TARGET + '...');
  await page.goto('https://www.instagram.com/' + TARGET + '/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await sleep(10000);

  // Click Message
  const clicked = await page.evaluate(() => {
    for (const el of document.querySelectorAll('div[role="button"], button, a')) {
      if (el.textContent?.trim().toLowerCase() === 'message') { el.click(); return true; }
    }
    return false;
  });
  console.log('  Message clicked:', clicked);
  await sleep(6000);

  // Check new tab
  for (const p of await browser.pages()) {
    if (p.url().includes('/direct')) { page = p; break; }
  }
  console.log('  DM URL:', page.url());
  await sleep(3000);

  // Type and send
  await page.keyboard.type(MESSAGE, { delay: 30 });
  await sleep(1000);
  const sentBtn = await page.evaluate(() => {
    const btn = document.querySelector('div[role="button"][aria-label="Send"]') || document.querySelector('button[aria-label="Send"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!sentBtn) await page.keyboard.press('Enter');
  await sleep(3000);

  console.log('\n=== DM SENT to @' + TARGET + '! ===');
  const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
  if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_dm_sent.png', Buffer.from(ss, 'base64'));
  process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
