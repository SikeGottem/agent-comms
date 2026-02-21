import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import db from '../db.js';
import type { SSEConnections } from '../types.js';

// Global SSE connection registry
export const sseConnections: SSEConnections = new Map();

const stream = new Hono();

stream.get('/', (c) => {
  const agentId = c.req.query('agent');
  if (!agentId) return c.json({ error: 'agent query param required' }, 400);

  // Update last_seen
  db.prepare('UPDATE agents SET last_seen_at = ? WHERE id = ?').run(Date.now(), agentId);

  return streamSSE(c, async (sse) => {
    // Register this connection
    if (!sseConnections.has(agentId)) {
      sseConnections.set(agentId, new Set());
    }

    const send = (data: string) => {
      sse.writeSSE({ data, event: 'message' }).catch(() => {});
    };

    sseConnections.get(agentId)!.add(send);

    // Send unread messages immediately
    const unread = db.prepare(
      `SELECT * FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL ORDER BY created_at ASC`
    ).all(agentId, agentId) as any[];

    for (const msg of unread) {
      await sse.writeSSE({ data: JSON.stringify(msg), event: 'message' });
    }

    await sse.writeSSE({ data: JSON.stringify({ type: 'connected', agent: agentId, unread: unread.length }), event: 'system' });

    // Heartbeat every 15s
    const heartbeat = setInterval(() => {
      sse.writeSSE({ data: '', event: 'heartbeat' }).catch(() => {
        clearInterval(heartbeat);
      });
      // Also update last_seen
      db.prepare('UPDATE agents SET last_seen_at = ? WHERE id = ?').run(Date.now(), agentId);
    }, 15_000);

    // Wait until connection closes
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
