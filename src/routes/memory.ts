import { Hono } from 'hono';
import db from '../db.js';

const memory = new Hono();

// List all
memory.get('/', async (c) => {
  const result = await db.execute('SELECT * FROM shared_memory ORDER BY updated_at DESC');
  return c.json(result.rows);
});

// Get by key
memory.get('/:key', async (c) => {
  const key = c.req.param('key');
  const result = await db.execute({ sql: 'SELECT * FROM shared_memory WHERE key = ?', args: [key] });
  if (result.rows.length === 0) return c.json({ error: 'Key not found' }, 404);
  return c.json(result.rows[0]);
});

// Put (upsert)
memory.put('/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json<{ value: string; agent?: string }>();
  if (!body.value) return c.json({ error: 'value is required' }, 400);

  await db.execute({
    sql: 'INSERT INTO shared_memory (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_by = ?, updated_at = ?',
    args: [key, body.value, body.agent ?? null, Date.now(), body.value, body.agent ?? null, Date.now()],
  });
  return c.json({ ok: true });
});

// Delete
memory.delete('/:key', async (c) => {
  const key = c.req.param('key');
  const result = await db.execute({ sql: 'DELETE FROM shared_memory WHERE key = ?', args: [key] });
  if (result.rowsAffected === 0) return c.json({ error: 'Key not found' }, 404);
  return c.json({ ok: true });
});

export default memory;
