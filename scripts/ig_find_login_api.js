const puppeteer = require('puppeteer-core');

const WS = 'wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222';

(async () => {
  console.log('Connecting...');
  const browser = await puppeteer.connect({ browserWSEndpoint: WS, defaultViewport: { width: 1280, height: 800 } });
  let page = (await browser.pages())[0] || await browser.newPage();

  // Enable request interception to find login endpoint
  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('login') || url.includes('account') || url.includes('auth')) {
      requests.push({ method: req.method(), url: url, headers: req.headers() });
      console.log('REQ:', req.method(), url.substring(0, 150));
    }
  });
  page.on('response', resp => {
    const url = resp.url();
    if (url.includes('login') || url.includes('account')) {
      console.log('RESP:', resp.status(), url.substring(0, 150));
    }
  });

  console.log('Navigating to Instagram...');
  try { await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch(e) {}
  await new Promise(r => setTimeout(r, 8000));

  // Search JS bundles for login endpoints
  console.log('\n[Searching for login API in page scripts...]');
  const apiInfo = await page.evaluate(() => {
    const results = [];
    // Check all script src for relevant URLs
    const scripts = document.querySelectorAll('script[src]');
    for (const s of scripts) {
      if (s.src.includes('Login') || s.src.includes('login')) {
        results.push({ type: 'script_src', src: s.src });
      }
    }
    // Check inline scripts for API patterns
    const inlineScripts = document.querySelectorAll('script:not([src])');
    for (const s of inlineScripts) {
      const text = s.textContent || '';
      const loginMatches = text.match(/['"]([\/a-z_0-9]*login[\/a-z_0-9]*)['"].*?['"](?:POST|ajax)[\s\S]{0,200}/g);
      if (loginMatches) results.push({ type: 'inline_match', matches: loginMatches.slice(0, 3) });
      // Look for API base URL
      const apiMatch = text.match(/apiBaseUrl['"]?\s*[:=]\s*['"]([^'"]+)['"]?/);
      if (apiMatch) results.push({ type: 'api_base', url: apiMatch[1] });
    }
    // Check window.__INITIAL_STATE__ or similar
    const stateKeys = Object.keys(window).filter(k => k.startsWith('__'));
    results.push({ type: 'window_keys', keys: stateKeys });
    return results;
  });
  console.log(JSON.stringify(apiInfo, null, 2));

  // Try to find the login endpoint by checking XHR/fetch patterns in loaded modules
  console.log('\n[Trying known endpoints...]');
  const endpoints = [
    '/api/v1/accounts/login/ajax/1/',
    '/api/v1/accounts/web/login/ajax/',
    '/api/v1/web/accounts/login/',
    '/api/v1/accounts/login/',
    '/api/v1/web/login/',
  ];
  const cookies = await page.cookies();
  let csrf = '';
  for (const c of cookies) { if (c.name === 'csrftoken') csrf = c.value; }

  for (const ep of endpoints) {
    try {
      const resp = await page.evaluate(async ({ ep, csrf }) => {
        const r = await fetch('https://www.instagram.com' + ep, {
          method: 'OPTIONS',
          headers: { 'X-CSRFToken': csrf, 'X-IG-App-ID': '936619743392459' },
        });
        return { status: r.status, ok: r.ok, type: r.headers.get('content-type') };
      }, { ep, csrf });
      console.log('  ', ep, '->', JSON.stringify(resp));
    } catch(e) {
      console.log('  ', ep, '-> ERROR:', e.message);
    }
  }

  // Try the GraphQL login mutation
  console.log('\n[Trying GraphQL...]');
  try {
    const gqlResp = await page.evaluate(async ({ csrf }) => {
      const r = await fetch('https://www.instagram.com/graphql/query/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': csrf,
          'X-IG-App-ID': '936619743392459',
        },
        body: 'doc_id=1030887569&variables={}=',
      });
      const t = await r.text();
      return { status: r.status, text: t.substring(0, 300) };
    }, { csrf });
    console.log('  GraphQL:', JSON.stringify(gqlResp));
  } catch(e) {
    console.log('  GraphQL error:', e.message);
  }

  console.log('\nDone.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
