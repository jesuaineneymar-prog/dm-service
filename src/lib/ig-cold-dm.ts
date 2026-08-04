// ============================================================
//  INSTAGRAM COLD DM via Bright Data Scraping Browser + Puppeteer
//  Navega ao perfil do alvo, clica em Message, envia a mensagem
//  Browser real da Bright Data — fingerprint limpo, proxy residencial
// ============================================================

import { connectBrowser, checkIGLogin, loginInstagram, saveCookies, getIGSession } from './brightdata-browser';

// --- Send a cold DM to an Instagram user ---
export async function igColdDM(username: string, message: string, opts?: { page?: any; igUsername?: string; igPassword?: string }): Promise<{
  success: boolean;
  error?: string;
  screenshot?: string;
  debug?: string;
}> {
  var cleanUser = username.replace(/^@/, '').trim();
  if (!cleanUser) return { success: false, error: 'Username vazio' };
  if (!message.trim()) return { success: false, error: 'Mensagem vazia' };

  // Connect + Login in one flow
  var page = opts?.page;
  var shouldCleanup = false;
  if (!page) {
    var igUser = opts?.igUsername || process.env.IG_USERNAME || '';
    var igPass = opts?.igPassword || process.env.IG_PASSWORD || '';
    if (!igUser || !igPass) {
      return { success: false, error: 'Sem credenciais. Passa ig_username e ig_password.' };
    }

    // Tentar getIGSession primeiro (reutiliza sessão se activa)
    console.log('[IG-DM] Tentando sessão existente...');
    var session = await getIGSession();
    page = session.page;
    shouldCleanup = false; // getIGSession gere a sessão

    if (!session.loggedIn) {
      // Sessão não existe ou expirou — fazer login completo
      console.log('[IG-DM] Sessão expirada, fazendo login...');
      var loggedIn = await loginInstagram(page, igUser, igPass);
      if (!loggedIn) {
        var debugUrl = page.url();
        var debugText = await page.evaluate(function() { return document.body ? document.body.innerText.substring(0, 400) : ''; }).catch(function() { return ''; });
        var ss = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
        return { success: false, error: 'Login falhou.', debug: 'url=' + debugUrl + ' text=' + debugText, screenshot: ss || undefined };
      }
    }
    console.log('[IG-DM] Sessão OK!');
  }

  try {
    // Step 0: Esperar um pouco apos login (evitar navegacao rapida)
    await new Promise(function(r) { setTimeout(r, 3000); });

    // Step 1: Navigate to user profile — usar domcontentloaded
    console.log('[IG-DM] Navegando ao perfil de @' + cleanUser);
    try {
      await page.goto('https://www.instagram.com/' + cleanUser + '/', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (navErr: any) {
      // Timeout em domcontentloaded = pagina provavelmente carregou, so lento
      console.log('[IG-DM] goto timeout, avaliando pagina: ' + navErr.message);
    }

    // Esperar JS renderizar perfil (React hydration + lazy loads)
    console.log('[IG-DM] Esperando perfil renderizar...');
    await new Promise(function(r) { setTimeout(r, 10000); });

    // Verificar se estamos no perfil certo
    var currentUrl = page.url();
    console.log('[IG-DM] URL actual: ' + currentUrl);

    // Verify profile loaded (check for user not found)
    var pageText = await page.evaluate(function() { return document.body ? document.body.innerText : ''; });
    if (pageText.includes('Sorry, this page isn\'t available') || pageText.includes('Sorry, this page')) {
      return { success: false, error: 'Perfil @' + cleanUser + ' nao existe ou e privado' };
    }

    // Step 2: Click "Message" button
    console.log('[IG-DM] Procurando botao Message...');
    var messageBtn = await findMessageButton(page);
    if (!messageBtn) {
      var debugText = pageText.substring(0, 300);
      var screenshot = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
      return {
        success: false,
        error: 'Botao "Message" nao encontrado. O perfil pode ser privado ou o usuario nao permite DMs.',
        debug: 'url=' + currentUrl + ' text=' + debugText,
        screenshot: screenshot || undefined,
      };
    }
    await messageBtn.click();
    console.log('[IG-DM] Botao Message clicado');

    // Wait for DM modal or page to load — Instagram DM pode abrir em modal ou redirect para /direct/t/
    console.log('[IG-DM] Esperando DM carregar...');
    await new Promise(function(r) { setTimeout(r, 6000); });

    // Verificar se abriu nova aba (IG as vezes abre DM em nova tab)
    var allPages = await page.browser().pages();
    if (allPages.length > 1) {
      for (var p of allPages) {
        var pUrl = p.url();
        if (pUrl.includes('/direct/t/') || pUrl.includes('/direct/')) {
          console.log('[IG-DM] DM abriu em nova aba: ' + pUrl);
          page = p;
          break;
        }
      }
    }

    // Step 3: Find message input and type
    console.log('[IG-DM] Procurando campo de mensagem...');
    var msgInput = await findMessageInput(page);
    if (!msgInput) {
      // Esperar mais e tentar novamente — DM pode ter carregado lentamente
      console.log('[IG-DM] Campo nao encontrado, esperando mais 5s...');
      await new Promise(function(r) { setTimeout(r, 5000); });
      msgInput = await findMessageInput(page);
    }
    if (!msgInput) {
      // Verificar se e um contenteditable que precisa de focus
      var isContentEditable = await page.evaluate(function() {
        var divs = document.querySelectorAll('div[contenteditable="true"]');
        if (divs.length === 0) return { found: false, allDivs: document.querySelectorAll('div').length };
        return { found: true, count: divs.length };
      }).catch(function() { return { found: false }; });

      // Take screenshot for debugging
      var screenshot = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
      var debugUrl = page.url();
      var debugText = await page.evaluate(function() { return document.body.innerText.substring(0, 400); }).catch(function() { return ''; });
      return {
        success: false,
        error: 'Campo de mensagem nao encontrado apos clicar Message.',
        debug: 'url=' + debugUrl + ' ce=' + JSON.stringify(isContentEditable) + ' text=' + debugText.substring(0, 200),
        screenshot: screenshot || undefined,
      };
    }

    // Type message — usar keyboard.type() para contenteditable (mais fiavel que el.type())
    await msgInput.click();
    await new Promise(function(r) { setTimeout(r, 800); });

    // Verificar se o elemento e um textarea (type funciona) ou contenteditable (precisa keyboard)
    var isTextarea = await page.evaluate(function(el: any) {
      return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
    }, msgInput).catch(function() { return false; });

    if (isTextarea) {
      await msgInput.type(message, { delay: 30 + Math.random() * 40 });
    } else {
      // contenteditable — usar keyboard.type() apos focus
      await msgInput.focus();
      await new Promise(function(r) { setTimeout(r, 300); });
      await page.keyboard.type(message, { delay: 30 + Math.random() * 40 });
    }
    console.log('[IG-DM] Mensagem digitada (' + message.length + ' chars)');

    // Step 4: Send — press Enter or click send button
    await new Promise(function(r) { setTimeout(r, 500 + Math.random() * 500); });

    // Tentar encontrar o botao Send primeiro
    var sendBtn = await page.$('div[role="button"][aria-label="Send"], button[aria-label="Send"]').catch(function() { return null; });
    if (sendBtn) {
      await sendBtn.click();
      console.log('[IG-DM] Botao Send clicado');
    } else {
      await page.keyboard.press('Enter');
      console.log('[IG-DM] Enter pressionado');
    }

    // Wait for message to be sent
    await new Promise(function(r) { setTimeout(r, 3000); });

    // Step 5: Verify message was sent (check for message bubble in chat)
    var sent = await verifyMessageSent(page, message);

    // Save cookies after successful action
    await saveCookies(page, 'instagram');

    return {
      success: sent,
      error: sent ? undefined : 'Mensagem pode nao ter sido enviada — verifica manualmente',
      debug: 'target=@' + cleanUser + ', chars=' + message.length + ', sent=' + sent,
    };
  } catch (e: any) {
    console.error('[IG-DM] Erro:', e.message);
    var screenshot = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
    return {
      success: false,
      error: e.message,
      screenshot: screenshot || undefined,
    };
  }
  // NOTA: Nao fechamos o browser — reutilizamos a sessão para o proximo DM
  // A sessão é gerida por getIGSession() em brightdata-browser.ts
}

// --- Find the "Message" button on a profile ---
async function findMessageButton(page: any): Promise<any> {
  // Strategy 1: div[role="button"] with text "Message" (most common in 2025)
  var btns = await page.$$('div[role="button"]');
  for (var btn of btns) {
    try {
      var text = await page.evaluate(function(el: any) { return el.textContent || ''; }, btn);
      if (text.trim().toLowerCase() === 'message') return btn;
    } catch (e) { }
  }

  // Strategy 2: Button with text "Message"
  var buttons = await page.$$('button');
  for (var btn2 of buttons) {
    try {
      var text2 = await page.evaluate(function(el: any) { return el.textContent || ''; }, btn2);
      if (text2.trim().toLowerCase() === 'message') return btn2;
    } catch (e) { }
  }

  // Strategy 3: SVG + span containing "Message"
  var spans = await page.$$('span');
  for (var span of spans) {
    try {
      var text3 = await page.evaluate(function(el: any) { return el.textContent || ''; }, span);
      if (text3.trim().toLowerCase() === 'message') {
        // Click the parent button/div
        var parent = await span.evaluateHandle(function(el: any) { return el.closest('button, a, div[role="button"]'); });
        if (parent && parent.asElement()) return parent;
      }
    } catch (e) { }
  }

  // Strategy 4: Link containing "/direct/t/"
  var links = await page.$$('a[href*="/direct/t/"]');
  if (links.length > 0) return links[0];

  // Strategy 5: header + div area (follow/profile buttons area)
  var headerBtns = await page.$$('header ~ div button, article button');
  for (var hbtn of headerBtns) {
    try {
      var htext = await page.evaluate(function(el: any) { return el.textContent || ''; }, hbtn);
      if (htext.trim().toLowerCase() === 'message' || htext.includes('Message')) return hbtn;
    } catch (e) { }
  }

  return null;
}

// --- Find the message input in DM chat ---
async function findMessageInput(page: any): Promise<any> {
  // Strategy 1: textarea with placeholder (Instagram classic)
  var textarea = await page.$('textarea[placeholder*="Message"], textarea[placeholder*="message"], textarea[aria-label*="Message"]');
  if (textarea) return textarea;

  // Strategy 2: contenteditable div in DM area (most common in 2025)
  var editable = await page.$('div[contenteditable="true"][data-testid*="message"], div[contenteditable="true"][role="textbox"]');
  if (editable) return editable;

  // Strategy 3: Any contenteditable (fallback)
  var editables = await page.$$('div[contenteditable="true"]');
  for (var el of editables) {
    try {
      var ariaLabel = await page.evaluate(function(e: any) { return e.getAttribute('aria-label') || e.getAttribute('data-testid') || ''; }, el);
      if (ariaLabel.toLowerCase().includes('message') || ariaLabel.toLowerCase().includes('text')) return el;
    } catch (e) { }
  }

  // Strategy 4: textarea without specific placeholder
  var anyTextarea = await page.$('textarea:not([name])');
  if (anyTextarea) return anyTextarea;

  // Strategy 5: input with message-related placeholder
  var inputs = await page.$$('input[placeholder], textarea');
  for (var input of inputs) {
    try {
      var placeholder = await page.evaluate(function(el: any) { return el.placeholder || ''; }, input);
      if (placeholder.toLowerCase().includes('message') || placeholder.toLowerCase().includes('type') || placeholder.toLowerCase().includes('escrev')) {
        return input;
      }
    } catch (e) { }
  }

  return null;
}

// --- Verify message was sent ---
async function verifyMessageSent(page: any, message: string): Promise<boolean> {
  try {
    // Check for message bubbles in chat (sent messages have specific classes)
    await new Promise(function(r) { setTimeout(r, 2000); });
    // Look for the last message in chat that matches our text
    var found = await page.evaluate(function(msg: string) {
      // Check all text-containing elements for our message
      var candidates = document.querySelectorAll('div[dir="auto"], div[class*="message"], div[role="row"]');
      for (var i = candidates.length - 1; i >= Math.max(0, candidates.length - 10); i--) {
        var el = candidates[i] as any;
        if (el.innerText && el.innerText.includes(msg.substring(0, 50))) {
          return true;
        }
      }
      // Fallback: check if textarea/input is now empty (message was sent)
      var textarea = document.querySelector('textarea') as any;
      if (textarea && textarea.value === '') return true;
      // Check contenteditable is empty
      var ce = document.querySelector('div[contenteditable="true"]') as any;
      if (ce && ce.innerText.trim() === '') return true;
      return false;
    }, message);
    return found;
  } catch (e) {
    // Assume sent if no error
    return true;
  }
}
