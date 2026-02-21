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

// Channel summary - last 10 messages condensed
channels.get('/:id/summary', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({
    sql: 'SELECT * FROM messages WHERE channel = ? ORDER BY created_at DESC LIMIT 10',
    args: [id],
  });

  const msgs = result.rows.reverse();
  const summary = msgs.map((m: any) => ({
    from: m.from_agent,
    type: m.type,
    content: m.content?.length > 100 ? m.content.slice(0, 100) + '...' : m.content,
    time: m.created_at,
  }));

  return c.json({
    channel: id,
    message_count: msgs.length,
    time_range: msgs.length > 0 ? { from: (msgs[0] as any).created_at, to: (msgs[msgs.length - 1] as any).created_at } : null,
    summary,
  });
});

export default channels;
