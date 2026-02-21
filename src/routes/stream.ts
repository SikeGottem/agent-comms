import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import db from '../db.js';
import type { SSEConnections } from '../types.js';
import { checkChannelAccess } from './channels.js';

export const sseConnections: SSEConnections = new Map();

// SSE event batching: collect events within 100ms window
class SSEBatcher {
  private queue: Array<{ data: string; event: string }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flush: (batch: Array<{ data: string; event: string }>) => void;

  constructor(flush: (batch: Array<{ data: string; event: string }>) => void) {
    this.flush = flush;
  }

  add(data: string, event: string) {
    this.queue.push({ data, event });
    if (!this.timer) {
      this.timer = setTimeout(() => {
        const batch = this.queue.splice(0);
        this.timer = null;
        if (batch.length > 0) this.flush(batch);
      }, 100);
    }
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.queue = [];
  }
}

let eventCounter = 0;

const stream = new Hono();

stream.get('/', async (c) => {
  const agentId = c.req.query('agent');
  if (!agentId) return c.json({ error: 'agent query param required' }, 400);

  const lastEventId = c.req.header('Last-Event-ID');

  await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), agentId] });

  return streamSSE(c, async (sse) => {
    if (!sseConnections.has(agentId)) {
      sseConnections.set(agentId, new Set());
    }

    const batcher = new SSEBatcher(async (batch) => {
      for (const item of batch) {
        eventCounter++;
        await sse.writeSSE({ data: item.data, event: item.event, id: String(eventCounter) }).catch(() => {});
      }
    });

    const send = async (data: string, event?: string) => {
      // Filter out private channel messages for non-members
      try {
        const parsed = JSON.parse(data);
        if (parsed.channel) {
          const hasAccess = await checkChannelAccess(parsed.channel, agentId);
          if (!hasAccess) return;
        }
      } catch {}
      batcher.add(data, event || 'message');
    };

    sseConnections.get(agentId)!.add(send);

    // Send unread messages — if Last-Event-ID provided, only send newer
    let unreadSql = `SELECT * FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY CASE WHEN priority = 'urgent' THEN 0 WHEN priority = 'high' THEN 1 WHEN priority = 'normal' THEN 2 ELSE 3 END, created_at ASC`;
    const unread = await db.execute({
      sql: unreadSql,
      args: [agentId, agentId, Date.now()],
    });

    for (const msg of unread.rows) {
      const m = msg as any;
      const eventType = m.priority === 'urgent' ? 'urgent' : 'message';
      eventCounter++;
      await sse.writeSSE({ data: JSON.stringify(msg), event: eventType, id: String(eventCounter) });
    }

    eventCounter++;
    await sse.writeSSE({ data: JSON.stringify({ type: 'connected', agent: agentId, unread: unread.rows.length }), event: 'system', id: String(eventCounter) });

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      eventCounter++;
      sse.writeSSE({ data: '', event: 'heartbeat', id: String(eventCounter) }).catch(() => {
        clearInterval(heartbeat);
      });
      db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), agentId] }).catch(() => {});
    }, 30_000);

    try {
      await new Promise<void>((resolve) => {
        c.req.raw.signal.addEventListener('abort', () => resolve());
      });
    } finally {
      clearInterval(heartbeat);
      batcher.destroy();
      sseConnections.get(agentId)?.delete(send);
      if (sseConnections.get(agentId)?.size === 0) {
        sseConnections.delete(agentId);
      }
    }
  });
});

export default stream;
