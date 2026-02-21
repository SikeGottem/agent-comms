import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';
import type { Message, MessagePriority } from '../types.js';
import { invalidateUnreadCache } from '../cache.js';

// Generic webhook notification
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

function parseMentions(content: string): string[] {
  const matches = content.match(/@([a-zA-Z0-9_-]+)/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1));
}

// Validate structured message types
function validateMessageSchema(type: string, content: string, metadata: any): string | null {
  switch (type) {
    case 'request':
      if (!metadata?.expected_response_type) return null; // optional validation
      break;
    case 'response':
      // reply_to is handled separately
      break;
    case 'heartbeat':
      // lightweight, no validation needed
      break;
    case 'coordination':
      break;
    case 'broadcast':
      break;
  }
  return null; // no error
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
    priority?: MessagePriority;
    expires_at?: number;
    deadline?: number;
    expected_response_type?: string;
  }>();

  if (!body.from_agent || !body.content) {
    return c.json({ error: 'from_agent and content are required' }, 400);
  }

  // Parse @mentions
  const mentions = parseMentions(body.content);
  let toAgent = body.to_agent ?? null;
  if (!toAgent && mentions.length > 0) {
    toAgent = mentions[0];
  }

  const priority: MessagePriority = body.priority ?? 'normal';
  const msgType = body.type ?? 'chat';

  // Build metadata with structured fields
  let meta = body.metadata ? { ...body.metadata } : {};
  if (body.deadline) meta.deadline = body.deadline;
  if (body.expected_response_type) meta.expected_response_type = body.expected_response_type;
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;

  // Validate structured message schema
  const schemaError = validateMessageSchema(msgType, body.content, meta);
  if (schemaError) {
    return c.json({ error: schemaError }, 400);
  }

  const msg: Message = {
    id: uuid(),
    from_agent: body.from_agent,
    to_agent: toAgent,
    channel: body.channel ?? 'general',
    type: msgType as Message['type'],
    content: body.content,
    metadata: metaStr,
    created_at: Date.now(),
    delivered_at: null,
    read_at: null,
    reply_to: body.reply_to ?? null,
    pinned: 0,
    priority,
    expires_at: body.expires_at ?? null,
  };

  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at, reply_to, pinned, priority, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msg.id, msg.from_agent, msg.to_agent, msg.channel, msg.type, msg.content, msg.metadata, msg.created_at, msg.reply_to, 0, msg.priority, msg.expires_at],
  });

  // If handoff, auto-create task for receiving agent
  if (msg.type === 'handoff' && msg.metadata) {
    try {
      const parsedMeta = JSON.parse(msg.metadata);
      if (parsedMeta.to_agent) {
        const taskId = uuid();
        const now = Date.now();
        await db.execute({
          sql: 'INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [taskId, `Handoff: ${parsedMeta.from_task || 'task'}`, parsedMeta.context || msg.content, parsedMeta.to_agent, msg.from_agent, 'pending', 'high', msg.channel, now, now],
        });
      }
    } catch {}
  }

  // Push to SSE connections
  const payload = JSON.stringify(msg);
  const sseEvent = msg.priority === 'urgent' ? 'urgent' : 'message';
  
  if (msg.to_agent) {
    const conns = sseConnections.get(msg.to_agent);
    conns?.forEach(send => send(payload, sseEvent));
  } else {
    for (const [agentId, conns] of sseConnections) {
      if (agentId !== msg.from_agent) {
        conns.forEach(send => send(payload, sseEvent));
      }
    }
  }

  // Invalidate unread cache
  invalidateUnreadCache();

  // Update sender's last_seen_at
  await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), msg.from_agent] });

  // Webhooks (fire and forget)
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

// Batch send messages
messages.post('/batch', async (c) => {
  const body = await c.req.json<{ messages: Array<{
    from_agent: string;
    to_agent?: string;
    channel?: string;
    type?: string;
    content: string;
    metadata?: Record<string, unknown>;
    priority?: MessagePriority;
  }> }>();

  if (!body.messages || !Array.isArray(body.messages)) {
    return c.json({ error: 'messages array is required' }, 400);
  }

  const results: { id: string; created_at: number }[] = [];
  const now = Date.now();

  for (const m of body.messages) {
    if (!m.from_agent || !m.content) continue;
    const id = uuid();
    const priority = m.priority ?? 'normal';
    const meta = m.metadata ? JSON.stringify(m.metadata) : null;
    
    await db.execute({
      sql: 'INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, m.from_agent, m.to_agent ?? null, m.channel ?? 'general', m.type ?? 'chat', m.content, meta, now, priority],
    });
    results.push({ id, created_at: now });

    // Push to SSE
    const payload = JSON.stringify({ id, from_agent: m.from_agent, to_agent: m.to_agent ?? null, channel: m.channel ?? 'general', type: m.type ?? 'chat', content: m.content, metadata: meta, created_at: now, priority });
    const sseEvent = priority === 'urgent' ? 'urgent' : 'message';
    for (const [agentId, conns] of sseConnections) {
      if (agentId !== m.from_agent) {
        conns.forEach(send => send(payload, sseEvent));
      }
    }
  }

  invalidateUnreadCache();
  return c.json({ ok: true, messages: results }, 201);
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
  const now = Date.now();
  
  // Set delivered_at on first delivery if not already set
  if (status === 'read') {
    await db.execute({ sql: 'UPDATE messages SET delivered_at = COALESCE(delivered_at, ?), read_at = ? WHERE id = ?', args: [now, now, id] });
  } else {
    await db.execute({ sql: `UPDATE messages SET ${col} = ? WHERE id = ?`, args: [now, id] });
  }
  
  invalidateUnreadCache();
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

  // Update last_seen
  await db.execute({ sql: 'UPDATE agents SET last_seen_at = ? WHERE id = ?', args: [Date.now(), agentId] });

  const now = Date.now();
  const result = await db.execute({
    sql: `SELECT * FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)
          ORDER BY CASE WHEN priority = 'urgent' THEN 0 WHEN priority = 'high' THEN 1 WHEN priority = 'normal' THEN 2 ELSE 3 END, created_at ASC`,
    args: [agentId, agentId, now],
  });

  // Mark delivered
  for (const msg of result.rows) {
    const m = msg as any;
    if (!m.delivered_at) {
      await db.execute({ sql: 'UPDATE messages SET delivered_at = ? WHERE id = ?', args: [now, m.id] });
    }
  }

  // Stats
  const msgs = result.rows as any[];
  const urgentCount = msgs.filter(m => m.priority === 'urgent').length;
  const oldestUnread = msgs.length > 0 ? Math.floor((now - Number(msgs[msgs.length - 1]?.created_at || now)) / 1000) : 0;

  return c.json({
    messages: msgs,
    stats: {
      total: msgs.length,
      urgent: urgentCount,
      oldest_unread_age_seconds: oldestUnread,
    },
  });
});

export default messages;
