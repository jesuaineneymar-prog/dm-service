/**
 * Lista conversas do DM inbox do Instagram
 * Uso: node list-ig-inbox.js [limit]
 */

const fs = require('fs');
const path = require('path');
const { IgApiClient } = require('instagram-private-api');

const SESSION_FILE = path.join(__dirname, 'ig-session.json');

async function listInbox(limit) {
  limit = parseInt(limit) || 20;

  if (!fs.existsSync(SESSION_FILE)) {
    console.log(JSON.stringify({ success: false, error: 'No session file. Run nst-extract-ig-session.js first.', threads: [] }));
    return;
  }

  try {
    var ig = new IgApiClient();
    ig.state.generateDevice('jesuaine07');
    var savedState = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await ig.state.deserialize(savedState);

    // Verificar sessao
    await ig.account.currentUser();

    // Listar inbox
    var inboxFeed = ig.feed.directInbox();
    var threads = await inboxFeed.items();

    // Filtrar e formatar
    var formatted = threads.slice(0, limit).map(function(t) {
      return {
        threadId: t.thread_id,
        threadType: t.thread_type,
        users: (t.users || []).map(function(u) { return { username: u.username, pk: u.pk, full_name: u.full_name }; }),
        lastMessage: t.last_permanent_item ? {
          text: t.last_permanent_item.text || '',
          timestamp: t.last_permanent_item.timestamp || 0,
          userId: t.last_permanent_item.user_id || 0,
        } : null,
        unreadCount: t.unread_count || 0,
        muted: t.muted || false,
      };
    });

    console.log(JSON.stringify({
      success: true,
      count: formatted.length,
      threads: formatted,
    }));
  } catch (e) {
    console.log(JSON.stringify({ success: false, error: e.message, threads: [] }));
  }
}

listInbox(process.argv[2]);
