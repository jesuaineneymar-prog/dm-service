/**
 * Envia Facebook DM via NSTBrowser + Puppeteer
 * Uso: node send-fb-dm.js <profileId> <recipientName> <message>
 * 
 * Requer: NSTBrowser running + FB logado no perfil
 * 
 * Fluxo:
 *   1. Conecta ao perfil FB no NSTBrowser
 *   2. Navega ao messenger do destinatario
 *   3. Escreve e envia a mensagem
 */

const puppeteer = require('puppeteer-core');

const NST_BASE = 'http://127.0.0.1:8899';

async function sendFBDM(profileId, recipientName, message) {
  // 1. Verificar NSTBrowser
  try {
    await fetch(NST_BASE + '/', { signal: AbortSignal.timeout(5000) });
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: 'NSTBrowser nao esta a correr em ' + NST_BASE }));
    return;
  }

  // 2. Conectar ao perfil
  var connectUrl = NST_BASE + '/connect?id=' + profileId + '&headless=1';
  var browser, page;

  try {
    var res = await fetch(connectUrl);
    var data = await res.json();
    var wsUrl = data.data?.ws?.puppeteer || data.data?.ws || data.ws;
    if (!wsUrl) {
      console.log(JSON.stringify({ success: false, error: 'Sem WebSocket URL do NST: ' + JSON.stringify(data).slice(0, 200) }));
      return;
    }

    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: { width: 1280, height: 800 },
    });
    var pages = await browser.pages();
    page = pages[0] || await browser.newPage();
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: 'Falha ao conectar NST: ' + e.message }));
    return;
  }

  try {
    // 3. Verificar se esta logado no FB
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(function(r) { setTimeout(r, 3000); });
    var currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('login.php')) {
      console.log(JSON.stringify({ success: false, error: 'FB nao esta logado neste perfil. Faz login primeiro.' }));
      await browser.disconnect();
      return;
    }

    // 4. Navegar ao messenger do destinatario
    var messengerUrl = 'https://www.facebook.com/messages/t/' + encodeURIComponent(recipientName);
    console.error('[FB] Navigating to ' + messengerUrl);
    await page.goto(messengerUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(function(r) { setTimeout(r, 5000); }); // Esperar carregar conversa

    // 5. Encontrar a caixa de texto e enviar mensagem
    // Tentar multiplos seletores (FB muda frequentemente)
    var selectors = [
      '[contenteditable="true"][role="textbox"]',
      '[aria-label="Message"][contenteditable="true"]',
      '[data-lexical-editor="true"]',
      '.notranslate [contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'textarea[name="message"]',
    ];

    var textBox = null;
    for (var sel of selectors) {
      try {
        var el = await page.waitForSelector(sel, { timeout: 5000 });
        if (el) { textBox = el; break; }
      } catch (e) { /* try next */ }
    }

    if (!textBox) {
      console.log(JSON.stringify({ success: false, error: 'Nao encontrou caixa de texto do Messenger. Possivelmente a conversa nao existe ou o seletor mudou.' }));
      await browser.disconnect();
      return;
    }

    // 6. Escrever mensagem
    await textBox.click();
    await new Promise(function(r) { setTimeout(r, 500); });
    await textBox.type(message, { delay: 30 });
    await new Promise(function(r) { setTimeout(r, 1000); });

    // 7. Enviar (Enter ou botao)
    await page.keyboard.press('Enter');
    await new Promise(function(r) { setTimeout(r, 3000); }); // Esperar envio

    console.log(JSON.stringify({
      success: true,
      recipient: recipientName,
      messageLength: message.length,
      provider: 'nstbrowser',
    }));

    await browser.disconnect();
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: 'Erro ao enviar DM: ' + e.message }));
    try { await browser.disconnect(); } catch (ex) { /* ignore */ }
  }
}

var profileId = process.argv[2];
var recipientName = process.argv[3];
var message = process.argv[4];

if (!profileId || !recipientName || !message) {
  console.log(JSON.stringify({ success: false, error: 'Usage: node send-fb-dm.js <nstProfileId> <recipientName> <message>' }));
  process.exit(1);
}

sendFBDM(profileId, recipientName, message);
