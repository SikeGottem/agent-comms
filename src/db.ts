import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'agent-comms.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT,
    last_seen_at INTEGER,
    metadata TEXT
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

  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
  CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON messages(to_agent);
  CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
`);

// Seed default channel
const existing = db.prepare('SELECT id FROM channels WHERE id = ?').get('general');
if (!existing) {
  db.prepare('INSERT INTO channels (id, name, description, created_at) VALUES (?, ?, ?, ?)').run(
    'general', 'General', 'Default channel for all agents', Date.now()
  );
}

export default db;
