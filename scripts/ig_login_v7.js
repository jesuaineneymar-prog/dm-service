const puppeteer = require('puppeteer-core');
const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';
const USERNAME = process.argv[2] || 'mwango_brain';
const PASSWORD = process.argv[3] || 'Jarvis99!';
const TARGET = process.argv[4] || 'instagram';
const MESSAGE = process.argv[5] || 'Ola! Mwango Brain. Ignora.';
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
    // Fill form and submit ENTIRELY via page.evaluate (NO keyboard commands)
    console.log('[2] Filling form via evaluate...');
    const fillResult = await page.evaluate(({ username, password }) => {
      const emailInput = document.querySelector('input[name="email"]');
      const passInput = document.querySelector('input[name="pass"]');
      if (!emailInput || !passInput) return { error: 'Inputs not found' };

      // Use React-compatible value setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      
      // Set email
      nativeInputValueSetter.call(emailInput, username);
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Set password
      nativeInputValueSetter.call(passInput, password);
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
      passInput.dispatchEvent(new Event('change', { bubbles: true }));

      return {
        email: emailInput.value,
        passLen: passInput.value.length,
        success: true,
      };
    }, { username: USERNAME, password: PASSWORD });
    console.log('  Fill:', JSON.stringify(fillResult));

    if (fillResult.error) { console.log('ERROR:', fillResult.error); process.exit(1); }

    // Submit ENTIRELY via evaluate (click the submit input)
    console.log('[3] Submitting via evaluate...');
    await page.evaluate(() => {
      const btn = document.querySelector('input[type="submit"]');
      if (btn) btn.click();
    });
    console.log('  Submit clicked, waiting...');
    await sleep(10000);

    // Check result
    const after = await page.evaluate(() => ({
      url: window.location.href,
      hasFeed: !!document.querySelector('main'),
      hasForm: !!document.querySelector('#login_form'),
      slfError: document.getElementById('slfErrorAlert')?.textContent || null,
      text: document.body?.innerText.substring(0, 400) || '',
    }));
    console.log('  After submit:', JSON.stringify(after, null, 2));

    if (after.hasForm && !after.hasFeed) {
      // Try form.submit()
      console.log('  Trying form.submit()...');
      await page.evaluate(() => document.getElementById('login_form')?.submit());
      await sleep(10000);
    }

    const finalCheck = await page.evaluate(() => ({
      hasFeed: !!document.querySelector('main'),
      hasForm: !!document.querySelector('#login_form'),
      url: window.location.href,
    }));
    console.log('  Final: hasFeed=' + finalCheck.hasFeed + ' hasForm=' + finalCheck.hasForm);

    if (finalCheck.hasForm && !finalCheck.hasFeed) {
      console.log('\n*** LOGIN FAILED ***');
      const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
      if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_v7_fail.png', Buffer.from(ss, 'base64'));
      process.exit(1);
    }
  }

  console.log('\n[4] LOGGED IN! Sending DM to @' + TARGET + '...');
  await page.goto('https://www.instagram.com/' + TARGET + '/', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  await sleep(10000);
  console.log('  Profile URL:', page.url());

  // Find and click Message
  console.log('[5] Clicking Message...');
  const clicked = await page.evaluate(() => {
    for (const el of document.querySelectorAll('div[role="button"], button, a')) {
      if (el.textContent?.trim().toLowerCase() === 'message') { el.click(); return true; }
    }
    return false;
  });
  console.log('  Clicked:', clicked);
  await sleep(6000);

  // Check new tabs
  for (const p of await browser.pages()) {
    if (p.url().includes('/direct')) { page = p; break; }
  }
  console.log('  DM URL:', page.url());

  // Type message using keyboard.type (not a password field, should work)
  console.log('[6] Typing message...');
  await sleep(3000);
  await page.keyboard.type(MESSAGE, { delay: 30 });
  await sleep(1000);

  // Send
  const sentViaBtn = await page.evaluate(() => {
    const btn = document.querySelector('div[role="button"][aria-label="Send"]') || document.querySelector('button[aria-label="Send"]');
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!sentViaBtn) await page.keyboard.press('Enter');
  console.log('  Sent via', sentViaBtn ? 'button' : 'Enter');
  await sleep(3000);

  console.log('\n=== DM SENT to @' + TARGET + '! ===');
  const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
  if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_v7_sent.png', Buffer.from(ss, 'base64'));
  process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
