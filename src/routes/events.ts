import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import db from '../db.js';
import type { SSEWriter } from '../types.js';

const events = new Hono();

// SSE connections per agent
const eventSSEConnections = new Map<string, Set<SSEWriter>>();

// Init tables
async function initEventTables() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source_agent TEXT NOT NULL,
      channel TEXT,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS event_subscriptions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      webhook_url TEXT,
      filter TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_event_subs_agent ON event_subscriptions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_event_subs_type ON event_subscriptions(event_type);
  `);
}
initEventTables().catch(console.error);

function genId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function genSubId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Emit an event — usable by other routes */
export async function emitEvent(
  _db: typeof db,
  type: string,
  sourceAgent: string,
  channel: string | null,
  payload: Record<string, unknown> | null,
) {
  const id = genId();
  const now = Date.now();
  const payloadStr = payload ? JSON.stringify(payload) : null;

  await _db.execute({
    sql: 'INSERT INTO events (id, type, source_agent, channel, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, type, sourceAgent, channel ?? null, payloadStr, now],
  });

  const event = { id, type, source_agent: sourceAgent, channel, payload, created_at: now };

  // Find matching subscriptions
  const subs = await _db.execute({
    sql: 'SELECT * FROM event_subscriptions WHERE event_type = ?',
    args: [type],
  });

  for (const sub of subs.rows as any[]) {
    // Check filter match
    if (sub.filter) {
      try {
        const filter = JSON.parse(sub.filter);
        let match = true;
        for (const [k, v] of Object.entries(filter)) {
          if ((event as any)[k] !== v && (!payload || (payload as any)[k] !== v)) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      } catch { /* invalid filter, skip */ }
    }

    if (sub.webhook_url) {
      // Fire-and-forget webhook
      fetch(sub.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {});
    } else {
      // Push to SSE
      const conns = eventSSEConnections.get(sub.agent_id);
      if (conns) {
        const data = JSON.stringify(event);
        conns.forEach((send) => send(data, 'event'));
      }
    }
  }

  return event;
}

// POST /events/emit
events.post('/emit', async (c) => {
  const body = await c.req.json<{ type: string; source_agent: string; channel?: string; payload?: Record<string, unknown> }>();
  if (!body.type || !body.source_agent) {
    return c.json({ error: 'type and source_agent are required' }, 400);
  }

  const event = await emitEvent(db, body.type, body.source_agent, body.channel ?? null, body.payload ?? null);
  return c.json(event, 201);
});

// GET /events
events.get('/', async (c) => {
  const type = c.req.query('type');
  const since = c.req.query('since');
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);

  let sql = 'SELECT * FROM events WHERE 1=1';
  const args: any[] = [];

  if (type) {
    sql += ' AND type = ?';
    args.push(type);
  }
  if (since) {
    sql += ' AND created_at >= ?';
    args.push(Number(since));
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  args.push(limit);

  const result = await db.execute({ sql, args });
  const rows = result.rows.map((r: any) => ({
    ...r,
    payload: r.payload ? JSON.parse(r.payload) : null,
  }));

  return c.json(rows);
});

// GET /events/stream — SSE
events.get('/stream', async (c) => {
  const agentId = c.req.header('x-agent-id') || 'anonymous';

  return streamSSE(c, async (stream) => {
    const writer: SSEWriter = (data: string, event?: string) => {
      stream.writeSSE({ data, event: event || 'event', id: Date.now().toString() });
    };

    if (!eventSSEConnections.has(agentId)) {
      eventSSEConnections.set(agentId, new Set());
    }
    eventSSEConnections.get(agentId)!.add(writer);

    stream.writeSSE({ data: JSON.stringify({ connected: true, agent: agentId }), event: 'connected' });

    stream.onAbort(() => {
      const conns = eventSSEConnections.get(agentId);
      if (conns) {
        conns.delete(writer);
        if (conns.size === 0) eventSSEConnections.delete(agentId);
      }
    });

    // Keep alive
    while (true) {
      await stream.writeSSE({ data: '', event: 'ping' });
      await stream.sleep(30_000);
    }
  });
});

// POST /events/subscribe
events.post('/subscribe', async (c) => {
  const agentId = c.req.header('x-agent-id') || 'anonymous';
  const body = await c.req.json<{ event_type: string; webhook_url?: string; filter?: Record<string, unknown> }>();

  if (!body.event_type) {
    return c.json({ error: 'event_type is required' }, 400);
  }

  const id = genSubId();
  const now = Date.now();
  const filterStr = body.filter ? JSON.stringify(body.filter) : null;

  await db.execute({
    sql: 'INSERT INTO event_subscriptions (id, agent_id, event_type, webhook_url, filter, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [id, agentId, body.event_type, body.webhook_url ?? null, filterStr, now],
  });

  return c.json({ id, agent_id: agentId, event_type: body.event_type, webhook_url: body.webhook_url ?? null, filter: body.filter ?? null, created_at: now }, 201);
});

// GET /events/subscriptions
events.get('/subscriptions', async (c) => {
  const agentId = c.req.header('x-agent-id') || 'anonymous';
  const result = await db.execute({
    sql: 'SELECT * FROM event_subscriptions WHERE agent_id = ? ORDER BY created_at DESC',
    args: [agentId],
  });

  const rows = result.rows.map((r: any) => ({
    ...r,
    filter: r.filter ? JSON.parse(r.filter) : null,
  }));

  return c.json(rows);
});

// DELETE /events/subscriptions/:id
events.delete('/subscriptions/:id', async (c) => {
  const agentId = c.req.header('x-agent-id') || 'anonymous';
  const id = c.req.param('id');

  const result = await db.execute({
    sql: 'DELETE FROM event_subscriptions WHERE id = ? AND agent_id = ?',
    args: [id, agentId],
  });

  if (result.rowsAffected === 0) {
    return c.json({ error: 'Subscription not found' }, 404);
  }

  return c.json({ ok: true, deleted: id });
});

export default events;
