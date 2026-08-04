const puppeteer = require('puppeteer-core');
const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';
const USERNAME = process.argv[2] || 'mwango_brain';
const PASSWORD = process.argv[3] || 'Jarvis99!';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS, defaultViewport: { width: 1280, height: 800 } });
  let page = (await browser.pages())[0] || await browser.newPage();

  console.log('[1] Loading Instagram...');
  try { await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch(e) {}
  await sleep(8000);

  const text = await page.evaluate(() => document.body?.innerText.substring(0, 100) || '');
  if (!text.includes('Log into Instagram')) { console.log('Already logged in!'); process.exit(0); }

  // Type username with type() (should work, not a password field)
  console.log('[2] Typing username...');
  const userInput = await page.$('input[name="email"]') || await page.$('input[name="username"]');
  await userInput.click({ clickCount: 3 });
  await sleep(300);
  await userInput.type(USERNAME, { delay: 50 });
  console.log('  Username typed OK');

  // Click on password field
  console.log('[3] Typing password with sendCharacter...');
  const passInput = await page.$('input[name="pass"]');
  await passInput.click();
  await sleep(500);

  // Try sendCharacter for each char
  try {
    for (const ch of PASSWORD) {
      await page.keyboard.sendCharacter(ch);
      await sleep(30 + Math.random() * 40);
    }
    console.log('  Password typed via sendCharacter OK');
  } catch(e) {
    console.log('  sendCharacter failed:', e.message);
    console.log('  Trying keyboard.press for each key...');
    // Try pressing actual keys
    for (const ch of PASSWORD) {
      try {
        if (ch === '!') await page.keyboard.press('Shift+Digit1');
        else if (ch === '@') await page.keyboard.press('Shift+Digit2');
        else if (ch === '#') await page.keyboard.press('Shift+Digit3');
        else if (ch >= 'A' && ch <= 'Z') await page.keyboard.press('Shift+Key' + ch);
        else if (ch >= 'a' && ch <= 'z') await page.keyboard.press('Key' + ch.toUpperCase());
        else if (ch >= '0' && ch <= '9') await page.keyboard.press('Digit' + ch);
        else await page.keyboard.press(ch);
      } catch(e2) {
        console.log('    Failed for "' + ch + '":', e2.message);
      }
      await sleep(30 + Math.random() * 40);
    }
    console.log('  Password typed via key presses');
  }

  // Verify values
  const values = await page.evaluate(() => ({
    email: document.querySelector('input[name="email"]')?.value,
    passLen: document.querySelector('input[name="pass"]')?.value?.length,
  }));
  console.log('  Values:', JSON.stringify(values));

  // Submit
  console.log('[4] Submitting...');
  await sleep(500);
  await page.keyboard.press('Enter');
  await sleep(8000);

  // Check result
  const after = await page.evaluate(() => ({
    url: window.location.href,
    hasFeed: !!document.querySelector('main'),
    hasForm: !!document.querySelector('#login_form'),
    slfError: document.getElementById('slfErrorAlert')?.textContent || null,
    text: document.body?.innerText.substring(0, 400) || '',
  }));
  console.log('  After submit:', JSON.stringify(after, null, 2));

  if (after.hasFeed) {
    console.log('\n*** LOGIN SUCCESS! ***');
  } else if (after.hasForm) {
    console.log('\n*** LOGIN FAILED ***');
    if (!after.slfError) {
      // Try clicking submit button as fallback
      console.log('  Trying submit input click...');
      await page.evaluate(() => document.querySelector('input[type="submit"]')?.click());
      await sleep(8000);
      const after2 = await page.evaluate(() => ({
        hasFeed: !!document.querySelector('main'),
        hasForm: !!document.querySelector('#login_form'),
        slfError: document.getElementById('slfErrorAlert')?.textContent || null,
      }));
      console.log('  After click:', JSON.stringify(after2));
      if (after2.hasFeed) console.log('\n*** LOGIN SUCCESS (on retry)! ***');
      else console.log('\n*** LOGIN STILL FAILED ***');
    }
  }

  const ss = await page.screenshot({ encoding: 'base64' }).catch(() => null);
  if (ss) require('fs').writeFileSync('/home/z/my-project/scripts/ig_v5_result.png', Buffer.from(ss, 'base64'));
  console.log('Screenshot saved');
  process.exit(0);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
