// Route: /cmd/ig-login — IG Login (multi-approach)
// 1. API login (instagram-private-api) — pode ser bloqueado
// 2. import_cookie — utilizador extrai sessionid do telefone
// 3. Browserless web login — ultimo recurso

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export var maxDuration = 60;

var IG_USER = 'jesuaine07';
var IG_PASS = 'X2VpFZY@)u-H%89';

async function saveSessionToDB(sessionJson: string) {
  var { db, ensureDatabase } = await import('@/lib/db');
  await ensureDatabase();
  await db.systemSetting.upsert({
    where: { key: 'ig_private_session' },
    update: { value: sessionJson },
    create: { key: 'ig_private_session', value: sessionJson },
  });
}

async function saveChallengeState(stateB64: string) {
  var { db, ensureDatabase } = await import('@/lib/db');
  await ensureDatabase();
  await db.systemSetting.upsert({
    where: { key: 'ig_login_challenge' },
    update: { value: stateB64 },
    create: { key: 'ig_login_challenge', value: stateB64 },
  });
}

async function loadChallengeState(): Promise<string | null> {
  var { db, ensureDatabase } = await import('@/lib/db');
  await ensureDatabase();
  var setting = await db.systemSetting.findUnique({ where: { key: 'ig_login_challenge' } });
  return setting?.value || null;
}

// === APPROACH 3: Import sessionid cookie do telefone ===
// O utilizador faz login no IG pelo browser do telefone e extrai o cookie sessionid
async function importSessionCookie(sessionid: string, username: string) {
  var { IgApiClient } = await import('instagram-private-api');
  var ig = new IgApiClient();
  ig.state.generateDevice(username);

  // Adicionar cookie sessionid ao cookie jar
  var cookieJar = ig.request.cookieJar;
  var tough = await import('tough-cookie');
  var cookie = new tough.Cookie({
    key: 'sessionid',
    value: sessionid,
    domain: '.instagram.com',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'None',
  });
  cookieJar.setCookieSync(cookie, 'https://www.instagram.com');

  // Tambem adicionar ds_user_id e csrftoken basicos
  // Estes sao necessarios para a API funcionar
  if (username) {
    var userIdCookie = new tough.Cookie({
      key: 'ds_user_id',
      value: username,
      domain: '.instagram.com',
      path: '/',
      httpOnly: false,
      secure: true,
    });
    cookieJar.setCookieSync(userIdCookie, 'https://www.instagram.com');
  }

  // Gerar um csrftoken aleatorio
  var crypto = await import('crypto');
  var csrfToken = crypto.randomBytes(16).toString('hex');
  var csrfCookie = new tough.Cookie({
    key: 'csrftoken',
    value: csrfToken,
    domain: '.instagram.com',
    path: '/',
    httpOnly: false,
    secure: true,
  });
  cookieJar.setCookieSync(csrfCookie, 'https://www.instagram.com');

  // Verificar se a sessao funciona
  var user = await ig.account.currentUser();

  // Se funcionou, serializar e salvar
  var state = await ig.state.serialize();
  var stateJson = JSON.stringify(state);
  await saveSessionToDB(stateJson);

  return {
    success: true,
    step: 'cookie_imported',
    username: user.username,
    userId: user.pk,
    followers: user.follower_count,
    message: 'Sessao importada com sucesso! Podes enviar cold DMs agora.',
  };
}

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // === CHECK STATUS ===
  if (action === 'status') {
    var { db, ensureDatabase } = await import('@/lib/db');
    await ensureDatabase();
    var setting = await db.systemSetting.findUnique({ where: { key: 'ig_private_session' } });
    return NextResponse.json({
      success: true,
      hasSession: !!setting,
      email: 'batmanjustice707@gmail.com',
      username: IG_USER,
    });
  }

  // === APPROACH 2: IMPORT COOKIE (do telefone) ===
  // O utilizador extrai o sessionid do browser do telefone
  if (action === 'import_cookie') {
    var sessionid = (body.sessionid || '').trim();
    var username = (body.username || IG_USER).trim();

    if (!sessionid) {
      return NextResponse.json({
        success: false,
        error: 'Envia o campo sessionid (valor do cookie sessionid do Instagram)',
        hint: 'Abre o Instagram no browser do teu telefone, faz login, e usa uma app de cookies para copiar o valor de sessionid.',
        instructions: [
          '1. Abre o Chrome no teu telefone',
          '2. Vai a instagram.com e faz login',
          '3. Instala a app "Cookie Manager" da Play Store',
          '4. Abre a app e procura cookies de instagram.com',
          '5. Copia o valor do cookie chamado "sessionid"',
          '6. Envia aqui com: {"action":"import_cookie", "sessionid":"COPIA_AQUI"}',
        ],
      });
    }

    try {
      var result = await importSessionCookie(sessionid, username);
      return NextResponse.json(result);
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        step: 'cookie_import_failed',
        error: e.message || String(e),
        hint: 'O sessionid pode estar expirado ou incorrecto. Tenta fazer login novamente no Instagram e extrair o cookie de novo.',
      });
    }
  }

  // === APPROACH 1: API LOGIN (pode ser bloqueado pelo IG) ===
  if (action === 'login') {
    var username = body.username || IG_USER;
    var password = body.password || IG_PASS;

    try {
      var { IgApiClient } = await import('instagram-private-api');
      var ig = new IgApiClient();
      ig.state.generateDevice(username);

      var user = await ig.account.login(username, password);

      var state = await ig.state.serialize();
      var stateJson = JSON.stringify(state);
      await saveSessionToDB(stateJson);

      return NextResponse.json({
        success: true,
        step: 'logged_in',
        username: user.username,
        userId: user.pk,
        followers: user.follower_count,
        message: 'Login feito! Pode enviar cold DMs agora.',
      });

    } catch (e: any) {
      var errorMsg = e.message || String(e);
      var errorName = e.name || '';

      // Verificar se e um checkpoint/challenge
      var isChallenge = errorName.includes('Checkpoint') ||
                        errorName.includes('Challenge') ||
                        errorMsg.includes('checkpoint') ||
                        errorMsg.includes('challenge_required') ||
                        errorMsg.includes('challenge');

      if (isChallenge) {
        try {
          var stateB64 = '';
          try {
            var state = await ig.state.serialize();
            stateB64 = Buffer.from(JSON.stringify(state)).toString('base64');
          } catch (serErr: any) {
            return NextResponse.json({
              success: false,
              step: 'challenge_no_state',
              error: 'Challenge detectado mas nao conseguiu salvar estado: ' + serErr.message,
              igError: errorMsg.substring(0, 500),
            });
          }

          await saveChallengeState(stateB64);
          return NextResponse.json({
            success: false,
            step: 'needs_code',
            needsCode: true,
            email: 'batmanjustice707@gmail.com',
            message: 'Codigo enviado para batmanjustice707@gmail.com.',
          });
        } catch (stateErr: any) {
          return NextResponse.json({
            success: false,
            step: 'challenge_state_error',
            error: stateErr.message,
            igError: errorMsg.substring(0, 500),
          });
        }
      }

      // Erro especifico: conta ligada ao Facebook
      if (errorMsg.includes('linked Facebook') || errorMsg.includes('Facebook account')) {
        return NextResponse.json({
          success: false,
          step: 'fb_linked',
          error: errorMsg,
          hint: 'O Instagram bloqueia o login por API porque detecta ligacao com Facebook.',
          solution: 'Usa action=import_cookie para importar a sessao do teu telefone.',
          instructions: [
            '1. Abre Chrome no teu telefone',
            '2. Vai a instagram.com e faz login',
            '3. Baixa a app "Cookie Inspector" da Play Store',
            '4. Abre a app, procura instagram.com',
            '5. Copia o valor do cookie "sessionid"',
            '6. Envia: action=import_cookie, sessionid=VALOR',
          ],
        });
      }

      // Erro generico
      return NextResponse.json({
        success: false,
        step: 'login_failed',
        errorName: errorName,
        error: errorMsg,
        hint: 'Login via API falhou. Tenta action=import_cookie como alternativa.',
      });
    }
  }

  // === VERIFY CODE (se o login por API funcionar com challenge) ===
  if (action === 'verify') {
    var code = (body.code || '').trim();
    if (!code || code.length < 4) {
      return NextResponse.json({ success: false, error: 'Codigo necessario (6 digitos do email)' });
    }

    var stateB64 = await loadChallengeState();
    if (!stateB64) {
      return NextResponse.json({ success: false, error: 'Sessao expirou. Faz login novamente (action=login).' });
    }

    try {
      var { IgApiClient } = await import('instagram-private-api');
      var ig = new IgApiClient();

      var stateJson = Buffer.from(stateB64, 'base64').toString('utf-8');
      var state = JSON.parse(stateJson);
      await ig.state.deserialize(state);

      try {
        await ig.challenge.sendSecurityCode(code);
      } catch (challengeErr: any) { /* tenta currentUser direto */ }

      var user = await ig.account.currentUser();
      var finalState = await ig.state.serialize();
      var finalJson = JSON.stringify(finalState);
      await saveSessionToDB(finalJson);

      try {
        var { db, ensureDatabase } = await import('@/lib/db');
        await ensureDatabase();
        await db.systemSetting.delete({ where: { key: 'ig_login_challenge' } });
      } catch (e) { /* ignore */ }

      return NextResponse.json({
        success: true,
        step: 'verified',
        username: user.username,
        userId: user.pk,
        message: 'Sessao IG activa! Podes enviar cold DMs agora.',
      });
    } catch (e: any) {
      return NextResponse.json({
        success: false,
        step: 'verify_failed',
        error: e.message || String(e),
        hint: 'Codigo errado ou expirado. Tenta login novamente.',
      });
    }
  }

  // === DELETE SESSION ===
  if (action === 'logout') {
    var { db, ensureDatabase } = await import('@/lib/db');
    await ensureDatabase();
    await db.systemSetting.delete({ where: { key: 'ig_private_session' } }).catch(function() {});
    await db.systemSetting.delete({ where: { key: 'ig_login_challenge' } }).catch(function() {});
    return NextResponse.json({ success: true, message: 'Sessao IG removida.' });
  }

  return NextResponse.json({ error: 'Accao: login, verify, import_cookie, status, ou logout' });
}
