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
  const csrf = cookies.find(c => c.name === 'csrftoken')?.value || '';

  // Get www-claim from response headers of a 404 request
  const wwwClaimResp = await page.evaluate(async () => {
    const r = await fetch('https://www.instagram.com/api/v1/accounts/login/ajax/1/');
    return r.headers.get('x-ig-set-www-claim') || '';
  });
  console.log('  www-claim:', wwwClaimResp ? wwwClaimResp.substring(0, 30) + '...' : 'empty');

  const appIds = ['936619743392459', '124024574287414', '7670213784605534318', '3100413179078433587'];
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = 'iN4$aGr0m';
  let encPass = '';
  for (let i = 0; i < PASSWORD.length; i++) {
    encPass += (PASSWORD.charCodeAt(i) ^ key.charCodeAt(i % key.length)).toString(16).padStart(2, '0');
  }
  const encPassword = '#PWD_INSTAGRAM_BROWSER:0:' + timestamp + ':' + encPass;

  for (const appId of appIds) {
    console.log('\n[Testing App ID: ' + appId + ']');
    const result = await page.evaluate(async ({ username, encPassword, csrf, appId, wwwClaim }) => {
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': csrf,
        'X-IG-App-ID': appId,
        'X-Instagram-AJAX': '1',
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (wwwClaim) headers['x-ig-www-claim'] = wwwClaim;
      
      const resp = await fetch('https://www.instagram.com/api/v1/accounts/login/', {
        method: 'POST', headers,
        body: new URLSearchParams({
          username, enc_password: encPassword,
          queryParams: JSON.stringify({source: 'nav', next: '/'}),
          optIntoOneTap: 'false', stopDeletion: 'false', trustedDeviceRecords: '{}',
        }),
        credentials: 'include',
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { data = { _raw: text.substring(0, 300) }; }
      return { status: resp.status, data };
    }, { username: USERNAME, encPassword, csrf, appId, wwwClaim: wwwClaimResp });

    console.log('  Status:', result.status);
    const d = result.data;
    if (d.authenticated || d.userId) {
      console.log('  *** SUCCESS! userId:', d.userId || d.logged_in_user?.pk);
      console.log('  sessionid:', (await page.cookies()).find(c => c.name === 'sessionid')?.value?.substring(0, 20) || 'not found');
      break;
    } else if (d.error_type) {
      console.log('  Error:', d.error_type, '-', d.message || '');
    } else if (d._raw) {
      console.log('  Raw:', d._raw.substring(0, 200));
    } else {
      console.log('  Data:', JSON.stringify(d).substring(0, 300));
    }
  }

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
