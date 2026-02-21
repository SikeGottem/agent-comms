import { Hono } from 'hono';
import db from '../db.js';
import { randomUUID } from 'crypto';

// --- Init tables ---
async function initKnowledgeTables() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      category TEXT,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      views INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS knowledge_links (
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      PRIMARY KEY (from_id, to_id)
    );

    CREATE TABLE IF NOT EXISTS file_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT,
      knowledge_id TEXT,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_by TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}
initKnowledgeTables().catch(console.error);

// ========================
// Knowledge Routes
// ========================
const knowledgeRoutes = new Hono();

// POST /knowledge — create entry
knowledgeRoutes.post('/', async (c) => {
  const body = await c.req.json<{ title: string; content: string; tags?: string; category?: string; agent?: string }>();
  if (!body.title || !body.content) return c.json({ error: 'title and content are required' }, 400);
  const id = randomUUID();
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO knowledge_entries (id, title, content, tags, category, created_by, created_at, updated_at, views) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
    args: [id, body.title, body.content, body.tags ?? null, body.category ?? null, body.agent ?? null, now, now],
  });
  return c.json({ id, ok: true }, 201);
});

// GET /knowledge/search?q=query — full text search (must be before /:id)
knowledgeRoutes.get('/search', async (c) => {
  const q = c.req.query('q') || '';
  if (!q) return c.json([]);
  const like = `%${q}%`;
  const result = await db.execute({
    sql: "SELECT * FROM knowledge_entries WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC",
    args: [like, like, like],
  });
  return c.json(result.rows);
});

// GET /knowledge — list all (with optional filters)
knowledgeRoutes.get('/', async (c) => {
  const tag = c.req.query('tag');
  const category = c.req.query('category');
  const search = c.req.query('search');

  let sql = 'SELECT * FROM knowledge_entries WHERE 1=1';
  const args: any[] = [];

  if (tag) { sql += " AND (',' || tags || ',') LIKE ?"; args.push(`%,${tag},%`); }
  if (category) { sql += ' AND category = ?'; args.push(category); }
  if (search) { const like = `%${search}%`; sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)'; args.push(like, like, like); }

  sql += ' ORDER BY updated_at DESC';
  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// GET /knowledge/:id — get entry (increment views)
knowledgeRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  await db.execute({ sql: 'UPDATE knowledge_entries SET views = views + 1 WHERE id = ?', args: [id] });
  const result = await db.execute({ sql: 'SELECT * FROM knowledge_entries WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(result.rows[0]);
});

// PATCH /knowledge/:id — update
knowledgeRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ title?: string; content?: string; tags?: string; category?: string }>();
  const existing = await db.execute({ sql: 'SELECT * FROM knowledge_entries WHERE id = ?', args: [id] });
  if (existing.rows.length === 0) return c.json({ error: 'Not found' }, 404);

  const row = existing.rows[0] as any;
  await db.execute({
    sql: 'UPDATE knowledge_entries SET title = ?, content = ?, tags = ?, category = ?, updated_at = ? WHERE id = ?',
    args: [body.title ?? row.title, body.content ?? row.content, body.tags ?? row.tags, body.category ?? row.category, Date.now(), id],
  });
  return c.json({ ok: true });
});

// DELETE /knowledge/:id
knowledgeRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({ sql: 'DELETE FROM knowledge_entries WHERE id = ?', args: [id] });
  if (result.rowsAffected === 0) return c.json({ error: 'Not found' }, 404);
  // Clean up links
  await db.execute({ sql: 'DELETE FROM knowledge_links WHERE from_id = ? OR to_id = ?', args: [id, id] });
  await db.execute({ sql: 'DELETE FROM file_attachments WHERE knowledge_id = ?', args: [id] });
  return c.json({ ok: true });
});

// POST /knowledge/:id/link — link two entries
knowledgeRoutes.post('/:id/link', async (c) => {
  const from_id = c.req.param('id');
  const body = await c.req.json<{ to_id: string; relationship: string }>();
  if (!body.to_id || !body.relationship) return c.json({ error: 'to_id and relationship are required' }, 400);
  const valid = ['related_to', 'supersedes', 'depends_on'];
  if (!valid.includes(body.relationship)) return c.json({ error: `relationship must be one of: ${valid.join(', ')}` }, 400);
  await db.execute({
    sql: 'INSERT OR REPLACE INTO knowledge_links (from_id, to_id, relationship) VALUES (?, ?, ?)',
    args: [from_id, body.to_id, body.relationship],
  });
  return c.json({ ok: true }, 201);
});

// GET /knowledge/:id/links — get linked entries
knowledgeRoutes.get('/:id/links', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({
    sql: `SELECT kl.*, ke.title, ke.category, ke.tags
          FROM knowledge_links kl
          JOIN knowledge_entries ke ON (ke.id = CASE WHEN kl.from_id = ? THEN kl.to_id ELSE kl.from_id END)
          WHERE kl.from_id = ? OR kl.to_id = ?`,
    args: [id, id, id],
  });
  return c.json(result.rows);
});

// ========================
// File Attachment Routes
// ========================
const fileRoutes = new Hono();

const MAX_FILE_SIZE = 1_000_000; // 1MB

// POST /files — upload
fileRoutes.post('/', async (c) => {
  const body = await c.req.json<{ filename: string; content_type: string; content: string; message_id?: string; knowledge_id?: string; agent?: string }>();
  if (!body.filename || !body.content_type || !body.content) return c.json({ error: 'filename, content_type, and content are required' }, 400);
  const size = Buffer.byteLength(body.content, 'utf8');
  if (size > MAX_FILE_SIZE) return c.json({ error: `File too large (${size} bytes). Max 1MB.` }, 413);

  const id = randomUUID();
  await db.execute({
    sql: 'INSERT INTO file_attachments (id, message_id, knowledge_id, filename, content_type, content, size_bytes, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [id, body.message_id ?? null, body.knowledge_id ?? null, body.filename, body.content_type, body.content, size, body.agent ?? null, Date.now()],
  });
  return c.json({ id, ok: true }, 201);
});

// GET /files — list (with optional filters)
fileRoutes.get('/', async (c) => {
  const message_id = c.req.query('message_id');
  const knowledge_id = c.req.query('knowledge_id');

  let sql = 'SELECT id, message_id, knowledge_id, filename, content_type, size_bytes, uploaded_by, created_at FROM file_attachments WHERE 1=1';
  const args: any[] = [];
  if (message_id) { sql += ' AND message_id = ?'; args.push(message_id); }
  if (knowledge_id) { sql += ' AND knowledge_id = ?'; args.push(knowledge_id); }
  sql += ' ORDER BY created_at DESC';

  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// GET /files/:id — get file
fileRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({ sql: 'SELECT * FROM file_attachments WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return c.json({ error: 'Not found' }, 404);
  return c.json(result.rows[0]);
});

// DELETE /files/:id — remove (only by uploader)
fileRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const agent = c.req.query('agent');
  const existing = await db.execute({ sql: 'SELECT uploaded_by FROM file_attachments WHERE id = ?', args: [id] });
  if (existing.rows.length === 0) return c.json({ error: 'Not found' }, 404);
  if (agent && existing.rows[0].uploaded_by && existing.rows[0].uploaded_by !== agent) {
    return c.json({ error: 'Only the uploader can delete this file' }, 403);
  }
  await db.execute({ sql: 'DELETE FROM file_attachments WHERE id = ?', args: [id] });
  return c.json({ ok: true });
});

export { knowledgeRoutes, fileRoutes };
export default knowledgeRoutes;
