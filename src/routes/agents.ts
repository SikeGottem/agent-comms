import { Hono } from 'hono';
import db from '../db.js';

const agents = new Hono();

agents.post('/register', async (c) => {
  const body = await c.req.json<{ id: string; name: string; platform?: string; webhook_url?: string; metadata?: Record<string, unknown> }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  const now = Date.now();
  const meta = body.metadata ? JSON.stringify(body.metadata) : null;

  // Check if exists
  const existing = await db.execute({ sql: 'SELECT id FROM agents WHERE id = ?', args: [body.id] });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE agents SET name = ?, platform = ?, last_seen_at = ?, metadata = ?, webhook_url = ? WHERE id = ?',
      args: [body.name, body.platform ?? null, now, meta, body.webhook_url ?? null, body.id],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO agents (id, name, platform, last_seen_at, metadata, webhook_url) VALUES (?, ?, ?, ?, ?, ?)',
      args: [body.id, body.name, body.platform ?? null, now, meta, body.webhook_url ?? null],
    });
  }

  return c.json({ ok: true, agent: { id: body.id, name: body.name, platform: body.platform ?? null, webhook_url: body.webhook_url ?? null } }, 201);
});

agents.get('/', async (c) => {
  const ONLINE_THRESHOLD = 60_000;
  const now = Date.now();
  const result = await db.execute('SELECT * FROM agents');
  const rows = result.rows.map((a: any) => ({
    ...a,
    metadata: a.metadata ? JSON.parse(a.metadata) : null,
    online: a.last_seen_at ? (now - Number(a.last_seen_at)) < ONLINE_THRESHOLD : false,
  }));
  return c.json(rows);
});

agents.post('/:id/heartbeat', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), id] });
  if (result.rowsAffected === 0) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  return c.json({ ok: true });
});

export default agents;
