/**
 * Verifica se a sessao IG Private API e valida
 * Uso: node check-ig-session.js
 */

const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

const SESSION_FILE = path.join(__dirname, 'ig-session.json');

async function check() {
  if (!fs.existsSync(SESSION_FILE)) {
    console.log(JSON.stringify({ valid: false, username: null, userId: null, source: 'private_api', error: 'No session file found' }));
    return;
  }

  try {
    var ig = new IgApiClient();
    ig.state.generateDevice('jesuaine07');
    var savedState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await ig.state.deserialize(savedState);
    var user = await ig.account.currentUser();
    console.log(JSON.stringify({
      valid: true,
      username: user.username,
      userId: user.pk,
      source: 'private_api',
      followers: user.follower_count,
      following: user.following_count,
    }));
  } catch (e) {
    console.log(JSON.stringify({ valid: false, username: null, userId: null, source: 'private_api', error: e.message }));
  }
}

check();
