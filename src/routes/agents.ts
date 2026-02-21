import { Hono } from 'hono';
import db from '../db.js';
import { sseConnections } from './stream.js';

const agents = new Hono();

// Track typing status: agentId -> timestamp
const typingStatus = new Map<string, number>();

agents.post('/register', async (c) => {
  const body = await c.req.json<{ id: string; name: string; platform?: string; webhook_url?: string; metadata?: Record<string, unknown> }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  const now = Date.now();
  const meta = body.metadata ? JSON.stringify(body.metadata) : null;

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

// Typing indicator
agents.post('/:id/typing', async (c) => {
  const id = c.req.param('id');
  typingStatus.set(id, Date.now());

  // Broadcast typing to all SSE connections
  const payload = JSON.stringify({ type: 'typing', agent: id, timestamp: Date.now() });
  for (const [agentId, conns] of sseConnections) {
    if (agentId !== id) {
      conns.forEach(send => send(payload));
    }
  }

  return c.json({ ok: true });
});

// Get typing agents
agents.get('/typing', async (c) => {
  const now = Date.now();
  const TYPING_TIMEOUT = 5000;
  const typing: string[] = [];
  for (const [id, ts] of typingStatus) {
    if (now - ts < TYPING_TIMEOUT) {
      typing.push(id);
    } else {
      typingStatus.delete(id);
    }
  }
  return c.json(typing);
});

// Context injection helper
agents.get('/:id/context', async (c) => {
  const id = c.req.param('id');

  // Last 5 messages sent
  const msgs = await db.execute({
    sql: 'SELECT * FROM messages WHERE from_agent = ? ORDER BY created_at DESC LIMIT 5',
    args: [id],
  });

  // Current tasks
  const tasks = await db.execute({
    sql: 'SELECT * FROM tasks WHERE assigned_to = ? AND status != ? ORDER BY created_at DESC',
    args: [id, 'done'],
  });

  // Last seen
  const agent = await db.execute({ sql: 'SELECT last_seen_at FROM agents WHERE id = ?', args: [id] });

  return c.json({
    agent_id: id,
    last_seen: agent.rows[0] ? (agent.rows[0] as any).last_seen_at : null,
    recent_messages: msgs.rows,
    active_tasks: tasks.rows,
  });
});

export default agents;
