import { Hono } from 'hono';
import db from '../db.js';

const channels = new Hono();

channels.post('/', async (c) => {
  const body = await c.req.json<{ id: string; name: string; description?: string }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO channels (id, name, description, created_at) VALUES (?, ?, ?, ?)',
    args: [body.id, body.name, body.description ?? null, Date.now()],
  });

  return c.json({ ok: true, channel: { id: body.id, name: body.name } }, 201);
});

channels.get('/', async (c) => {
  const result = await db.execute('SELECT * FROM channels');
  return c.json(result.rows);
});

export default channels;
