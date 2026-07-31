const { createClient } = require('@libsql/client');
const fs = require('fs');
const envContent = fs.readFileSync('.env.local','utf8');
const getEnv = (k) => { const m = envContent.match(new RegExp(k+'=(.+)')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
const client = createClient({ url: getEnv('TURSO_URL'), authToken: getEnv('TURSO_AUTH_TOKEN') });

async function run() {
  await client.execute(`CREATE TABLE IF NOT EXISTS ABTest (id TEXT NOT NULL PRIMARY KEY, name TEXT NOT NULL, platform TEXT NOT NULL, variantA TEXT NOT NULL, variantB TEXT NOT NULL, hashtagsA TEXT, hashtagsB TEXT, status TEXT NOT NULL DEFAULT 'draft', impressionsA INTEGER NOT NULL DEFAULT 0, impressionsB INTEGER NOT NULL DEFAULT 0, likesA INTEGER NOT NULL DEFAULT 0, likesB INTEGER NOT NULL DEFAULT 0, commentsA INTEGER NOT NULL DEFAULT 0, commentsB INTEGER NOT NULL DEFAULT 0, winner TEXT, contentPostId TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL)`);
  console.log('ABTest OK');

  await client.execute(`CREATE TABLE IF NOT EXISTS ClientReport (id TEXT NOT NULL PRIMARY KEY, clientName TEXT NOT NULL, periodStart DATETIME NOT NULL, periodEnd DATETIME NOT NULL, platform TEXT, followersStart INTEGER NOT NULL DEFAULT 0, followersEnd INTEGER NOT NULL DEFAULT 0, postsPublished INTEGER NOT NULL DEFAULT 0, totalLikes INTEGER NOT NULL DEFAULT 0, totalComments INTEGER NOT NULL DEFAULT 0, totalDMs INTEGER NOT NULL DEFAULT 0, newProspects INTEGER NOT NULL DEFAULT 0, conversions INTEGER NOT NULL DEFAULT 0, summary TEXT, generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  console.log('ClientReport OK');

  await client.execute(`CREATE TABLE IF NOT EXISTS SystemSetting (id TEXT NOT NULL PRIMARY KEY, key TEXT NOT NULL, value TEXT NOT NULL, updatedAt DATETIME NOT NULL, CONSTRAINT SystemSetting_key_key UNIQUE(key))`);
  console.log('SystemSetting OK');

  console.log('All tables created!');
}
run().catch(e => console.error(e.message));
