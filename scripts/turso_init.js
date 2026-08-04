const { createClient } = require('@libsql/client');

const db = createClient({
  url: 'libsql://jarvis-db-jesuaine.aws-eu-west-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODU0MzY1MDEsImlkIjoiMDE5ZmI0NGUtM2IwMS03YWFkLWJiNDMtYTUwNGNlMDA2MGZhIiwia2lkIjoiUVpuMTVCSEZHSC1hT3ZOeHE3eERoY1lDZmxsM192d3VzZ243WnVENUVUWSIsInJpZCI6ImJmZGEyM2RkLWFjYjktNDgzMy1iOTliLTFlZTg1MmI0YjM2YiJ9.bgTvz946Ezy7BQKJYcSmIxfXqSbXmzn8QjNK1ty5YYfd6MuDnYZHot2ixVI_qh3YK2wWZOk_kLCNKIr-d6FfCQ'
});

const tables = [
  `CREATE TABLE IF NOT EXISTS Prospect (
    id TEXT PRIMARY KEY, platform TEXT NOT NULL, username TEXT NOT NULL, displayName TEXT,
    followers INTEGER DEFAULT 0, following INTEGER DEFAULT 0, bio TEXT, profileUrl TEXT, avatarUrl TEXT,
    score REAL DEFAULT 0, category TEXT DEFAULT 'prospect', status TEXT DEFAULT 'new', notes TEXT, externalId TEXT,
    lastContactedAt DATETIME, lastRepliedAt DATETIME, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS Message (
    id TEXT PRIMARY KEY, prospectId TEXT NOT NULL, direction TEXT NOT NULL, content TEXT NOT NULL,
    platform TEXT, sentAt DATETIME DEFAULT CURRENT_TIMESTAMP, isRead INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS FollowUp (
    id TEXT PRIMARY KEY, prospectId TEXT NOT NULL, scheduledAt DATETIME NOT NULL,
    status TEXT DEFAULT 'pending', message TEXT, sentAt DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS AnalyticsEvent (
    id TEXT PRIMARY KEY, platform TEXT NOT NULL, eventType TEXT NOT NULL,
    metricValue REAL DEFAULT 0, metadata TEXT, recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ContentPost (
    id TEXT PRIMARY KEY, platform TEXT, caption TEXT NOT NULL, mediaUrl TEXT, mediaType TEXT,
    status TEXT DEFAULT 'draft', scheduledAt DATETIME, publishedAt DATETIME,
    engagementData TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ScheduledPost (
    id TEXT PRIMARY KEY, contentPostId TEXT NOT NULL, platforms TEXT NOT NULL,
    scheduledFor DATETIME NOT NULL, status TEXT DEFAULT 'pending', uploadPostId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS Notification (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
    platform TEXT, sourceId TEXT, isRead INTEGER DEFAULT 0, metadata TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS AutomationLog (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, action TEXT NOT NULL, platform TEXT,
    targetId TEXT, targetName TEXT, status TEXT DEFAULT 'pending', result TEXT,
    triggeredAt DATETIME DEFAULT CURRENT_TIMESTAMP, completedAt DATETIME
  )`,
];

async function init() {
  for (var sql of tables) {
    try { await db.execute(sql); console.log('OK'); } catch(e) { console.log('ERR:', e.message.slice(0, 100)); }
  }
  // Verify
  var r = await db.execute('SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name');
  console.log('\nTabelas criadas:', r.rows.map(r => r.name).join(', '));
}
init();
