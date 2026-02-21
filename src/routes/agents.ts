import { Hono } from 'hono';
import db from '../db.js';
import { sseConnections } from './stream.js';
import { invalidateAgentCache, getCachedAgents } from '../cache.js';

const agents = new Hono();

// Track typing status: agentId -> timestamp
const typingStatus = new Map<string, number>();

agents.post('/register', async (c) => {
  const body = await c.req.json<{ id: string; name: string; platform?: string; webhook_url?: string; metadata?: Record<string, unknown>; capabilities?: string[] }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  const now = Date.now();
  const meta = body.metadata ? JSON.stringify(body.metadata) : null;
  const capabilities = body.capabilities ? JSON.stringify(body.capabilities) : null;

  const existing = await db.execute({ sql: 'SELECT id FROM agents WHERE id = ?', args: [body.id] });
  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE agents SET name = ?, platform = ?, last_seen_at = ?, metadata = ?, webhook_url = ?, capabilities = ? WHERE id = ?',
      args: [body.name, body.platform ?? null, now, meta, body.webhook_url ?? null, capabilities, body.id],
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO agents (id, name, platform, last_seen_at, metadata, webhook_url, capabilities, current_load) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [body.id, body.name, body.platform ?? null, now, meta, body.webhook_url ?? null, capabilities, 0],
    });
  }

  invalidateAgentCache();
  return c.json({ ok: true, agent: { id: body.id, name: body.name, platform: body.platform ?? null, webhook_url: body.webhook_url ?? null, capabilities: body.capabilities ?? null } }, 201);
});

agents.get('/', async (c) => {
  const ONLINE_THRESHOLD = 60_000;
  const POSSIBLY_OFFLINE_THRESHOLD = 300_000; // 5 minutes
  const now = Date.now();
  const agentList = await getCachedAgents();
  const rows = agentList.map((a: any) => {
    const lastSeen = a.last_seen_at ? Number(a.last_seen_at) : 0;
    const timeSince = now - lastSeen;
    let status = 'offline';
    if (lastSeen && timeSince < ONLINE_THRESHOLD) status = 'online';
    else if (lastSeen && timeSince < POSSIBLY_OFFLINE_THRESHOLD) status = 'possibly_offline';

    return {
      ...a,
      metadata: a.metadata ? JSON.parse(a.metadata) : null,
      capabilities: a.capabilities ? JSON.parse(a.capabilities) : null,
      current_load: Number(a.current_load) || 0,
      online: status === 'online',
      status,
    };
  });
  return c.json(rows);
});

// Find available agents by capability
agents.get('/available', async (c) => {
  const capability = c.req.query('capability');
  if (!capability) return c.json({ error: 'capability query param required' }, 400);

  const result = await db.execute('SELECT * FROM agents');
  const now = Date.now();
  const ONLINE_THRESHOLD = 300_000;
  const matched = result.rows.filter((a: any) => {
    if (!a.capabilities) return false;
    try {
      const caps: string[] = JSON.parse(a.capabilities);
      return caps.includes(capability);
    } catch { return false; }
  }).map((a: any) => ({
    ...a,
    metadata: a.metadata ? JSON.parse(a.metadata) : null,
    capabilities: a.capabilities ? JSON.parse(a.capabilities) : null,
    current_load: Number(a.current_load) || 0,
    online: a.last_seen_at ? (now - Number(a.last_seen_at)) < ONLINE_THRESHOLD : false,
  })).sort((a: any, b: any) => a.current_load - b.current_load);

  return c.json(matched);
});

agents.post('/:id/heartbeat', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), id] });
  if (result.rowsAffected === 0) {
    return c.json({ error: 'Agent not found' }, 404);
  }
  invalidateAgentCache();
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
