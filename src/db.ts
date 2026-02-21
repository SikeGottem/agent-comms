import { createClient } from '@libsql/client';
import { mkdirSync } from 'fs';

const dbUrl = process.env.TURSO_DB_URL || process.env.TURSO_URL || 'file:data/agent-comms.db';

// Ensure local data dir exists for file-based fallback
if (dbUrl.startsWith('file:')) {
  mkdirSync('data', { recursive: true });
}

console.log(`[db] Connecting to: ${dbUrl.startsWith('libsql') ? dbUrl.split('.')[0] + '...' : dbUrl}`);

const db = createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN,
});

// Initialize schema
async function initDB() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT,
      last_seen_at INTEGER,
      metadata TEXT,
      webhook_url TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_agent TEXT NOT NULL,
      to_agent TEXT,
      channel TEXT DEFAULT 'general',
      type TEXT DEFAULT 'chat',
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      read_at INTEGER,
      FOREIGN KEY (from_agent) REFERENCES agents(id)
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assigned_to TEXT,
      created_by TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      channel TEXT DEFAULT 'general',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS shared_memory (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
    CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON messages(to_agent);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  `);

  // Add new columns to existing tables (migration pattern)
  try { await db.execute('ALTER TABLE messages ADD COLUMN reply_to TEXT'); } catch {}
  try { await db.execute('ALTER TABLE messages ADD COLUMN pinned INTEGER DEFAULT 0'); } catch {}

  // Seed default channel
  const existing = await db.execute({ sql: 'SELECT id FROM channels WHERE id = ?', args: ['general'] });
  if (existing.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO channels (id, name, description, created_at) VALUES (?, ?, ?, ?)',
      args: ['general', 'General', 'Default channel for all agents', Date.now()],
    });
  }
}

// Run init on import
initDB().catch(console.error);

export default db;
