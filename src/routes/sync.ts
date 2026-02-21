import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';

const sync = new Hono();

// Create barrier
sync.post('/barrier', async (c) => {
  const body = await c.req.json<{ agents: string[]; channel?: string }>();
  if (!body.agents || body.agents.length < 2) {
    return c.json({ error: 'At least 2 agents required' }, 400);
  }

  const id = uuid();
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO barriers (id, agents, channel, ready_agents, created_at, cleared) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, JSON.stringify(body.agents), body.channel ?? 'general', '[]', now, 0],
  });

  return c.json({ ok: true, barrier_id: id, agents: body.agents }, 201);
});

// Mark agent ready for barrier
sync.post('/barrier/:id/ready', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ agent: string }>();
  if (!body.agent) return c.json({ error: 'agent is required' }, 400);

  const result = await db.execute({ sql: 'SELECT * FROM barriers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return c.json({ error: 'Barrier not found' }, 404);

  const barrier = result.rows[0] as any;
  if (barrier.cleared) return c.json({ error: 'Barrier already cleared' }, 400);

  const agents: string[] = JSON.parse(barrier.agents);
  const readyAgents: string[] = JSON.parse(barrier.ready_agents || '[]');

  if (!agents.includes(body.agent)) return c.json({ error: 'Agent not part of this barrier' }, 400);
  if (readyAgents.includes(body.agent)) return c.json({ ok: true, status: 'already_ready' });

  readyAgents.push(body.agent);
  await db.execute({
    sql: 'UPDATE barriers SET ready_agents = ? WHERE id = ?',
    args: [JSON.stringify(readyAgents), id],
  });

  // Check if all agents ready
  if (readyAgents.length === agents.length) {
    await db.execute({ sql: 'UPDATE barriers SET cleared = 1 WHERE id = ?', args: [id] });

    // Broadcast barrier cleared
    const payload = JSON.stringify({ type: 'barrier_cleared', barrier_id: id, agents, channel: barrier.channel, timestamp: Date.now() });
    for (const agent of agents) {
      const conns = sseConnections.get(agent);
      conns?.forEach(send => send(payload, 'system'));
    }

    // Post message
    const msgId = uuid();
    const content = `🚦 Barrier cleared! All agents ready: ${agents.join(', ')}`;
    await db.execute({
      sql: 'INSERT INTO messages (id, from_agent, channel, type, content, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [msgId, 'system', barrier.channel, 'coordination', content, Date.now(), 'high'],
    });

    return c.json({ ok: true, status: 'cleared', agents });
  }

  return c.json({ ok: true, status: 'waiting', ready: readyAgents, remaining: agents.filter(a => !readyAgents.includes(a)) });
});

// Get barrier status
sync.get('/barrier/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({ sql: 'SELECT * FROM barriers WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return c.json({ error: 'Barrier not found' }, 404);

  const barrier = result.rows[0] as any;
  return c.json({
    id: barrier.id,
    agents: JSON.parse(barrier.agents),
    ready_agents: JSON.parse(barrier.ready_agents || '[]'),
    cleared: !!barrier.cleared,
    channel: barrier.channel,
    created_at: barrier.created_at,
  });
});

// Acquire lock
sync.post('/lock', async (c) => {
  const body = await c.req.json<{ resource: string; agent: string; ttl_seconds?: number }>();
  if (!body.resource || !body.agent) return c.json({ error: 'resource and agent are required' }, 400);

  const ttl = (body.ttl_seconds ?? 300) * 1000;
  const now = Date.now();

  // Clean expired locks first
  await db.execute({ sql: 'DELETE FROM locks WHERE expires_at < ?', args: [now] });

  // Check existing
  const existing = await db.execute({ sql: 'SELECT * FROM locks WHERE resource = ?', args: [body.resource] });
  if (existing.rows.length > 0) {
    const lock = existing.rows[0] as any;
    return c.json({ error: 'Resource already locked', locked_by: lock.agent, expires_at: lock.expires_at }, 409);
  }

  await db.execute({
    sql: 'INSERT INTO locks (resource, agent, acquired_at, expires_at) VALUES (?, ?, ?, ?)',
    args: [body.resource, body.agent, now, now + ttl],
  });

  return c.json({ ok: true, resource: body.resource, agent: body.agent, expires_at: now + ttl }, 201);
});

// List locks
sync.get('/locks', async (c) => {
  const now = Date.now();
  await db.execute({ sql: 'DELETE FROM locks WHERE expires_at < ?', args: [now] });
  const result = await db.execute('SELECT * FROM locks ORDER BY acquired_at DESC');
  return c.json(result.rows);
});

// Release lock
sync.delete('/lock/:resource', async (c) => {
  const resource = c.req.param('resource');
  const result = await db.execute({ sql: 'DELETE FROM locks WHERE resource = ?', args: [resource] });
  if (result.rowsAffected === 0) return c.json({ error: 'Lock not found' }, 404);
  return c.json({ ok: true });
});

export default sync;
