import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import db from '../db.js';
import type { SSEConnections } from '../types.js';

export const sseConnections: SSEConnections = new Map();

const stream = new Hono();

stream.get('/', async (c) => {
  const agentId = c.req.query('agent');
  if (!agentId) return c.json({ error: 'agent query param required' }, 400);

  await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), agentId] });

  return streamSSE(c, async (sse) => {
    if (!sseConnections.has(agentId)) {
      sseConnections.set(agentId, new Set());
    }

    const send = (data: string, event?: string) => {
      sse.writeSSE({ data, event: event || 'message' }).catch(() => {});
    };

    sseConnections.get(agentId)!.add(send);

    // Send unread messages immediately - urgent first
    const unread = await db.execute({
      sql: `SELECT * FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY CASE WHEN priority = 'urgent' THEN 0 WHEN priority = 'high' THEN 1 WHEN priority = 'normal' THEN 2 ELSE 3 END, created_at ASC`,
      args: [agentId, agentId, Date.now()],
    });

    for (const msg of unread.rows) {
      const m = msg as any;
      const eventType = m.priority === 'urgent' ? 'urgent' : 'message';
      await sse.writeSSE({ data: JSON.stringify(msg), event: eventType });
    }

    await sse.writeSSE({ data: JSON.stringify({ type: 'connected', agent: agentId, unread: unread.rows.length }), event: 'system' });

    const heartbeat = setInterval(() => {
      sse.writeSSE({ data: '', event: 'heartbeat' }).catch(() => {
        clearInterval(heartbeat);
      });
      db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), agentId] }).catch(() => {});
    }, 15_000);

    try {
      await new Promise<void>((resolve) => {
        c.req.raw.signal.addEventListener('abort', () => resolve());
      });
    } finally {
      clearInterval(heartbeat);
      sseConnections.get(agentId)?.delete(send);
      if (sseConnections.get(agentId)?.size === 0) {
        sseConnections.delete(agentId);
      }
    }
  });
});

export default stream;
