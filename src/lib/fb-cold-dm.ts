// ============================================================
//  FACEBOOK COLD DM via Bright Data Scraping Browser + Puppeteer
//  Navega ao perfil do alvo, clica em Message, envia a mensagem
//  Suporta envio como pagina (Jarvisv3) ou como perfil pessoal
//  Browser real da Bright Data — fingerprint limpo, proxy residencial
// ============================================================

import { connectBrowser, checkFBLogin, loginFacebook, saveCookies, getFBSession } from './brightdata-browser';

// --- Send a cold DM to a Facebook user ---
export async function fbColdDM(target: string, message: string, opts?: { page?: any; fbEmail?: string; fbPassword?: string; fbPage?: string }): Promise<{
  success: boolean;
  error?: string;
  screenshot?: string;
  debug?: string;
}> {
  var cleanTarget = target.trim().replace(/^@/, '');
  if (!cleanTarget) return { success: false, error: 'Target vazio (username ou URL do perfil)' };
  if (!message.trim()) return { success: false, error: 'Mensagem vazia' };

  // Connect or reuse session
  var page = opts?.page;
  var shouldCleanup = false;
  var loginError = '';
  if (!page) {
    var fbEmail = opts?.fbEmail || process.env.FB_EMAIL || '';
    var fbPass = opts?.fbPassword || process.env.FB_PASSWORD || '';

    // Tentar sessão existente primeiro
    console.log('[FB-DM] Tentando sessão existente...');
    var session = await getFBSession();
    page = session.page;
    shouldCleanup = false;

    if (!session.loggedIn) {
      if (!fbEmail || !fbPass) {
        return { success: false, error: 'Sem credenciais. Passa fb_email e fb_password no request.' };
      }
      console.log('[FB-DM] Sessão expirada, fazendo login...');
      var loggedIn = await loginFacebook(page, fbEmail, fbPass);
      if (!loggedIn) {
        loginError = await page.evaluate(function() { return document.body ? document.body.innerText.substring(0, 300) : ''; }).catch(function() { return ''; });
        return { success: false, error: 'Login falhou no Facebook.', debug: loginError || 'Credenciais erradas ou 2FA necessario.' };
      }
    }
    console.log('[FB-DM] Sessão OK!');
  }

  try {
    var fbPageName = opts?.fbPage || process.env.FB_PAGE_NAME || '';
    var msgPage = page;

    // Se tem pagina configurada, tentar enviar como pagina
    if (fbPageName) {
      console.log('[FB-DM] Tentando enviar como pagina: ' + fbPageName);
      var pageResult = await sendAsPage(msgPage, fbPageName, cleanTarget, message);
      if (pageResult.success) return pageResult;
      console.log('[FB-DM] Envio como pagina falhou: ' + pageResult.error + ' — tentando como perfil...');
    }

    // Step 1: Navigate to user profile
    var profileUrl = buildFBProfileUrl(cleanTarget);
    console.log('[FB-DM] Navegando ao perfil: ' + profileUrl);
    try {
      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (navErr: any) {
      console.log('[FB-DM] goto timeout, avaliando pagina: ' + navErr.message);
    }
    // Esperar JS renderizar
    await new Promise(function(r) { setTimeout(r, 8000); });

    // Check if profile loaded
    var pageText = await page.evaluate(function() { return document.body ? document.body.innerText : ''; });
    if (pageText.includes('This content isn\'t available') || pageText.includes('Page Not Found') || pageText.includes('not available right now')) {
      return { success: false, error: 'Perfil nao encontrado ou nao acessivel' };
    }

    // Step 2: Click "Message" button
    console.log('[FB-DM] Procurando botao Message...');
    var messageBtn = await findFBMessageButton(page);
    if (!messageBtn) {
      // Se nao tem botao Message, tentar via Messenger directo
      console.log('[FB-DM] Botao Message nao encontrado, tentando Messenger directo...');
      var mResult = await tryMessengerDirect(page, cleanTarget, message);
      if (mResult.success) return mResult;
      return { success: false, error: 'Botao "Message" nao encontrado no perfil.', debug: mResult.error };
    }
    await messageBtn.click();
    console.log('[FB-DM] Botao Message clicado');

    // Wait for Messenger to load
    await new Promise(function(r) { setTimeout(r, 6000); });

    // Step 3: Handle new tab if opened
    var pages = await page.browser().pages();
    if (pages.length > 1) {
      // Messenger opened in new tab
      for (var p of pages) {
        var url = p.url();
        if (url.includes('messenger') || url.includes('messages') || url.includes('/t/')) {
          msgPage = p;
          console.log('[FB-DM] Messenger abriu em nova aba: ' + url);
          break;
        }
      }
    }

    // Step 4: Find message input
    console.log('[FB-DM] Procurando campo de mensagem...');
    var msgInput = await findFBMessageInput(msgPage);
    if (!msgInput) {
      console.log('[FB-DM] Campo nao encontrado, esperando mais 5s...');
      await new Promise(function(r) { setTimeout(r, 5000); });
      msgInput = await findFBMessageInput(msgPage);
    }
    if (!msgInput) {
      var screenshot = await msgPage.screenshot({ encoding: 'base64' }).catch(function() { return null; });
      var debugUrl = msgPage.url();
      var debugText = await msgPage.evaluate(function() { return document.body ? document.body.innerText.substring(0, 300) : ''; }).catch(function() { return '' });
      return {
        success: false,
        error: 'Campo de mensagem nao encontrado. O Messenger pode nao ter carregado.',
        debug: 'url=' + debugUrl + ' text=' + debugText,
        screenshot: screenshot || undefined,
      };
    }

    // Step 5: Type and send
    await typeIntoInput(msgPage, msgInput, message);

    await new Promise(function(r) { setTimeout(r, 3000); });

    // Save cookies
    await saveCookies(msgPage, 'facebook');

    return {
      success: true,
      debug: 'target=' + cleanTarget + ', chars=' + message.length,
    };
  } catch (e: any) {
    console.error('[FB-DM] Erro:', e.message);
    var screenshot = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
    return {
      success: false,
      error: e.message,
      screenshot: screenshot || undefined,
    };
  }
  // Nao fechar browser — sessão reutilizada
}

// --- Send DM as a Facebook Page (e.g. Jarvisv3) ---
async function sendAsPage(page: any, pageName: string, target: string, message: string): Promise<{
  success: boolean;
  error?: string;
  screenshot?: string;
  debug?: string;
}> {
  try {
    // Navigate to the page inbox
    var inboxUrl = 'https://www.facebook.com/' + pageName + '/inbox/';
    console.log('[FB-DM] Navegando ao inbox da pagina: ' + inboxUrl);
    try {
      await page.goto(inboxUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (e: any) {
      console.log('[FB-DM] inbox goto timeout: ' + e.message);
    }
    await new Promise(function(r) { setTimeout(r, 8000); });

    var currentUrl = page.url();
    console.log('[FB-DM] Inbox URL: ' + currentUrl);

    // Procurar o botao "New Message" ou campo de busca
    var newMsgBtn = await page.$('div[role="button"][aria-label*="New"], div[role="button"][aria-label*="new"], a[href*="/new/"], div[aria-label*="Send a message"]').catch(function() { return null; });
    if (newMsgBtn) {
      await newMsgBtn.click();
      await new Promise(function(r) { setTimeout(r, 3000); });
    }

    // Procurar campo de busca/to
    var toInput = await page.$('input[name="to"], input[placeholder*="To"], input[placeholder*="Search"], input[aria-label*="To"], input[aria-label*="Search"]').catch(function() { return null; });
    if (toInput) {
      await toInput.click();
      await new Promise(function(r) { setTimeout(r, 500); });
      await toInput.type(target, { delay: 50 + Math.random() * 30 });
      await new Promise(function(r) { setTimeout(r, 2000); });
      // Clicar no primeiro resultado
      var firstResult = await page.$('div[role="listbox"] div[role="option"], ul li:first-child').catch(function() { return null; });
      if (firstResult) {
        await firstResult.click();
        await new Promise(function(r) { setTimeout(r, 2000); });
      }
    }

    // Encontrar campo de mensagem e enviar
    var msgInput = await findFBMessageInput(page);
    if (msgInput) {
      await typeIntoInput(page, msgInput, message);
      await new Promise(function(r) { setTimeout(r, 3000); });
      await saveCookies(page, 'facebook');
      return { success: true, debug: 'sent_as_page=' + pageName + ', target=' + target };
    }

    return { success: false, error: 'Nao conseguiu enviar como pagina ' + pageName };
  } catch (e: any) {
    return { success: false, error: 'Erro ao enviar como pagina: ' + e.message };
  }
}

// --- Try sending via Messenger direct URL ---
async function tryMessengerDirect(page: any, target: string, message: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    var msgUrl = 'https://www.facebook.com/messages/t/' + target;
    console.log('[FB-DM] Tentando Messenger directo: ' + msgUrl);
    await page.goto(msgUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(function() { });
    await new Promise(function(r) { setTimeout(r, 6000); });

    var msgInput = await findFBMessageInput(page);
    if (msgInput) {
      await typeIntoInput(page, msgInput, message);
      await new Promise(function(r) { setTimeout(r, 3000); });
      await saveCookies(page, 'facebook');
      return { success: true, debug: 'sent_via_messenger_direct' };
    }
    return { success: false, error: 'Campo de mensagem nao encontrado no Messenger directo' };
  } catch (e: any) {
    return { success: false, error: 'Messenger directo falhou: ' + e.message };
  }
}

// --- Type into message input (handles both textarea and contenteditable) ---
async function typeIntoInput(page: any, msgInput: any, message: string): Promise<void> {
  await msgInput.click();
  await new Promise(function(r) { setTimeout(r, 800); });

  var isStandard = await page.evaluate(function(el: any) {
    return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
  }, msgInput).catch(function() { return false; });

  if (isStandard) {
    await msgInput.type(message, { delay: 25 + Math.random() * 35 });
  } else {
    // contenteditable — usar keyboard.type() apos focus
    await msgInput.focus();
    await new Promise(function(r) { setTimeout(r, 300); });
    await page.keyboard.type(message, { delay: 25 + Math.random() * 35 });
  }
  console.log('[FB-DM] Mensagem digitada (' + message.length + ' chars)');

  await new Promise(function(r) { setTimeout(r, 400 + Math.random() * 500); });
  await page.keyboard.press('Enter');
  console.log('[FB-DM] Enter pressionado');
}

// --- Build Facebook profile URL ---
function buildFBProfileUrl(target: string): string {
  // If it's already a URL, use it
  if (target.startsWith('http')) return target;
  // If it looks like a numeric ID
  if (/^\d+$/.test(target)) return 'https://www.facebook.com/profile.php?id=' + target;
  // Username
  return 'https://www.facebook.com/' + target;
}

// --- Find Message button on Facebook profile ---
async function findFBMessageButton(page: any): Promise<any> {
  // Strategy 1: aria-label "Message"
  var btn = await page.$('a[aria-label="Message"], div[role="button"][aria-label="Message"]').catch(function() { return null; });
  if (btn) return btn;

  // Strategy 2: Span with text "Message"
  var spans = await page.$$('span');
  for (var span of spans) {
    try {
      var text = await page.evaluate(function(el: any) { return el.textContent || ''; }, span);
      if (text.trim() === 'Message') {
        var parent = await span.evaluateHandle(function(el: any) { return el.closest('a, button, div[role="button"]'); });
        if (parent && parent.asElement()) return parent;
      }
    } catch (e) { }
  }

  // Strategy 3: Link with /messages/ or /dialog/send
  var links = await page.$$('a[href*="/messages/"], a[href*="/dialog/send"]');
  if (links.length > 0) return links[0];

  // Strategy 4: Any button with text containing "Message" (case insensitive)
  var allBtns = await page.$$('a[role="button"], div[role="button"]');
  for (var b of allBtns) {
    try {
      var btxt = await page.evaluate(function(el: any) { return el.textContent || ''; }, b);
      if (btxt.trim().toLowerCase().includes('message') && btxt.trim().length < 20) {
        return b;
      }
    } catch (e) { }
  }

  return null;
}

// --- Find message input in Facebook Messenger ---
async function findFBMessageInput(page: any): Promise<any> {
  // Strategy 1: contenteditable div (current Messenger uses this)
  var editable = await page.$('div[contenteditable="true"][role="textbox"]');
  if (editable) return editable;

  // Strategy 2: Any contenteditable in the message area
  var editables = await page.$$('div[contenteditable="true"]');
  for (var el of editables) {
    try {
      var ariaLabel = await page.evaluate(function(e: any) { return e.getAttribute('aria-label') || ''; }, el);
      if (ariaLabel.includes('Message') || ariaLabel.includes('message') || ariaLabel.includes('Aa') || ariaLabel.includes('text')) return el;
    } catch (e) { }
  }

  // Strategy 3: textarea with common placeholders
  var textarea = await page.$('textarea[placeholder*="Aa"], textarea[placeholder*="message"], textarea[aria-label*="Message"]');
  if (textarea) return textarea;

  // Strategy 4: textarea without specific attributes (generic)
  var anyTextarea = await page.$('textarea');
  if (anyTextarea) return anyTextarea;

  return null;
}
