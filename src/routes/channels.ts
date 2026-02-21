import { Hono } from 'hono';
import db from '../db.js';

const channels = new Hono();

channels.post('/', async (c) => {
  const body = await c.req.json<{ id: string; name: string; description?: string; topic?: string }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO channels (id, name, description, created_at, topic) VALUES (?, ?, ?, ?, ?)',
    args: [body.id, body.name, body.description ?? null, Date.now(), body.topic ?? null],
  });

  return c.json({ ok: true, channel: { id: body.id, name: body.name } }, 201);
});

channels.get('/', async (c) => {
  const result = await db.execute('SELECT * FROM channels');
  return c.json(result.rows);
});

// Update channel (topic, pinned_context)
channels.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ topic?: string; pinned_context?: string; description?: string }>();

  const sets: string[] = [];
  const args: any[] = [];

  if (body.topic !== undefined) { sets.push('topic = ?'); args.push(body.topic); }
  if (body.pinned_context !== undefined) { sets.push('pinned_context = ?'); args.push(body.pinned_context); }
  if (body.description !== undefined) { sets.push('description = ?'); args.push(body.description); }

  if (sets.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  args.push(id);
  const result = await db.execute({ sql: `UPDATE channels SET ${sets.join(', ')} WHERE id = ?`, args });
  if (result.rowsAffected === 0) return c.json({ error: 'Channel not found' }, 404);
  return c.json({ ok: true });
});

// Channel summary
channels.get('/:id/summary', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({
    sql: 'SELECT * FROM messages WHERE channel = ? ORDER BY created_at DESC LIMIT 10',
    args: [id],
  });

  const channelResult = await db.execute({ sql: 'SELECT topic, pinned_context FROM channels WHERE id = ?', args: [id] });
  const channelInfo = channelResult.rows[0] as any;

  const msgs = result.rows.reverse();
  const summary = msgs.map((m: any) => ({
    from: m.from_agent,
    type: m.type,
    content: m.content?.length > 100 ? m.content.slice(0, 100) + '...' : m.content,
    time: m.created_at,
  }));

  return c.json({
    channel: id,
    topic: channelInfo?.topic ?? null,
    pinned_context: channelInfo?.pinned_context ?? null,
    message_count: msgs.length,
    time_range: msgs.length > 0 ? { from: (msgs[0] as any).created_at, to: (msgs[msgs.length - 1] as any).created_at } : null,
    summary,
  });
});

export default channels;
