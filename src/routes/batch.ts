import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';

const batch = new Hono();

// Batch send messages
batch.post('/messages', async (c) => {
  const { messages } = await c.req.json<{
    messages: { content: string; from_agent: string; channel?: string; type?: string; priority?: string; reply_to?: string }[];
  }>();

  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'messages array is required' }, 400);
  }

  const now = Date.now();
  const created: any[] = [];

  const stmts = messages.map((m) => {
    const id = uuid();
    created.push({ id, from_agent: m.from_agent, channel: m.channel ?? 'general', type: m.type ?? 'chat', content: m.content, priority: m.priority ?? 'normal', reply_to: m.reply_to ?? null, created_at: now });
    return {
      sql: 'INSERT INTO messages (id, from_agent, channel, type, content, priority, reply_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, m.from_agent, m.channel ?? 'general', m.type ?? 'chat', m.content, m.priority ?? 'normal', m.reply_to ?? null, now],
    };
  });

  await db.batch(stmts);
  return c.json({ ok: true, created }, 201);
});

// Batch create tasks
batch.post('/tasks', async (c) => {
  const { tasks } = await c.req.json<{
    tasks: { title: string; description?: string; assigned_to?: string; created_by: string; channel?: string; priority?: string; depends_on?: string }[];
  }>();

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return c.json({ error: 'tasks array is required' }, 400);
  }

  const now = Date.now();
  const created: any[] = [];

  const stmts = tasks.map((t) => {
    const id = uuid();
    const task = { id, title: t.title, description: t.description ?? null, assigned_to: t.assigned_to ?? null, created_by: t.created_by, status: 'pending', priority: t.priority ?? 'medium', channel: t.channel ?? 'general', depends_on: t.depends_on ?? null, created_at: now, updated_at: now };
    created.push(task);
    return {
      sql: 'INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, channel, depends_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, task.title, task.description, task.assigned_to, task.created_by, task.status, task.priority, task.channel, task.depends_on, now, now],
    };
  });

  await db.batch(stmts);
  return c.json({ ok: true, created }, 201);
});

// Batch update tasks
batch.patch('/tasks', async (c) => {
  const { updates } = await c.req.json<{
    updates: { id: string; status?: string; priority?: string; assigned_to?: string }[];
  }>();

  if (!Array.isArray(updates) || updates.length === 0) {
    return c.json({ error: 'updates array is required' }, 400);
  }

  const now = Date.now();
  const results: any[] = [];

  const stmts = updates.map((u) => {
    const sets: string[] = ['updated_at = ?'];
    const args: any[] = [now];
    if (u.status) { sets.push('status = ?'); args.push(u.status); }
    if (u.priority) { sets.push('priority = ?'); args.push(u.priority); }
    if (u.assigned_to !== undefined) { sets.push('assigned_to = ?'); args.push(u.assigned_to); }
    if (u.status === 'done') { sets.push('completed_at = ?'); args.push(now); }
    args.push(u.id);
    results.push({ id: u.id, updated: true });
    return { sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args };
  });

  await db.batch(stmts);
  return c.json({ ok: true, results });
});

export default batch;
