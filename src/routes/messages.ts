import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';
import type { Message } from '../types.js';

// Generic webhook notification — reads webhook_url from agent registration
async function notifyAgent(agentId: string, fromAgent: string, content: string) {
  const result = await db.execute({ sql: 'SELECT webhook_url FROM agents WHERE id = ?', args: [agentId] });
  const agent = result.rows[0] as any;
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

async function getWebhookAgents(): Promise<string[]> {
  const result = await db.execute('SELECT id FROM agents WHERE webhook_url IS NOT NULL');
  return result.rows.map((r: any) => r.id);
}

// Parse @mentions from content
function parseMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_-]+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
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
    reply_to?: string;
  }>();

  if (!body.from_agent || !body.content) {
    return c.json({ error: 'from_agent and content are required' }, 400);
  }

  // Parse @mentions - if mentioned, set to_agent
  const mentions = parseMentions(body.content);
  let toAgent = body.to_agent ?? null;
  if (!toAgent && mentions.length > 0) {
    toAgent = mentions[0];
  }

  const msg: Message = {
    id: uuid(),
    from_agent: body.from_agent,
    to_agent: toAgent,
    channel: body.channel ?? 'general',
    type: (body.type as Message['type']) ?? 'chat',
    content: body.content,
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    created_at: Date.now(),
    delivered_at: null,
    read_at: null,
    reply_to: body.reply_to ?? null,
    pinned: 0,
  };

  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at, reply_to, pinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msg.id, msg.from_agent, msg.to_agent, msg.channel, msg.type, msg.content, msg.metadata, msg.created_at, msg.reply_to, 0],
  });

  // If handoff, auto-create task for receiving agent
  if (msg.type === 'handoff' && msg.metadata) {
    try {
      const meta = JSON.parse(msg.metadata);
      if (meta.to_agent) {
        const taskId = uuid();
        const now = Date.now();
        await db.execute({
          sql: 'INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [taskId, `Handoff: ${meta.from_task || 'task'}`, meta.context || msg.content, meta.to_agent, msg.from_agent, 'pending', 'high', msg.channel, now, now],
        });
      }
    } catch {}
  }

  // Push to SSE connections
  const payload = JSON.stringify(msg);
  if (msg.to_agent) {
    const conns = sseConnections.get(msg.to_agent);
    conns?.forEach(send => send(payload));
  } else {
    for (const [agentId, conns] of sseConnections) {
      if (agentId !== msg.from_agent) {
        conns.forEach(send => send(payload));
      }
    }
  }

  // Update sender's last_seen_at
  await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), msg.from_agent] });

  // Notify agents via webhooks (fire and forget)
  if (msg.to_agent) {
    notifyAgent(msg.to_agent, msg.from_agent, msg.content);
  } else {
    const webhookAgents = await getWebhookAgents();
    for (const agentId of webhookAgents) {
      if (agentId !== msg.from_agent) {
        notifyAgent(agentId, msg.from_agent, msg.content);
      }
    }
  }

  return c.json({ ok: true, message: { id: msg.id, created_at: msg.created_at } }, 201);
});

// Poll messages
messages.get('/', async (c) => {
  const channel = c.req.query('channel') ?? 'general';
  const since = c.req.query('since') ? Number(c.req.query('since')) : 0;
  const limit = c.req.query('limit') ? Math.min(Number(c.req.query('limit')), 200) : 50;
  const search = c.req.query('search');

  let sql = 'SELECT * FROM messages WHERE channel = ? AND created_at > ?';
  const args: any[] = [channel, since];

  if (search) {
    sql += ' AND content LIKE ?';
    args.push(`%${search}%`);
  }

  sql += ' ORDER BY created_at ASC LIMIT ?';
  args.push(limit);

  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// Acknowledge / mark read
messages.post('/:id/ack', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: 'delivered' | 'read' }>().catch(() => ({}));
  const status = (body as any)?.status ?? 'read';
  const col = status === 'delivered' ? 'delivered_at' : 'read_at';
  const result = await db.execute({ sql: `UPDATE messages SET ${col} = ? WHERE id = ?`, args: [Date.now(), id] });
  if (result.rowsAffected === 0) return c.json({ error: 'Message not found' }, 404);
  return c.json({ ok: true });
});

// Pin/unpin a message
messages.post('/:id/pin', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ pinned?: boolean }>().catch(() => ({}));
  const pinned = (body as any)?.pinned !== false ? 1 : 0;
  const result = await db.execute({ sql: 'UPDATE messages SET pinned = ? WHERE id = ?', args: [pinned, id] });
  if (result.rowsAffected === 0) return c.json({ error: 'Message not found' }, 404);
  return c.json({ ok: true, pinned: !!pinned });
});

// Unread messages for an agent
messages.get('/unread', async (c) => {
  const agentId = c.req.query('agent');
  if (!agentId) return c.json({ error: 'agent query param required' }, 400);

  // Update last_seen so polling agents show as online
  await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), agentId] });

  const result = await db.execute({
    sql: 'SELECT * FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL ORDER BY created_at ASC',
    args: [agentId, agentId],
  });

  return c.json(result.rows);
});

export default messages;
