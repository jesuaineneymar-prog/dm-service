/**
 * Extrai sessao IG do NSTBrowser e guarda em formato para instagram-private-api
 * Uso: node nst-extract-ig-session.js
 * 
 * Requer: NSTBrowser running + IG logado no perfil
 * Fluxo:
 *   1. Conecta ao perfil IG no NSTBrowser
 *   2. Extrai cookies
 *   3. Converte para formato do instagram-private-api
 *   4. Salva em ig-session.json
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const NST_BASE = 'http://127.0.0.1:8899';
const SESSION_FILE = path.join(__dirname, 'ig-session.json');

async function main() {
  console.log('=== NSTBrowser → IG Private API Session Bridge ===');

  // 1. Verificar se NSTBrowser esta a correr
  try {
    await fetch(NST_BASE + '/', { signal: AbortSignal.timeout(5000) });
  } catch (e) {
    console.error('ERRO: NSTBrowser nao esta a correr em ' + NST_BASE);
    console.error('Instala e abre NSTBrowser em https://www.nstbrowser.com/');
    process.exit(1);
  }
  console.log('[OK] NSTBrowser detected');

  // 2. Listar perfis existentes
  try {
    var profilesRes = await fetch(NST_BASE + '/profile/list');
    var profilesData = await profilesRes.json();
    var profiles = profilesData.data?.list || profilesData.data || profilesData.list || [];
    console.log('[OK] Found ' + profiles.length + ' profile(s)');
    
    // Procurar perfil IG
    var igProfile = profiles.find(function(p) {
      var n = (p.name || '').toLowerCase();
      return n.includes('ig') || n.includes('instagram');
    });

    if (!igProfile && profiles.length > 0) {
      // Usar o primeiro perfil
      igProfile = profiles[0];
      console.log('[WARN] No IG-specific profile found, using: ' + igProfile.name);
    }

    if (!igProfile) {
      console.error('ERRO: Nenhum perfil encontrado. Cria um perfil IG no NSTBrowser primeiro.');
      process.exit(1);
    }

    var profileId = igProfile.id;
    console.log('[OK] Using profile: ' + igProfile.name + ' (' + profileId + ')');

    // 3. Conectar ao perfil via WebSocket
    var connectUrl = 'ws://127.0.0.1:8899/connect/' + profileId;
    console.log('[CONN] Connecting to ' + connectUrl + '...');

    var browser = await puppeteer.connect({
      browserWSEndpoint: connectUrl,
      defaultViewport: { width: 1280, height: 800 },
    });

    var pages = await browser.pages();
    var page = pages[0] || await browser.newPage();

    // 4. Navegar ao Instagram para garantir que ha cookies
    console.log('[IG] Navigating to instagram.com...');
    await page.goto('https://www.instagram.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    await new Promise(function(r) { setTimeout(r, 3000); });

    // Verificar se esta logado
    var currentUrl = page.url();
    var isLoggedIn = !currentUrl.includes('/accounts/login');
    console.log('[IG] Logged in: ' + isLoggedIn);
    console.log('[IG] URL: ' + currentUrl);

    if (!isLoggedIn) {
      console.error('ERRO: Instagram nao esta logado neste perfil.');
      console.error('Faz login manual ou usa nst-ig-fb-login.js primeiro.');
      await browser.disconnect();
      process.exit(1);
    }

    // 5. Extrair cookies
    var cookies = await page.cookies('https://www.instagram.com');
    console.log('[COOKIES] Extracted ' + cookies.length + ' cookies');

    // 6. Extrair estado da pagina para formato instagram-private-api
    // O instagram-private-api usa o estado do modulo state que inclui
    // cookies, device id, phone id, etc. Vamos extrair o que precisamos.
    var cookieMap = {};
    for (var c of cookies) {
    cookieMap[c.name] = c.value;
  }

  // Gerar IDs de dispositivo deterministicos
  var { IgApiClient } = require('instagram-private-api');
  var igRef = new IgApiClient();
  var deviceId = igRef.state.deviceString || cookieMap['ig_did'] || ('android-' + Math.random().toString(36).slice(2));

    // Criar o estado no formato esperado pela lib
    var sessionState = {
      ds_user_id: cookieMap['ds_user_id'] || '',
      sessionid: cookieMap['sessionid'] || '',
      csrftoken: cookieMap['csrftoken'] || '',
      shbid: cookieMap['shbid'] || '',
      shbts: cookieMap['shbts'] || '',
      ig_did: cookieMap['ig_did'] || '',
      mid: cookieMap['mid'] || '',
      rur: cookieMap['rur'] || '',
      datr: cookieMap['datr'] || '',
      // Device info
      device_id: deviceId,
      phone_id: deviceId,
      uuid: deviceId,
      // Adicionar cookies como string para compatibilidade
      cookies: cookies.map(function(c) {
        return {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expires: c.expires,
          httpOnly: c.httpOnly,
          secure: c.secure,
          sameSite: c.sameSite,
        };
      }),
    };

    // 7. Salvar sessao
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionState, null, 2));
    console.log('[SAVE] Session saved to ' + SESSION_FILE);
    console.log('[SAVE] ds_user_id: ' + (sessionState.ds_user_id || 'not found'));
    console.log('[SAVE] sessionid: ' + (sessionState.sessionid ? sessionState.sessionid.substring(0, 20) + '...' : 'not found'));
    console.log('[SAVE] csrftoken: ' + (sessionState.csrftoken || 'not found'));
    console.log('[SAVE] ig_did: ' + (sessionState.ig_did || 'not found'));

    // 8. Testar a sessao com instagram-private-api
    console.log('[TEST] Testing session with instagram-private-api...');
    try {
      var { IgApiClient } = require('instagram-private-api');
      var igTest = new IgApiClient();
      igTest.state.generateDevice('jesuaine07');
      await igTest.state.deserialize(sessionState);
      var user = await igTest.account.currentUser();
      console.log('[TEST] Session valid! User: @' + user.username + ' (ID: ' + user.pk + ')');
      console.log('[TEST] Followers: ' + user.follower_count + ', Following: ' + user.following_count);
    } catch (testErr) {
      console.warn('[WARN] Session test failed: ' + testErr.message);
      console.warn('[WARN] Session saved anyway - may need manual fix');
    }

    await browser.disconnect();
    console.log('[DONE] Bridge complete! Use send-ig-dm.js to send DMs.');

  } catch (err) {
    console.error('FATAL: ' + err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();