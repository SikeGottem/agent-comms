import { Hono } from 'hono';
import db from '../db.js';

const agents = new Hono();

// Register a new agent
agents.post('/register', async (c) => {
  const body = await c.req.json<{ id: string; name: string; platform?: string; metadata?: Record<string, unknown> }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  const now = Date.now();
  db.prepare(`
    INSERT INTO agents (id, name, platform, last_seen_at, metadata)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = ?, platform = ?, last_seen_at = ?, metadata = ?
  `).run(
    body.id, body.name, body.platform ?? null, now, body.metadata ? JSON.stringify(body.metadata) : null,
    body.name, body.platform ?? null, now, body.metadata ? JSON.stringify(body.metadata) : null
  );

  return c.json({ ok: true, agent: { id: body.id, name: body.name, platform: body.platform ?? null } }, 201);
});

// List all agents
agents.get('/', (c) => {
  const ONLINE_THRESHOLD = 60_000; // 60s
  const now = Date.now();
  const rows = db.prepare('SELECT * FROM agents').all() as any[];
  const result = rows.map(a => ({
    ...a,
    metadata: a.metadata ? JSON.parse(a.metadata) : null,
    online: a.last_seen_at ? (now - a.last_seen_at) < ONLINE_THRESHOLD : false,
  }));
  return c.json(result);
});

// Heartbeat
agents.post('/:id/heartbeat', (c) => {
  const id = c.req.param('id');
  const result = db.prepare('UPDATE agents SET last_seen_at = ? WHERE id = ?').run(Date.now(), id);
  if (result.changes === 0) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  return c.json({ ok: true });
});

export default agents;
