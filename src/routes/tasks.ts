import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';

const tasks = new Hono();

// Create task
tasks.post('/', async (c) => {
  const body = await c.req.json<{
    title: string;
    description?: string;
    assigned_to?: string;
    created_by: string;
    priority?: string;
    channel?: string;
  }>();

  if (!body.title || !body.created_by) {
    return c.json({ error: 'title and created_by are required' }, 400);
  }

  const now = Date.now();
  const task = {
    id: uuid(),
    title: body.title,
    description: body.description ?? null,
    assigned_to: body.assigned_to ?? null,
    created_by: body.created_by,
    status: 'pending',
    priority: body.priority ?? 'medium',
    channel: body.channel ?? 'general',
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  await db.execute({
    sql: 'INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, channel, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [task.id, task.title, task.description, task.assigned_to, task.created_by, task.status, task.priority, task.channel, task.created_at, task.updated_at],
  });

  // Auto-post message to channel
  const msgId = uuid();
  const assignee = task.assigned_to ? ` → @${task.assigned_to}` : '';
  const content = `📋 New task: **${task.title}**${assignee} [${task.priority}]`;
  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msgId, task.created_by, task.assigned_to, task.channel, 'task', content, JSON.stringify({ task_id: task.id }), now],
  });

  // Push to SSE
  const payload = JSON.stringify({ id: msgId, from_agent: task.created_by, to_agent: task.assigned_to, channel: task.channel, type: 'task', content, metadata: JSON.stringify({ task_id: task.id }), created_at: now });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(payload));
  }

  return c.json({ ok: true, task }, 201);
});

// List tasks
tasks.get('/', async (c) => {
  const status = c.req.query('status');
  const channel = c.req.query('channel');
  const priority = c.req.query('priority');

  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const args: any[] = [];

  if (status) { sql += ' AND status = ?'; args.push(status); }
  if (channel) { sql += ' AND channel = ?'; args.push(channel); }
  if (priority) { sql += ' AND priority = ?'; args.push(priority); }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// Get tasks for a specific agent
tasks.get('/mine', async (c) => {
  const agent = c.req.query('agent');
  if (!agent) return c.json({ error: 'agent query param required' }, 400);

  const result = await db.execute({
    sql: 'SELECT * FROM tasks WHERE assigned_to = ? AND status != ? ORDER BY created_at DESC',
    args: [agent, 'done'],
  });
  return c.json(result.rows);
});

// Update task
tasks.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string; priority?: string; assigned_to?: string; title?: string; description?: string; updated_by?: string }>();

  const now = Date.now();
  const sets: string[] = ['updated_at = ?'];
  const args: any[] = [now];

  if (body.status) { sets.push('status = ?'); args.push(body.status); }
  if (body.priority) { sets.push('priority = ?'); args.push(body.priority); }
  if (body.assigned_to !== undefined) { sets.push('assigned_to = ?'); args.push(body.assigned_to); }
  if (body.title) { sets.push('title = ?'); args.push(body.title); }
  if (body.description !== undefined) { sets.push('description = ?'); args.push(body.description); }
  if (body.status === 'done') { sets.push('completed_at = ?'); args.push(now); }

  args.push(id);
  const result = await db.execute({ sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args });
  if (result.rowsAffected === 0) return c.json({ error: 'Task not found' }, 404);

  // Auto-post update message
  if (body.status) {
    const task = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] });
    const t = task.rows[0] as any;
    if (t) {
      const msgId = uuid();
      const content = `📋 Task "${t.title}" → ${body.status}`;
      const updatedBy = body.updated_by || 'system';
      await db.execute({
        sql: 'INSERT INTO messages (id, from_agent, channel, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [msgId, updatedBy, t.channel, 'task', content, JSON.stringify({ task_id: id }), now],
      });
      const payload = JSON.stringify({ id: msgId, from_agent: updatedBy, channel: t.channel, type: 'task', content, created_at: now });
      for (const [, conns] of sseConnections) {
        conns.forEach(send => send(payload));
      }
    }
  }

  return c.json({ ok: true });
});

export default tasks;
