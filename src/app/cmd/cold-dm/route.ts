// ============================================================
//  Route: /cmd/cold-dm — Cold DMs via Bright Data Scraping Browser
//  Puppeteer real + proxy residencial + anti-detect built-in
//  Acoes: status, login_ig, login_fb, send_ig, send_fb, batch,
//         ai_send_ig, ai_send_fb, ai_generate, import_cookies, keep_alive
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

// Dynamic imports — puppeteer-core pesado, carregar sob demanda
var _bdModule: any = null;
var _igModule: any = null;
var _fbModule: any = null;

async function getBD() {
  if (!_bdModule) _bdModule = await import('@/lib/brightdata-browser');
  return _bdModule;
}
async function getIG() {
  if (!_igModule) _igModule = await import('@/lib/ig-cold-dm');
  return _igModule;
}
async function getFB() {
  if (!_fbModule) _fbModule = await import('@/lib/fb-cold-dm');
  return _fbModule;
}

export var maxDuration = 300;

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  try {
    // === STATUS ===
    if (action === 'status') {
      var bd = await getBD();
      var status = bd.getStatus() as any;
      try {
        var wsEndpoint = bd.buildWSEndpoint();
        status.ws_endpoint_preview = wsEndpoint.replace(/:[^@]*@/, ':***@');
      } catch (e: any) {
        status.ws_error = e.message;
      }
      return NextResponse.json({ success: true, provider: 'bright_data_scraping_browser', ...status });
    }

    // === TEST CONNECTION ===
    if (action === 'test') {
      var bd = await getBD();
      var conn = await bd.connectBrowser('instagram');
      var page = conn.page;
      await page.goto('https://api.ipify.org?format=json', { waitUntil: 'networkidle2', timeout: 30000 });
      var text = await page.evaluate(function() { return document.body.innerText; });
      await bd.cleanup('instagram');
      return NextResponse.json({
        success: true,
        message: 'Bright Data Scraping Browser conectado com sucesso',
        ip_info: text,
      });
    }

    // === DEBUG INSTAGRAM ===
    if (action === 'debug_ig') {
      var bd = await getBD();
      var conn = await bd.connectBrowser('instagram');
      var page = conn.page;
      var debugInfo: any = { steps: [] };
      try {
        debugInfo.steps.push('Navigating to instagram.com...');
        var resp = await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2', timeout: 30000 });
        debugInfo.status = resp ? resp.status() : null;
        debugInfo.url = page.url();
        debugInfo.title = await page.title().catch(function() { return ''; });
        await new Promise(function(r) { setTimeout(r, 3000); });
        debugInfo.url_after_wait = page.url();
        // Get page text
        debugInfo.body_text = await page.evaluate(function() {
          return document.body ? document.body.innerText.substring(0, 600) : '';
        }).catch(function() { return ''; });
        // Get screenshot as base64
        debugInfo.screenshot = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
        // Check for specific elements
        debugInfo.has_login_form = !!(await page.$('input[name="username"]').catch(function() { return null; }));
        debugInfo.has_main = !!(await page.$('main').catch(function() { return null; }));
        debugInfo.cookies_count = (await page.cookies()).length;
        // Detailed element analysis
        debugInfo.elements = await page.evaluate(function() {
          var inputs = document.querySelectorAll('input');
          var inputDetails = [];
          for (var i = 0; i < inputs.length; i++) {
            inputDetails.push({ name: inputs[i].name, type: inputs[i].type, id: inputs[i].id, placeholder: inputs[i].placeholder });
          }
          var forms = document.querySelectorAll('form');
          var formDetails = [];
          for (var i = 0; i < forms.length; i++) {
            formDetails.push({ action: forms[i].action, id: forms[i].id, method: forms[i].method });
          }
          var buttons = document.querySelectorAll('button');
          var buttonCount = buttons.length;
          return { inputs: inputDetails, forms: formDetails, buttons: buttonCount, allInputCount: inputs.length };
        }).catch(function() { return { error: 'evaluate failed' }; });
      } catch (e: any) {
        debugInfo.error = e.message;
      }
      await bd.cleanup('instagram');
      return NextResponse.json({ success: true, debug: debugInfo });
    }

    // === LOGIN INSTAGRAM ===
    if (action === 'login_ig') {
      var username = (body.username || process.env.IG_USERNAME || '').trim();
      var password = (body.password || process.env.IG_PASSWORD || '').trim();
      if (!username || !password) {
        return NextResponse.json({ success: false, error: 'username e password necessarios (env vars IG_USERNAME/IG_PASSWORD ou no body)' });
      }
      var bd = await getBD();
      var conn = await bd.connectBrowser('instagram');
      var loggedIn = await bd.loginInstagram(conn.page, username, password);
      if (!loggedIn) {
        // Collect debug info before cleanup
        var debugUrl = conn.page.url();
        var debugText = await conn.page.evaluate(function() { return document.body ? document.body.innerText.substring(0, 400) : ''; }).catch(function() { return ''; });
        var debugScreenshot = await conn.page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
        await bd.cleanup('instagram');
        return NextResponse.json({
          success: false,
          error: 'Login falhou.',
          debug: {
            final_url: debugUrl,
            page_text: debugText,
            screenshot: debugScreenshot,
          },
        });
      }
      // NAO fazer cleanup — manter sessao viva para send_ig subsequente
      return NextResponse.json({ success: true, message: 'Login IG efetuado. Sessao salva e activa.', session_active: true });
    }

    // === DEBUG FACEBOOK ===
    if (action === 'debug_fb') {
      var bd = await getBD();
      var conn = await bd.connectBrowser('facebook');
      var page = conn.page;
      var debugInfo: any = { steps: [] };
      try {
        debugInfo.steps.push('Navigating to facebook.com...');
        var resp = await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
        debugInfo.status = resp ? resp.status() : null;
        debugInfo.url = page.url();
        debugInfo.title = await page.title().catch(function() { return ''; });
        await new Promise(function(r) { setTimeout(r, 3000); });
        debugInfo.url_after_wait = page.url();
        debugInfo.body_text = await page.evaluate(function() {
          return document.body ? document.body.innerText.substring(0, 600) : '';
        }).catch(function() { return ''; });
        debugInfo.screenshot = await page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
        debugInfo.has_login_form = !!(await page.$('#email').catch(function() { return null; }));
        debugInfo.has_feed = !!(await page.$('[role="main"]').catch(function() { return null; }));
        debugInfo.cookies_count = (await page.cookies()).length;
      } catch (e: any) {
        debugInfo.error = e.message;
      }
      await bd.cleanup('facebook');
      return NextResponse.json({ success: true, debug: debugInfo });
    }

    // === LOGIN FACEBOOK ===
    if (action === 'login_fb') {
      var email = (body.email || '').trim();
      var password = (body.password || '').trim();
      if (!email || !password) {
        return NextResponse.json({ success: false, error: 'email e password necessarios' });
      }
      var bd = await getBD();
      var conn = await bd.connectBrowser('facebook');
      var loggedIn = await bd.loginFacebook(conn.page, email, password);
      if (!loggedIn) {
        var debugUrl = conn.page.url();
        var debugText = await conn.page.evaluate(function() { return document.body ? document.body.innerText.substring(0, 400) : ''; }).catch(function() { return ''; });
        var debugScreenshot = await conn.page.screenshot({ encoding: 'base64' }).catch(function() { return null; });
        await bd.cleanup('facebook');
        return NextResponse.json({
          success: false,
          error: 'Login FB falhou.',
          debug: {
            final_url: debugUrl,
            page_text: debugText,
            screenshot: debugScreenshot,
          },
        });
      }
      // NAO fazer cleanup — manter sessao viva para send_fb subsequente
      return NextResponse.json({ success: true, message: 'Login FB efetuado. Sessao salva e activa.', session_active: true });
    }

    // === SEND INSTAGRAM COLD DM ===
    if (action === 'send_ig') {
      var username = (body.username || '').replace(/^@/, '');
      var message = body.message || '';
      if (!username || !message) {
        return NextResponse.json({ success: false, error: 'username e mensagem necessarios' });
      }
      var ig = await getIG();
      var result = await ig.igColdDM(username, message, {
        igUsername: body.ig_username || undefined,
        igPassword: body.ig_password || undefined,
      });
      return NextResponse.json(result);
    }

    // === SEND FACEBOOK COLD DM ===
    if (action === 'send_fb') {
      var target = (body.target || body.username || '').trim();
      var message = body.message || '';
      if (!target || !message) {
        return NextResponse.json({ success: false, error: 'target e mensagem necessarios' });
      }
      var fb = await getFB();
      var result = await fb.fbColdDM(target, message, {
        fbEmail: body.fb_email || undefined,
        fbPassword: body.fb_password || undefined,
      });
      return NextResponse.json(result);
    }

    // === BATCH SEND ===
    if (action === 'batch') {
      var targets = body.targets || [];
      var platform = body.platform || 'instagram';
      var defaultMsg = body.message || body.defaultMessage || '';
      var delay = (body.delay || 8000);

      if (!Array.isArray(targets) || !targets.length) {
        return NextResponse.json({ success: false, error: 'targets necessario (array)' });
      }
      if (targets.length > 30) {
        return NextResponse.json({ success: false, error: 'Maximo 30 por batch' });
      }

      var results: any[] = [];
      for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var targetUser = (t.username || t.target || '').replace(/^@/, '');
        var msg = t.message || defaultMsg;
        if (!targetUser || !msg) {
          results.push({ target: targetUser, success: false, error: 'target ou mensagem vazio' });
          continue;
        }
        try {
          var r: any;
          if (platform === 'facebook') {
            var fbMod = await getFB();
            r = await fbMod.fbColdDM(targetUser, msg, {
              fbEmail: body.fb_email || undefined,
              fbPassword: body.fb_password || undefined,
            });
          } else {
            var igMod = await getIG();
            r = await igMod.igColdDM(targetUser, msg, {
              igUsername: body.ig_username || undefined,
              igPassword: body.ig_password || undefined,
            });
          }
          results.push({ target: targetUser, ...r });
        } catch (e: any) {
          results.push({ target: targetUser, success: false, error: e.message });
        }
        if (i < targets.length - 1) {
          var jitter = delay + (Math.random() * 3000 - 1500);
          console.log('[ColdDM] Esperando ' + Math.round(jitter/1000) + 's...');
          await new Promise(function(res) { setTimeout(res, jitter); });
        }
      }

      var sent = results.filter(function(r: any) { return r.success; }).length;
      var failed = results.filter(function(r: any) { return !r.success; }).length;
      return NextResponse.json({ success: sent > 0, platform, sent, failed, total: results.length, results });
    }

    // === AI-POWERED SEND ===
    // Gera mensagem via AI (tom Grok) e envia DM
    if (action === 'ai_send_ig' || action === 'ai_send_fb') {
      var isIG = action === 'ai_send_ig';
      var aiPlatform = isIG ? 'instagram' : 'facebook';
      var aiTarget = (body.target || body.username || '').trim().replace(/^@/, '');
      if (!aiTarget) {
        return NextResponse.json({ success: false, error: 'target necessario' });
      }

      // Import AI module
      var aiModule: any = await import('@/lib/ai');

      // Generate AI message
      var aiContext: any = {
        platform: isIG ? 'Instagram' : 'Facebook',
        username: aiTarget,
      };
      if (body.bio) aiContext.bio = body.bio;
      if (body.category) aiContext.category = body.category;
      if (body.notes) aiContext.notes = body.notes;

      var aiPrompt = '@' + aiTarget + ' — ' + (body.context || 'prospecto') + (body.objective ? '. Objectivo: ' + body.objective : '');

      var aiMessage = await aiModule.generateAIResponse(aiPrompt, {
        systemPrompt: aiModule.getColdDMSystemPrompt(),
        maxTokens: 150,
        temperature: 0.8,
        context: aiContext,
      });

      if (!aiMessage) {
        aiMessage = body.fallback_message || 'Ola! Gostaria de conversar contigo sobre uma oportunidade. Tens disponibilidade?';
      }

      console.log('[cold-dm] AI gerou mensagem: ' + aiMessage);

      // Send the DM
      var sendResult: any;
      if (isIG) {
        var igAI = await getIG();
        sendResult = await igAI.igColdDM(aiTarget, aiMessage, {
          igUsername: body.ig_username || undefined,
          igPassword: body.ig_password || undefined,
        });
      } else {
        var fbAI = await getFB();
        sendResult = await fbAI.fbColdDM(aiTarget, aiMessage, {
          userId: body.userId || undefined,
        });
      }

      return NextResponse.json({
        ...sendResult,
        ai_generated_message: aiMessage,
        platform: aiPlatform,
      });
    }

    // === GENERATE AI MESSAGE ONLY (without sending) ===
    if (action === 'ai_generate' || action === 'ai_debug') {
      var aiGenModule: any = await import('@/lib/ai');
      var genTarget = body.target || body.username || 'prospect';
      var genPlatform = body.platform || 'instagram';

      if (action === 'ai_debug') {
        var testModel = body.model || undefined;
        var rawData = await aiGenModule.generateAIResponseRaw(
          body.prompt || 'Diga ola',
          { maxTokens: body.max_tokens || 150 },
          testModel
        );
        return NextResponse.json({ success: true, raw: rawData });
      }

      var genAiMessage = await aiGenModule.generateAIResponse(
        '@' + genTarget + ' — ' + (body.context || 'prospects') + (body.objective ? '. Objectivo: ' + body.objective : ''),
        {
          systemPrompt: aiGenModule.getColdDMSystemPrompt(),
          maxTokens: 150,
          temperature: 0.8,
          context: { platform: genPlatform, username: genTarget },
        }
      );
      return NextResponse.json({ success: true, message: genAiMessage, platform: genPlatform, target: genTarget });
    }

    // === COOKIES ===
    if (action === 'cookies') {
      var sub = body.sub || 'list';
      var cookieDir = '/tmp/aura-brightdata-cookies';
      if (!fs.existsSync(cookieDir)) {
        return NextResponse.json({ success: true, cookies: { instagram: false, facebook: false } });
      }
      if (sub === 'delete') {
        var plat = body.platform || 'all';
        var deleted: string[] = [];
        if (plat === 'all' || plat === 'instagram') {
          var p = path.join(cookieDir, 'instagram-cookies.json');
          if (fs.existsSync(p)) { fs.unlinkSync(p); deleted.push('instagram'); }
        }
        if (plat === 'all' || plat === 'facebook') {
          var p2 = path.join(cookieDir, 'facebook-cookies.json');
          if (fs.existsSync(p2)) { fs.unlinkSync(p2); deleted.push('facebook'); }
        }
        return NextResponse.json({ success: true, deleted });
      }
      var igExists = fs.existsSync(path.join(cookieDir, 'instagram-cookies.json'));
      var fbExists = fs.existsSync(path.join(cookieDir, 'facebook-cookies.json'));
      return NextResponse.json({ success: true, cookies: { instagram: igExists ? 'saved' : 'none', facebook: fbExists ? 'saved' : 'none' } });
    }

    // === CLEANUP ===
    if (action === 'cleanup') {
      var bd = await getBD();
      await bd.cleanup(body.platform);
      return NextResponse.json({ success: true, message: 'Cleanup feito' });
    }

    // === IMPORT COOKIES (from user's phone — PERSISTENT) ===
    if (action === 'import_cookies') {
      var cookiePlatform = (body.platform || 'instagram').trim();
      var cookies = body.cookies;
      if (cookiePlatform !== 'instagram' && cookiePlatform !== 'facebook') {
        return NextResponse.json({ success: false, error: 'platform deve ser "instagram" ou "facebook"' });
      }
      if (!cookies) {
        return NextResponse.json({ success: false, error: 'cookies necessario — envia o array JSON exportado do browser' });
      }
      // If cookies is a string (JSON), parse it
      if (typeof cookies === 'string') {
        try { cookies = JSON.parse(cookies); } catch (e: any) {
          return NextResponse.json({ success: false, error: 'cookies string invalido — deve ser JSON array valido' });
        }
      }
      var bdImport = await getBD();
      var cookieResult = await bdImport.importCookies(cookiePlatform, cookies);
      return NextResponse.json(cookieResult);
    }

    // === KEEP ALIVE (ping to refresh session) ===
    if (action === 'keep_alive') {
      var keepAlivePlatform = (body.platform || 'instagram').trim();
      if (keepAlivePlatform !== 'instagram' && keepAlivePlatform !== 'facebook') {
        return NextResponse.json({ success: false, error: 'platform deve ser "instagram" ou "facebook"' });
      }
      var bdKeep = await getBD();
      var keepResult = await bdKeep.keepAlive(keepAlivePlatform);
      return NextResponse.json({ success: keepResult.alive, ...keepResult });
    }

    // === SYNC COOKIES TO RAILWAY (persist env vars across restarts) ===
    if (action === 'sync_env') {
      var RAILWAY_TOKEN = process.env.RAILWAY_API_TOKEN || '';
      var RAILWAY_ENV_ID = process.env.RAILWAY_ENV_ID || '';
      var RAILWAY_PROJECT_ID = process.env.RAILWAY_PROJECT_ID || '17256a66-27b2-41db-bef2-0d7f05c5e26b';
      if (!RAILWAY_TOKEN || !RAILWAY_ENV_ID) {
        return NextResponse.json({
          success: false,
          error: 'RAILWAY_API_TOKEN e RAILWAY_ENV_ID necessarios nas env vars para sync',
        });
      }
      var updates: any = {};
      var igB64 = process.env['AURA_IG_COOKIES_B64'];
      var fbB64 = process.env['AURA_FB_COOKIES_B64'];
      if (igB64) updates.AURA_IG_COOKIES_B64 = igB64;
      if (fbB64) updates.AURA_FB_COOKIES_B64 = fbB64;
      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ success: false, error: 'Nenhum cookie em memoria para sincronizar' });
      }
      // Sync each variable to Railway (one at a time)
      var synced: string[] = [];
      var errors: string[] = [];
      for (var _i = 0, _entries = Object.entries(updates); _i < _entries.length; _i++) {
        var _a = _entries[_i], key = _a[0], val = _a[1];
        try {
          var mutation = 'mutation($projectId: String!, $environmentId: String!, $name: String!, $value: String!) { variableUpsert(input: {projectId: $projectId, environmentId: $environmentId, name: $name, value: $value}) }';
          var syncResp = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + RAILWAY_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mutation, variables: { projectId: RAILWAY_PROJECT_ID, environmentId: RAILWAY_ENV_ID, name: key, value: val } }),
          });
          var syncResultData = await syncResp.json();
          if (syncResultData.errors) {
            errors.push(key + ': ' + syncResultData.errors[0].message);
          } else {
            synced.push(key);
          }
        } catch (e: any) {
          errors.push(key + ': ' + e.message);
        }
      }
      return NextResponse.json({
        success: synced.length > 0,
        message: synced.length > 0 ? 'Cookies sincronizados com Railway (persistentes entre restarts!)' : 'Falha ao sincronizar',
        synced: synced,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    console.error('[cold-dm] Error:', e);
    return NextResponse.json({ success: false, error: e.message, stack: e.stack?.substring(0, 500) });
  }
}
