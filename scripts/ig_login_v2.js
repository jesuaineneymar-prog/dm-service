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
  await sleep(5000);

  const cookies = await page.cookies();
  let csrf = cookies.find(c => c.name === 'csrftoken')?.value || '';
  console.log('  CSRF:', csrf.substring(0, 15));

  // Try POST to /api/v1/accounts/login/ 
  console.log('[2] Trying POST /api/v1/accounts/login/ ...');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const result = await page.evaluate(async ({ username, password, csrf, timestamp }) => {
    // enc_password XOR encoding
    const key = 'iN4$aGr0m';
    let encPass = '';
    for (let i = 0; i < password.length; i++) {
      encPass += (password.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0');
    }
    const encPassword = '#PWD_INSTAGRAM_BROWSER:0:' + timestamp + ':' + encPass;

    const endpoints = [
      '/api/v1/accounts/login/',
      '/api/v1/accounts/login/ajax/',
    ];
    const results = [];
    
    for (const ep of endpoints) {
      try {
        const resp = await fetch('https://www.instagram.com' + ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': csrf,
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
        try { data = JSON.parse(text); } catch(e) { data = { _raw: text.substring(0, 300) }; }
        results.push({ endpoint: ep, status: resp.status, data });
      } catch(e) {
        results.push({ endpoint: ep, error: e.message });
      }
    }
    return results;
  }, { username: USERNAME, password: PASSWORD, csrf, timestamp });

  for (const r of result) {
    console.log('  ' + r.endpoint + ' -> ' + r.status);
    console.log('    ' + JSON.stringify(r.data || r.error).substring(0, 400));
  }

  // Check if any got us a session
  const postCookies = await page.cookies();
  const sessionId = postCookies.find(c => c.name === 'sessionid')?.value;
  console.log('\nsessionid:', sessionId ? sessionId.substring(0, 20) + '...' : 'NOT SET');

  // If we got a session, try to reload and check
  if (sessionId) {
    console.log('\n[3] Login succeeded! Reloading...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await sleep(5000);
    const text = await page.evaluate(() => document.body?.innerText.substring(0, 200) || '');
    console.log('  Logged in:', !text.includes('Log into Instagram'));
  }

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
