/**
 * Aura v4 — IG Login Server-Side (sem PC, sem browser)
 * Usa instagram-private-api diretamente no servidor
 * 
 * Uso:
 *   node ig-login-server.js login <username> <password>
 *   node ig-login-server.js verify <code> <state_json_base64>
 *   node ig-login-server.js resend <state_json_base64>
 * 
 * Fluxo:
 *   1. "login" → tenta login, se challenge, retorna state em base64
 *   2. Utilizador recebe codigo no email (batmanjustice707@gmail.com)
 *   3. "verify" → submete codigo, salva sessao final
 *   4. "resend" → reenvia codigo para o email
 */

const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

var SESSION_KEY = 'ig_private_session';
var CHALLENGE_KEY = 'ig_login_challenge';
var SESSION_FILE = path.join(__dirname, 'ig-session.json');

// === HELPERS ===

function saveSession(stateJson) {
  // Salvar localmente (para o send-ig-dm.js usar)
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(JSON.parse(stateJson), null, 2));
  } catch (e) { /* ignore */ }
  // Retornar o JSON para salvar no DB
  return stateJson;
}

function output(obj) {
  console.log(JSON.stringify(obj));
}

// === LOGIN ===
async function doLogin(username, password) {
  var ig = new IgApiClient();
  ig.state.generateDevice(username);

  try {
    var user = await ig.account.login(username, password);
    
    // Login directo sem challenge!
    var state = await ig.state.serialize();
    var stateJson = JSON.stringify(state);
    var savedPath = saveSession(stateJson);
    
    output({
      step: 'logged_in',
      success: true,
      username: user.username,
      userId: user.pk,
      followers: user.follower_count,
      sessionJson: stateJson,
      message: 'Login feito! Sessao salva. Pode enviar DMs agora.',
    });
    
  } catch (e) {
    var errorMsg = e.message || String(e);
    var errorName = e.name || '';
    
// Error will be output below after checking if it's a challenge
    
    // Verificar se e um checkpoint/challenge
    var isChallenge = errorName.includes('Checkpoint') || 
                      errorName.includes('Challenge') ||
                      errorMsg.includes('checkpoint') ||
                      errorMsg.includes('challenge_required') ||
                      errorMsg.includes('challenge');
    
    if (isChallenge) {
      try {
        var state = await ig.state.serialize();
        var stateB64 = Buffer.from(JSON.stringify(state)).toString('base64');
        
        output({
          step: 'challenge_required',
          success: false,
          needsCode: true,
          challengeType: 'email',
          email: 'batmanjustice707@gmail.com',
          stateB64: stateB64,
          message: 'Instagram enviou um codigo para batmanjustice707@gmail.com.',
        });
      } catch (stateErr) {
        output({
          step: 'challenge_state_error',
          success: false,
          error: 'Nao conseguiu serializar estado: ' + stateErr.message,
        });
      }
    } else {
      // Nao e challenge — erro de login normal
      output({
        step: 'login_failed',
        success: false,
        errorName: errorName,
        error: errorMsg,
        hint: 'Verifica credenciais. Se a conta esta ligada ao Facebook, precisa desligar primeiro nas definicoes do IG.',
      });
    }
  }
}

// === VERIFY CODE ===
async function doVerify(code, stateB64) {
  var ig = new IgApiClient();
  
  try {
    // Restaurar estado
    var stateJson = Buffer.from(stateB64, 'base64').toString('utf-8');
    var state = JSON.parse(stateJson);
    await ig.state.deserialize(state);
    
    // Tentar obter user atual (isso valida a sessao)
    var user = await ig.account.currentUser();
    
    // Se chegou aqui, a sessao e valida
    var finalState = await ig.state.serialize();
    var finalJson = JSON.stringify(finalState);
    saveSession(finalJson);
    
    output({
      step: 'verified',
      success: true,
      username: user.username,
      userId: user.pk,
      followers: user.follower_count,
      sessionJson: finalJson,
      message: 'Codigo verificado! Sessao salva. Pode enviar DMs agora.',
    });
    
  } catch (e) {
    var errorMsg = e.message || String(e);
    
    // Tentar com challenge API
    try {
      var stateJson2 = Buffer.from(stateB64, 'base64').toString('utf-8');
      var state2 = JSON.parse(stateJson2);
      var ig2 = new IgApiClient();
      await ig2.state.deserialize(state2);
      
      // Tentar resolver challenge
      if (ig2.challenge) {
        // Tentar enviar codigo de seguranca
        await ig2.challenge.sendSecurityCode(code);
        
        var user = await ig2.account.currentUser();
        var finalState = await ig2.state.serialize();
        var finalJson = JSON.stringify(finalState);
        saveSession(finalJson);
        
        output({
          step: 'verified',
          success: true,
          username: user.username,
          userId: user.pk,
          sessionJson: finalJson,
          message: 'Codigo aceite! Sessao salva.',
        });
      } else {
        output({ step: 'verify_error', success: false, error: errorMsg, hint: 'Sessao pode ter expirado. Tenta login novamente.' });
      }
    } catch (e2) {
      output({ step: 'verify_failed', success: false, error: errorMsg + ' | ' + (e2.message || ''), hint: 'Codigo errado ou expirado. Tenta novamente.' });
    }
  }
}

// === MAIN ===
var action = process.argv[2];

if (action === 'login') {
  var username = process.argv[3];
  var password = process.argv[4];
  if (!username || !password) {
    output({ error: 'Usage: node ig-login-server.js login <username> <password>' });
    process.exit(1);
  }
  doLogin(username, password).catch(function(e) {
    output({ step: 'fatal_error', error: e.message });
    process.exit(1);
  });
} else if (action === 'verify') {
  var code = process.argv[3];
  var stateB64 = process.argv[4];
  if (!code || !stateB64) {
    output({ error: 'Usage: node ig-login-server.js verify <code> <state_base64>' });
    process.exit(1);
  }
  doVerify(code, stateB64).catch(function(e) {
    output({ step: 'fatal_error', error: e.message });
    process.exit(1);
  });
} else {
  output({ error: 'Usage: node ig-login-server.js <login|verify> ...' });
  process.exit(1);
}
