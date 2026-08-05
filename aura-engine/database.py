import aiosqlite
import json
import os
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "/tmp/aura.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    followers INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new',
    last_dm_sent TEXT DEFAULT NULL,
    last_reply TEXT DEFAULT NULL,
    dm_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    platform TEXT NOT NULL,
    message_template TEXT DEFAULT '',
    context TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    target_list TEXT DEFAULT '[]',
    sent_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    scheduled_at TEXT DEFAULT NULL,
    started_at TEXT DEFAULT NULL,
    completed_at TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dm_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    direction TEXT NOT NULL,
    target_username TEXT NOT NULL,
    message TEXT NOT NULL,
    ai_generated INTEGER DEFAULT 0,
    campaign_id INTEGER DEFAULT NULL,
    status TEXT DEFAULT 'sent',
    error TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    post_type TEXT DEFAULT 'feed',
    caption TEXT DEFAULT '',
    media_urls TEXT DEFAULT '[]',
    status TEXT DEFAULT 'draft',
    scheduled_at TEXT DEFAULT NULL,
    published_at TEXT DEFAULT NULL,
    post_id TEXT DEFAULT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    error TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    post_id TEXT NOT NULL,
    comment_id TEXT DEFAULT NULL,
    author TEXT NOT NULL,
    text TEXT NOT NULL,
    replied INTEGER DEFAULT 0,
    reply_text TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL,
    platform TEXT NOT NULL,
    payload TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    result TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    platform TEXT NOT NULL,
    metric TEXT NOT NULL,
    value INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
"""

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()

async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()
