const puppeteer = require('puppeteer-core');
const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';
const USERNAME = process.argv[2] || 'mwango_brain';
const PASSWORD = process.argv[3] || 'Jarvis99!';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.connect({ browserWSEndpoint: WS, defaultViewport: { width: 1280, height: 800 } });
  let page = (await browser.pages())[0] || await browser.newPage();

  // Intercept ALL requests to find correct headers
  const reqLog = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('instagram.com/api/') || url.includes('graphql')) {
      reqLog.push({
        method: req.method(),
        url: url,
        igAppId: req.headers()['x-ig-app-id'] || req.headers()['x-ig-appid'],
        wwwClaim: req.headers()['x-ig-www-claim'] || '',
        userAgent: (req.headers()['user-agent'] || '').substring(0, 60),
      });
    }
  });

  console.log('[1] Loading Instagram (with request interception)...');
  try { await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 60000 }); } catch(e) { console.log('  timeout'); }
  await sleep(3000);

  console.log('\n  Intercepted API requests:');
  for (const r of reqLog) {
    console.log('  ' + r.method + ' ' + r.url.substring(0, 80));
    console.log('    x-ig-app-id: ' + r.igAppId);
    if (r.wwwClaim) console.log('    x-ig-www-claim: ' + r.wwwClaim.substring(0, 50) + '...');
  }

  // Extract app ID from page
  console.log('\n[2] Extracting App ID from page...');
  const pageInfo = await page.evaluate(() => {
    // Check for __d modules that contain app ID
    const results = {};
    // Method 1: Check bundled data
    const html = document.documentElement.innerHTML;
    const appIdMatch = html.match(/['"]([0-9]{15,20})['"].*?instagram/g);
    if (appIdMatch) results.possibleAppIds = [...new Set(appIdMatch.map(m => m.match(/['"]([0-9]+)['"]/)[1]))];
    // Method 2: Check server checks
    const serverChecks = html.match(/server_checks['"]\s*:\s*['"]([^'"]+)['"]?/);
    if (serverChecks) results.serverChecks = serverChecks[1];
    // Method 3: Check for www-claim in meta tags or headers
    results.xIgWwwClaim = document.querySelector('meta[name="x-ig-www-claim"]')?.content || 'not in meta';
    return results;
  });
  console.log('  Page info:', JSON.stringify(pageInfo, null, 2));

  // Get the x-ig-www-claim from response headers
  console.log('\n[3] Getting www-claim from response headers...');
  const wwwClaim = await page.evaluate(async () => {
    const resp = await fetch('https://www.instagram.com/data/shared_data/', { credentials: 'include' });
    return {
      status: resp.status,
      wwwClaim: resp.headers.get('x-ig-www-claim') || 'not set',
      contentType: resp.headers.get('content-type'),
    };
  });
  console.log('  www-claim response:', JSON.stringify(wwwClaim));

  // Try login with extracted info
  console.log('\n[4] Attempting login with correct headers...');
  const cookies = await page.cookies();
  const csrf = cookies.find(c => c.name === 'csrftoken')?.value || '';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = 'iN4$aGr0m';
  let encPass = '';
  for (let i = 0; i < PASSWORD.length; i++) {
    encPass += (PASSWORD.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0');
  }
  const encPassword = '#PWD_INSTAGRAM_BROWSER:0:' + timestamp + ':' + encPass;

  // Get headers from an actual page request
  const headersFromPage = reqLog.length > 0 ? reqLog[0] : {};
  const appId = headersFromPage.igAppId || '936619743392459';
  console.log('  Using App ID:', appId);

  const loginResult = await page.evaluate(async ({ username, encPassword, csrf, appId }) => {
    const resp = await fetch('https://www.instagram.com/api/v1/accounts/login/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrf,
        'X-IG-App-ID': appId,
        'X-Instagram-AJAX': '1',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({
        username, enc_password: encPassword,
        queryParams: JSON.stringify({source: 'nav', next: '/'}),
        optIntoOneTap: 'false', stopDeletion: 'false', trustedDeviceRecords: '{}',
      }),
      credentials: 'include',
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { data = { _raw: text.substring(0, 500) }; }
    return { status: resp.status, data };
  }, { username: USERNAME, encPassword, csrf, appId });

  console.log('  Status:', loginResult.status);
  console.log('  Response:', JSON.stringify(loginResult.data).substring(0, 500));

  if (loginResult.data?.authenticated) {
    console.log('\n*** LOGIN SUCCESS! ***');
    const sid = (await page.cookies()).find(c => c.name === 'sessionid');
    console.log('  sessionid:', sid ? sid.value.substring(0, 20) + '...' : 'not found');
  }

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
