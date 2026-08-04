const puppeteer = require('puppeteer-core');

const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';
const USERNAME = process.argv[2] || 'mwango_brain';
const PASSWORD = process.argv[3] || 'Jarvis99!';
const TARGET = process.argv[4] || 'instagram';
const MESSAGE = process.argv[5] || 'Ola! Teste da Mwango Brain. Ignora esta msg.';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('Connecting to Bright Data...');
  const browser = await puppeteer.connect({
    browserWSEndpoint: WS,
    defaultViewport: { width: 1280, height: 800 },
  });
  console.log('Connected! Pages:', (await browser.pages()).length);

  let page;
  const existing = await browser.pages();
  page = existing[0];
  if (!page || page.url() === 'about:blank') {
    page = await browser.newPage();
  }
  console.log('Page URL:', page.url());

  // === STEP 1: Navigate to Instagram ===
  console.log('\n[1] Navigating to Instagram...');
  try {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch(e) {
    console.log('  goto timeout, checking page...');
  }
  await sleep(8000); // Wait for React hydration
  console.log('  URL:', page.url());

  // Check page content
  const pageText = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 500) : '');
  console.log('  Has login form:', pageText.includes('Log into Instagram'));
  console.log('  Has feed:', !!(await page.$('main').catch(() => null)));

  // Check for any error elements
  const errorInfo = await page.evaluate(() => {
    const slf = document.getElementById('slfErrorAlert');
    const alerts = document.querySelectorAll('[role="alert"]');
    return {
      slfError: slf ? slf.textContent : null,
      alerts: Array.from(alerts).map(a => a.textContent.trim()).filter(t => t),
      url: window.location.href,
    };
  }).catch(() => ({}));
  console.log('  Error elements:', JSON.stringify(errorInfo));

  // Check if already logged in
  if (!pageText.includes('Log into Instagram')) {
    console.log('  Already logged in!');
  } else {
    // === STEP 2: Fill login form ===
    console.log('\n[2] Filling login form...');

    // Get form details first
    const formInfo = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const details = [];
      for (const inp of inputs) {
        details.push({ name: inp.name, type: inp.type, id: inp.id, value: inp.value });
      }
      return details;
    });
    console.log('  Form inputs:', JSON.stringify(formInfo));

    // Type username
    const userInput = await page.$('input[name="email"]') || await page.$('input[name="username"]');
    if (!userInput) { console.log('ERROR: Username input not found!'); process.exit(1); }
    await userInput.click({ clickCount: 3 });
    await sleep(500);
    await userInput.type(USERNAME, { delay: 50 + Math.random() * 50 });
    console.log('  Username typed');

    // Type password
    const passInput = await page.$('input[name="pass"]');
    if (!passInput) { console.log('ERROR: Password input not found!'); process.exit(1); }
    await passInput.click({ clickCount: 3 });
    await sleep(400);
    await passInput.type(PASSWORD, { delay: 40 + Math.random() * 30 });
    console.log('  Password typed');

    // Verify what we typed
    const typedValues = await page.evaluate(() => {
      return {
        email: document.querySelector('input[name="email"]')?.value,
        pass: document.querySelector('input[name="pass"]')?.value?.length,
      };
    });
    console.log('  Typed values:', JSON.stringify(typedValues));

    // === STEP 3: Submit via Enter key ===
    console.log('\n[3] Submitting via Enter key...');
    await sleep(800);
    await passInput.press('Enter');
    console.log('  Enter pressed, waiting...');

    // Wait for response
    await sleep(5000);

    // Check what happened
    const afterSubmit = await page.evaluate(() => {
      const slf = document.getElementById('slfErrorAlert');
      return {
        url: window.location.href,
        hasLoginForm: !!document.querySelector('#login_form'),
        hasFeed: !!document.querySelector('main'),
        slfError: slf ? slf.textContent : null,
        text: document.body ? document.body.innerText.substring(0, 300) : '',
        alerts: Array.from(document.querySelectorAll('[role="alert"]')).map(a => a.textContent.trim()).filter(t => t),
      };
    }).catch(() => ({}));
    console.log('  After submit:', JSON.stringify(afterSubmit, null, 2));

    if (afterSubmit.slfError || (afterSubmit.alerts && afterSubmit.alerts.length)) {
      console.log('\n  *** ERROR DETECTED ***');
    }

    if (afterSubmit.hasLoginForm && !afterSubmit.hasFeed) {
      // Login failed, try button click as fallback
      console.log('\n  Still on login, trying button click...');
      const submitBtn = await page.$('input[type="submit"]');
      if (submitBtn) {
        console.log('  Found submit input, clicking...');
        await submitBtn.click();
        await sleep(8000);
        const afterClick = await page.evaluate(() => ({
          url: window.location.href,
          hasLoginForm: !!document.querySelector('#login_form'),
          hasFeed: !!document.querySelector('main'),
          slfError: document.getElementById('slfErrorAlert')?.textContent || null,
          text: document.body?.innerText.substring(0, 300) || '',
        })).catch(() => ({}));
        console.log('  After button click:', JSON.stringify(afterClick, null, 2));
      }

      // If still failed, try JS form submit
      const stillOnLogin = await page.evaluate(() => !!document.querySelector('#login_form')).catch(() => true);
      if (stillOnLogin) {
        console.log('\n  Still on login, trying JS form.submit()...');
        try {
          await page.evaluate(() => {
            const form = document.querySelector('#login_form');
            if (form) form.submit();
          });
          await sleep(8000);
          const afterJS = await page.evaluate(() => ({
            url: window.location.href,
            hasLoginForm: !!document.querySelector('#login_form'),
            hasFeed: !!document.querySelector('main'),
            slfError: document.getElementById('slfErrorAlert')?.textContent || null,
            text: document.body?.innerText.substring(0, 300) || '',
          })).catch(() => ({}));
          console.log('  After JS submit:', JSON.stringify(afterJS, null, 2));
        } catch(e) {
          console.log('  JS submit error:', e.message);
        }
      }
    }
  }

  // Final state
  const finalState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    hasFeed: !!document.querySelector('main'),
    hasLoginForm: !!document.querySelector('#login_form'),
  })).catch(() => ({}));
  console.log('\n=== FINAL STATE ===');
  console.log(JSON.stringify(finalState, null, 2));

  // Take screenshot
  const screenshot = await page.screenshot({ encoding: 'base64' }).catch(() => null);
  if (screenshot) {
    require('fs').writeFileSync('/home/z/my-project/scripts/ig_screenshot.png', Buffer.from(screenshot, 'base64'));
    console.log('Screenshot saved to ig_screenshot.png');
  }

  // Don't close browser - Bright Data manages it
  console.log('\nDone. Browser connection kept alive.');
  process.exit(0);
})().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
