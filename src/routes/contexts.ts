import { Hono } from 'hono';
import db from '../db.js';

const contexts = new Hono();

// Create context snapshot
contexts.post('/', async (c) => {
  const body = await c.req.json<{ name: string; channel?: string; message_limit?: number }>();
  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const channel = body.channel ?? 'general';
  const limit = body.message_limit ?? 20;
  const now = Date.now();

  // Gather messages
  const msgs = await db.execute({
    sql: 'SELECT * FROM messages WHERE channel = ? ORDER BY created_at DESC LIMIT ?',
    args: [channel, limit],
  });

  // Gather memory
  const mem = await db.execute('SELECT * FROM shared_memory ORDER BY updated_at DESC');

  // Gather active tasks
  const tasks = await db.execute({
    sql: "SELECT * FROM tasks WHERE channel = ? AND status != 'done' ORDER BY created_at DESC",
    args: [channel],
  });

  const context = {
    messages: JSON.stringify(msgs.rows),
    memory: JSON.stringify(mem.rows),
    tasks: JSON.stringify(tasks.rows),
  };

  await db.execute({
    sql: 'INSERT INTO contexts (name, channel, messages, memory, tasks, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(name) DO UPDATE SET channel = ?, messages = ?, memory = ?, tasks = ?, created_at = ?',
    args: [body.name, channel, context.messages, context.memory, context.tasks, now, channel, context.messages, context.memory, context.tasks, now],
  });

  return c.json({ ok: true, name: body.name, channel, message_count: msgs.rows.length, memory_count: mem.rows.length, task_count: tasks.rows.length }, 201);
});

// Get context
contexts.get('/:name', async (c) => {
  const name = c.req.param('name');
  const result = await db.execute({ sql: 'SELECT * FROM contexts WHERE name = ?', args: [name] });
  if (result.rows.length === 0) return c.json({ error: 'Context not found' }, 404);

  const ctx = result.rows[0] as any;
  return c.json({
    name: ctx.name,
    channel: ctx.channel,
    created_at: ctx.created_at,
    messages: JSON.parse(ctx.messages),
    memory: JSON.parse(ctx.memory),
    tasks: JSON.parse(ctx.tasks),
  });
});

// List contexts
contexts.get('/', async (c) => {
  const result = await db.execute('SELECT name, channel, created_at FROM contexts ORDER BY created_at DESC');
  return c.json(result.rows);
});

export default contexts;
