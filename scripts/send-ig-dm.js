/**
 * Bridge: Envia IG DM via instagram-private-api
 * Carrega sessao do ficheiro local (ig-session.json)
 * Chamado pelo modulo ig-private-dm.ts (via child_process)
 * Uso: node send-ig-dm.js <username> <message>
 */

const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

var SESSION_FILE = path.join(__dirname, 'ig-session.json');

async function sendDM(recipientUsername, messageText) {
  var ig = new IgApiClient();
  ig.state.generateDevice(recipientUsername);

  // Tentar carregar sessao salva
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      console.error(JSON.stringify({ success: false, error: 'No session file. Run /cmd/ig-login action=login first.' }));
      process.exit(1);
    }
    var savedState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await ig.state.deserialize(savedState);
    // Verificar sessao
    await ig.account.currentUser();
    console.error('[OK] Session loaded');
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: 'Session expired or invalid: ' + e.message }));
    process.exit(1);
  }

  // Enviar DM
  try {
    var userId = await ig.user.getIdByUsername(recipientUsername);
    var thread = ig.entity.directThread([userId.toString()]);
    var result = await thread.broadcastTextMessage(messageText);
    console.log(JSON.stringify({
      success: true,
      messageId: result.item_id || result.timestamp || 'sent',
      recipientId: userId
    }));
  } catch (e) {
    console.error(JSON.stringify({ success: false, error: e.message }));
    process.exit(1);
  }
}

var username = process.argv[2];
var message = process.argv[3];
if (!username || !message) {
  console.error(JSON.stringify({ success: false, error: 'Usage: node send-ig-dm.js <username> <message>' }));
  process.exit(1);
}

sendDM(username, message);
