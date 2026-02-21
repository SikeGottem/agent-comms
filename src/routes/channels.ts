import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const channels = new Hono();

channels.post('/', async (c) => {
  const body = await c.req.json<{ name: string; description?: string }>();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const id = body.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const now = Date.now();
  db.prepare('INSERT OR IGNORE INTO channels (id, name, description, created_at) VALUES (?, ?, ?, ?)').run(
    id, body.name, body.description ?? null, now
  );
  return c.json({ ok: true, channel: { id, name: body.name } }, 201);
});

channels.get('/', (c) => {
  const rows = db.prepare('SELECT * FROM channels ORDER BY created_at').all();
  return c.json(rows);
});

export default channels;
