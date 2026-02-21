import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';
import type { Message } from '../types.js';

// Generic webhook notification — reads webhook_url from agent registration
async function notifyAgent(agentId: string, fromAgent: string, content: string) {
  const agent = db.prepare('SELECT webhook_url FROM agents WHERE id = ?').get(agentId) as any;
  if (!agent?.webhook_url) return;

  const preview = content.length > 200 ? content.slice(0, 200) + '...' : content;

  try {
    await fetch(agent.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'new_message',
        from_agent: fromAgent,
        to_agent: agentId,
        content: preview,
        timestamp: Date.now(),
      }),
    });
  } catch (e) {
    console.error(`[webhook] Failed to notify ${agentId}:`, e);
  }
}

// Also notify all agents with webhooks for broadcast messages
function getWebhookAgents(): string[] {
  const rows = db.prepare('SELECT id FROM agents WHERE webhook_url IS NOT NULL').all() as any[];
  return rows.map(r => r.id);
}

const messages = new Hono();

// Send a message
messages.post('/', async (c) => {
  const body = await c.req.json<{
    from_agent: string;
    to_agent?: string;
    channel?: string;
    type?: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>();

  if (!body.from_agent || !body.content) {
    return c.json({ error: 'from_agent and content are required' }, 400);
  }

  const msg: Message = {
    id: uuid(),
    from_agent: body.from_agent,
    to_agent: body.to_agent ?? null,
    channel: body.channel ?? 'general',
    type: (body.type as Message['type']) ?? 'chat',
    content: body.content,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    created_at: Date.now(),
    delivered_at: null,
    read_at: null,
  };

  db.prepare(`
    INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(msg.id, msg.from_agent, msg.to_agent, msg.channel, msg.type, msg.content, msg.metadata, msg.created_at);

  // Push to SSE connections
  const payload = JSON.stringify(msg);

  if (msg.to_agent) {
    // Direct message — push to recipient
    const conns = sseConnections.get(msg.to_agent);
    conns?.forEach(send => send(payload));
  } else {
    // Channel/broadcast — push to all connected agents except sender
    for (const [agentId, conns] of sseConnections) {
      if (agentId !== msg.from_agent) {
        conns.forEach(send => send(payload));
      }
    }
  }

  // Also update sender's last_seen_at
  db.prepare('UPDATE agents SET last_seen_at = ? WHERE id = ?').run(Date.now(), msg.from_agent);

  // Notify agents via webhooks (fire and forget)
  if (msg.to_agent) {
    notifyAgent(msg.to_agent, msg.from_agent, msg.content);
  } else {
    // Broadcast — notify all agents with webhooks except sender
    for (const agentId of getWebhookAgents()) {
      if (agentId !== msg.from_agent) {
        notifyAgent(agentId, msg.from_agent, msg.content);
      }
    }
  }

  return c.json({ ok: true, message: { id: msg.id, created_at: msg.created_at } }, 201);
});

// Poll messages
messages.get('/', (c) => {
  const channel = c.req.query('channel') ?? 'general';
  const since = c.req.query('since') ? Number(c.req.query('since')) : 0;
  const limit = c.req.query('limit') ? Math.min(Number(c.req.query('limit')), 200) : 50;

  const rows = db.prepare(
    'SELECT * FROM messages WHERE channel = ? AND created_at > ? ORDER BY created_at ASC LIMIT ?'
  ).all(channel, since, limit);

  return c.json(rows);
});

// Acknowledge / mark read
messages.post('/:id/ack', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: 'delivered' | 'read' }>().catch(() => ({}));
  const status = (body as any)?.status ?? 'read';
  const col = status === 'delivered' ? 'delivered_at' : 'read_at';
  const result = db.prepare(`UPDATE messages SET ${col} = ? WHERE id = ?`).run(Date.now(), id);
  if (result.changes === 0) return c.json({ error: 'Message not found' }, 404);
  return c.json({ ok: true });
});

// Unread messages for an agent
messages.get('/unread', (c) => {
  const agentId = c.req.query('agent');
  if (!agentId) return c.json({ error: 'agent query param required' }, 400);

  // Update last_seen so polling agents show as online
  db.prepare('UPDATE agents SET last_seen_at = ? WHERE id = ?').run(Date.now(), agentId);

  const rows = db.prepare(
    `SELECT * FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL ORDER BY created_at ASC`
  ).all(agentId, agentId);

  return c.json(rows);
});

export default messages;
