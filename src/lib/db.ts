import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; dbInitialized: boolean };

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:/tmp/jarvis.db';
  return new PrismaClient({
    datasourceUrl: dbUrl,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });
}

export const db = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// Create individual table if not exists
async function createTableIfNotExists(sql: string): Promise<void> {
  try {
    await db.$executeRawUnsafe(sql);
  } catch (e: any) {
    // Table already exists or error — ignore
  }
}

// Auto-create SQLite tables on Vercel serverless cold starts
export async function ensureDatabase(): Promise<void> {
  if (globalForPrisma.dbInitialized) return;
  try {
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS Prospect (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        username TEXT NOT NULL,
        displayName TEXT,
        followers INTEGER DEFAULT 0,
        following INTEGER DEFAULT 0,
        bio TEXT,
        profileUrl TEXT,
        avatarUrl TEXT,
        score REAL DEFAULT 0,
        category TEXT DEFAULT 'prospect',
        status TEXT DEFAULT 'new',
        notes TEXT,
        externalId TEXT,
        lastContactedAt DATETIME,
        lastRepliedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS Message (
        id TEXT PRIMARY KEY,
        prospectId TEXT NOT NULL,
        direction TEXT NOT NULL,
        content TEXT NOT NULL,
        platform TEXT,
        sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        isRead INTEGER DEFAULT 0
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS FollowUp (
        id TEXT PRIMARY KEY,
        prospectId TEXT NOT NULL,
        scheduledAt DATETIME NOT NULL,
        status TEXT DEFAULT 'pending',
        message TEXT,
        sentAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS AnalyticsEvent (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        eventType TEXT NOT NULL,
        metricValue REAL DEFAULT 0,
        metadata TEXT,
        recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS ContentPost (
        id TEXT PRIMARY KEY,
        platform TEXT,
        caption TEXT NOT NULL,
        mediaUrl TEXT,
        mediaType TEXT,
        status TEXT DEFAULT 'draft',
        scheduledAt DATETIME,
        publishedAt DATETIME,
        engagementData TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS ScheduledPost (
        id TEXT PRIMARY KEY,
        contentPostId TEXT NOT NULL,
        platforms TEXT NOT NULL,
        scheduledFor DATETIME NOT NULL,
        status TEXT DEFAULT 'pending',
        uploadPostId TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS Notification (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        platform TEXT,
        sourceId TEXT,
        isRead INTEGER DEFAULT 0,
        metadata TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await createTableIfNotExists(`
      CREATE TABLE IF NOT EXISTS AutomationLog (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        platform TEXT,
        targetId TEXT,
        targetName TEXT,
        status TEXT DEFAULT 'pending',
        result TEXT,
        triggeredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        completedAt DATETIME
      )
    `);
    globalForPrisma.dbInitialized = true;
  } catch (e: any) {
    console.error('DB init error:', e.message);
  }
}
