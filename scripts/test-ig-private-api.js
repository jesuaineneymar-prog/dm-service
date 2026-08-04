/**
 * Aura v4 — Instagram Private API Test Script
 * Tests login, session persistence, profile fetch, inbox listing, and DM sending.
 * CommonJS only. Uses instagram-private-api v1.46.1 (dilame fork).
 */

const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

// ─── Config ───────────────────────────────────────────────────────────
const IG_USERNAME = 'jesuaine07';
const IG_PASSWORD = 'X2VpFZY@)u-H%89';
const SESSION_FILE = path.join(__dirname, 'ig-session.json');

// ─── IG Client Setup ──────────────────────────────────────────────────
const ig = new IgApiClient();
ig.state.generateDevice(IG_USERNAME);

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Attempt to load a previously saved session to avoid re-login.
 * Returns true if a valid session was loaded, false otherwise.
 */
async function loadSession() {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      console.log('[SESSION] No saved session file found.');
      return false;
    }
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const state = JSON.parse(raw);
    await ig.state.deserialize(state);
    console.log('[SESSION] Deserialized saved session state.');

    // Verify the session is still valid by checking the current user
    await ig.account.currentUser();
    console.log('[SESSION] Session is still valid!');
    return true;
  } catch (err) {
    console.log(`[SESSION] Saved session invalid or expired: ${err.message}`);
    return false;
  }
}

/**
 * Login with credentials and persist the session to disk.
 */
async function login() {
  try {
    console.log(`[AUTH] Logging in as ${IG_USERNAME}...`);
    const loggedInUser = await ig.account.login(IG_USERNAME, IG_PASSWORD);
    console.log(`[AUTH] Login successful! User ID: ${loggedInUser.pk}, Username: ${loggedInUser.username}`);

    // Save session state for reuse
    const serialized = await ig.state.serialize();
    // Remove cookies expiry to keep session longer
    delete serialized.constants;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(serialized, null, 2));
    console.log(`[AUTH] Session saved to ${SESSION_FILE}`);
    return loggedInUser;
  } catch (err) {
    console.error(`[AUTH] Login failed: ${err.message}`);
    if (err.response && err.response.body) {
      console.error('[AUTH] Response body:', JSON.stringify(err.response.body, null, 2));
    }
    throw err;
  }
}

/**
 * Get the logged-in user's profile info.
 */
async function getProfileInfo() {
  try {
    console.log('[PROFILE] Fetching profile info...');
    const user = await ig.account.currentUser();
    console.log('[PROFILE] ─────────────────────────────');
    console.log(`  ID:              ${user.pk}`);
    console.log(`  Username:        ${user.username}`);
    console.log(`  Full Name:       ${user.full_name || '(not set)'}`);
    console.log(`  Bio:             ${(user.biography || '').substring(0, 80)}`);
    console.log(`  Followers:       ${user.follower_count}`);
    console.log(`  Following:       ${user.following_count}`);
    console.log(`  Posts:           ${user.media_count}`);
    console.log(`  Is Private:      ${user.is_private}`);
    console.log(`  Is Verified:     ${user.is_verified}`);
    console.log(`  Profile Pic URL: ${user.profile_pic_url || '(none)'}`);
    console.log('[PROFILE] ─────────────────────────────');
    return user;
  } catch (err) {
    console.error(`[PROFILE] Failed to fetch profile: ${err.message}`);
    throw err;
  }
}

/**
 * List recent DM conversations (inbox).
 */
async function listInbox() {
  try {
    console.log('[INBOX] Fetching DM inbox...');
    const inboxFeed = ig.feed.directInbox();
    const threads = await inboxFeed.items();

    console.log(`[INBOX] Retrieved ${threads.length} conversation(s).`);
    console.log('[INBOX] ─────────────────────────────');

    for (let i = 0; i < Math.min(threads.length, 10); i++) {
      const t = threads[i];
      const chatName = t.thread_title || t.users.map(u => u.username).join(', ') || '(group/collection)';
      const lastMsg = t.last_permanent_item
        ? (t.last_permanent_item.text || '[media/story/like]').substring(0, 60)
        : '(no message)';
      console.log(`  ${i + 1}. ${chatName}`);
      console.log(`     Last msg: ${lastMsg}`);
      console.log(`     Thread ID: ${t.thread_id} | Users: ${t.users ? t.users.length : 0}`);
      if (t.users && t.users.length > 0) {
        for (const u of t.users) {
          console.log(`       - ${u.username} (pk: ${u.pk})`);
        }
      }
    }

    if (threads.length > 10) {
      console.log(`  ... and ${threads.length - 10} more conversation(s).`);
    }
    console.log('[INBOX] ─────────────────────────────');
    return threads;
  } catch (err) {
    console.error(`[INBOX] Failed to fetch inbox: ${err.message}`);
    throw err;
  }
}

/**
 * Send a DM to a user by their username.
 * @param {string} recipientUsername - The target Instagram username
 * @param {string} messageText - The message to send
 */
async function sendDM(recipientUsername, messageText) {
  try {
    console.log(`[DM] Resolving user ID for @${recipientUsername}...`);
    const userId = await ig.user.getIdByUsername(recipientUsername);
    console.log(`[DM] Resolved @${recipientUsername} → user ID ${userId}`);

    const thread = ig.entity.directThread([userId.toString()]);
    console.log(`[DM] Broadcasting message: "${messageText.substring(0, 50)}"`);
    await thread.broadcastTextMessage(messageText);
    console.log(`[DM] Message sent successfully to @${recipientUsername}!`);
    return true;
  } catch (err) {
    console.error(`[DM] Failed to send DM to @${recipientUsername}: ${err.message}`);
    if (err.response && err.response.body) {
      console.error('[DM] Response body:', JSON.stringify(err.response.body, null, 2));
    }
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Aura v4 — Instagram Private API Test       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  try {
    // Step 1: Try loading saved session, else login fresh
    const sessionLoaded = await loadSession();
    if (!sessionLoaded) {
      await login();
    }

    // Step 2: Get profile info
    await getProfileInfo();

    // Step 3: List DM inbox
    await listInbox();

    console.log('');
    console.log('✅ All tests passed! IG Private API is working.');
    console.log('');
    console.log('Exported function: sendDM(recipientUsername, messageText)');
    console.log('Example usage:');
    console.log('  const { sendDM } = require("./test-ig-private-api");');
    console.log('  sendDM("someuser", "Hello from Aura v4!");');

  } catch (err) {
    console.error('');
    console.error('❌ Test failed with error:');
    console.error(err);
    process.exitCode = 1;
  }
}

// ─── Exports for use as a module ─────────────────────────────────────
module.exports = { ig, loadSession, login, getProfileInfo, listInbox, sendDM };

// ─── Run if executed directly ─────────────────────────────────────────
if (require.main === module) {
  main();
}
