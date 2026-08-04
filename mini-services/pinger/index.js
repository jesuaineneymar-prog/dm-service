// ============================================================
//  Aura PINGER — 24/7 heartbeat for Vercel-deployed Aura
//  Deploy on Railway (free tier) — pings master cron every 5 min
//  Railway keeps this alive 24/7, which keeps Aura alive 24/7
// ============================================================

var AURA_URL = process.env.AURA_URL || 'https://jarvis-khaki-chi.vercel.app';
var PINGER_SECRET = process.env.PINGER_SECRET || 'aura-247';
var INTERVAL_MS = (process.env.PING_INTERVAL_MIN || 5) * 60 * 1000;

console.log('[PINGER] Aura 24/7 Pinger started');
console.log('[PINGER] Target: ' + AURA_URL + '/api/cron/master');
console.log('[PINGER] Interval: ' + (INTERVAL_MS / 1000) + 's');

var successCount = 0;
var failCount = 0;
var lastStatus = 'none';
var lastPing = null;

async function ping() {
  var start = Date.now();
  try {
    var res = await fetch(AURA_URL + '/api/cron/master', {
      method: 'GET',
      headers: { 'x-pinger': PINGER_SECRET, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(120000),
    });
    var duration = Date.now() - start;
    lastPing = new Date().toISOString();
    if (res.ok) {
      successCount++;
      lastStatus = 'ok';
      var text = await res.text();
      try {
        var json = JSON.parse(text);
        console.log('[' + new Date().toISOString() + '] OK (' + duration + 'ms) DMs:' + (json.data?.dmMonitor?.newMessages || 0) + ' Replied:' + (json.data?.dmMonitor?.autoReplied || 0) + ' Published:' + (json.data?.publish?.published || 0) + ' FollowUps:' + (json.data?.followUps?.sent || 0) + ' [success:' + successCount + ' fail:' + failCount + ']');
      } catch (e) {
        console.log('[' + new Date().toISOString() + '] OK (' + duration + 'ms) [success:' + successCount + ' fail:' + failCount + ']');
      }
    } else {
      failCount++;
      lastStatus = 'http_' + res.status;
      console.error('[' + new Date().toISOString() + '] FAIL HTTP ' + res.status + ' (' + duration + 'ms) [success:' + successCount + ' fail:' + failCount + ']');
    }
  } catch (e) {
    failCount++;
    lastStatus = 'error';
    var duration = Date.now() - start;
    console.error('[' + new Date().toISOString() + '] ERROR: ' + e.message + ' (' + duration + 'ms) [success:' + successCount + ' fail:' + failCount + ']');
  }
}

var http = require('http');
var server = http.createServer(function(req, res) {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'aura-pinger', status: lastStatus, successCount: successCount, failCount: failCount, lastPing: lastPing, uptime: process.uptime() }));
  } else if (req.url === '/ping-now') {
    ping().then(function() { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ triggered: true })); });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Aura Pinger 24/7');
  }
});

var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('[PINGER] HTTP server on port ' + PORT);
});

ping();
setInterval(ping, INTERVAL_MS);
