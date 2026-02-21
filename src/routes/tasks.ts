import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';

const tasks = new Hono();

// Auto-assign based on capabilities and load
async function suggestAgent(requiredCapabilities: string[]): Promise<string | null> {
  const result = await db.execute('SELECT * FROM agents WHERE capabilities IS NOT NULL');
  let best: { id: string; load: number } | null = null;

  for (const agent of result.rows) {
    const a = agent as any;
    try {
      const caps: string[] = JSON.parse(a.capabilities);
      const hasAll = requiredCapabilities.every(rc => caps.includes(rc));
      if (hasAll) {
        const load = Number(a.current_load) || 0;
        if (!best || load < best.load) {
          best = { id: a.id, load };
        }
      }
    } catch {}
  }
  return best?.id ?? null;
}

// Notify dependent tasks when a task completes
async function notifyDependents(completedTaskId: string, completedTitle: string) {
  const result = await db.execute({
    sql: "SELECT * FROM tasks WHERE depends_on LIKE ? AND status != 'done'",
    args: [`%${completedTaskId}%`],
  });

  const now = Date.now();
  for (const row of result.rows) {
    const task = row as any;
    if (!task.assigned_to) continue;

    const msgId = uuid();
    const content = `🔓 Dependency resolved: "${completedTitle}" is done. Your task "${task.title}" may be unblocked.`;
    await db.execute({
      sql: 'INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [msgId, 'system', task.assigned_to, task.channel, 'coordination', content, JSON.stringify({ task_id: task.id, resolved_dependency: completedTaskId }), now, 'high'],
    });

    const conns = sseConnections.get(task.assigned_to);
    const payload = JSON.stringify({ id: msgId, from_agent: 'system', to_agent: task.assigned_to, channel: task.channel, type: 'coordination', content, created_at: now, priority: 'high' });
    conns?.forEach(send => send(payload));
  }
}

// Create task
tasks.post('/', async (c) => {
  const body = await c.req.json<{
    title: string;
    description?: string;
    assigned_to?: string;
    created_by: string;
    priority?: string;
    channel?: string;
    depends_on?: string[];
    deadline?: number;
    required_capabilities?: string[];
  }>();

  if (!body.title || !body.created_by) {
    return c.json({ error: 'title and created_by are required' }, 400);
  }

  let assignedTo = body.assigned_to ?? null;

  // Auto-suggest agent based on capabilities
  if (!assignedTo && body.required_capabilities && body.required_capabilities.length > 0) {
    assignedTo = await suggestAgent(body.required_capabilities);
  }

  const now = Date.now();
  const task = {
    id: uuid(),
    title: body.title,
    description: body.description ?? null,
    assigned_to: assignedTo,
    created_by: body.created_by,
    status: 'pending',
    priority: body.priority ?? 'medium',
    channel: body.channel ?? 'general',
    created_at: now,
    updated_at: now,
    completed_at: null,
    depends_on: body.depends_on ? body.depends_on.join(',') : null,
    deadline: body.deadline ?? null,
    required_capabilities: body.required_capabilities ? JSON.stringify(body.required_capabilities) : null,
  };

  await db.execute({
    sql: 'INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, channel, created_at, updated_at, depends_on, deadline, required_capabilities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [task.id, task.title, task.description, task.assigned_to, task.created_by, task.status, task.priority, task.channel, task.created_at, task.updated_at, task.depends_on, task.deadline, task.required_capabilities],
  });

  // Update agent load
  if (task.assigned_to) {
    await db.execute({ sql: 'UPDATE agents SET current_load = current_load + 1 WHERE id = ?', args: [task.assigned_to] });
  }

  // Broadcast task_created SSE event to ALL agents
  const taskPayload = JSON.stringify({ type: 'task_created', task });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(taskPayload, 'task_created'));
  }

  // Auto-post message
  const msgId = uuid();
  const assignee = task.assigned_to ? ` → @${task.assigned_to}` : '';
  const autoAssigned = (!body.assigned_to && task.assigned_to) ? ' (auto-assigned)' : '';
  const desc = task.description ? ` — ${task.description}` : '';
  const whoPicksUp = !task.assigned_to ? " Who's picking this up?" : '';
  const content = `📋 New task: **${task.title}**${desc}${assignee}${autoAssigned} [${task.priority}]${whoPicksUp}`;
  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, to_agent, channel, type, content, metadata, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msgId, task.created_by, task.assigned_to, task.channel, 'task', content, JSON.stringify({ task_id: task.id }), now, 'normal'],
  });

  const payload = JSON.stringify({ id: msgId, from_agent: task.created_by, to_agent: task.assigned_to, channel: task.channel, type: 'task', content, metadata: JSON.stringify({ task_id: task.id }), created_at: now });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(payload));
  }

  return c.json({ ok: true, task }, 201);
});

// Batch create tasks
tasks.post('/batch', async (c) => {
  const body = await c.req.json<{ tasks: Array<{
    title: string;
    description?: string;
    assigned_to?: string;
    created_by: string;
    priority?: string;
    channel?: string;
    depends_on?: string[];
    deadline?: number;
  }> }>();

  if (!body.tasks || !Array.isArray(body.tasks)) {
    return c.json({ error: 'tasks array is required' }, 400);
  }

  const results: any[] = [];
  const now = Date.now();

  for (const t of body.tasks) {
    if (!t.title || !t.created_by) continue;
    const id = uuid();
    await db.execute({
      sql: 'INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, channel, created_at, updated_at, depends_on, deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, t.title, t.description ?? null, t.assigned_to ?? null, t.created_by, 'pending', t.priority ?? 'medium', t.channel ?? 'general', now, now, t.depends_on ? t.depends_on.join(',') : null, t.deadline ?? null],
    });
    results.push({ id, title: t.title });
  }

  return c.json({ ok: true, tasks: results }, 201);
});

// Batch update tasks
tasks.patch('/batch', async (c) => {
  const body = await c.req.json<{ updates: Array<{ id: string; status?: string; priority?: string; updated_by?: string }> }>();

  if (!body.updates || !Array.isArray(body.updates)) {
    return c.json({ error: 'updates array is required' }, 400);
  }

  const now = Date.now();
  const results: any[] = [];

  for (const u of body.updates) {
    if (!u.id) continue;
    const sets: string[] = ['updated_at = ?'];
    const args: any[] = [now];

    if (u.status) { sets.push('status = ?'); args.push(u.status); }
    if (u.priority) { sets.push('priority = ?'); args.push(u.priority); }
    if (u.status === 'done') { sets.push('completed_at = ?'); args.push(now); }

    args.push(u.id);
    await db.execute({ sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args });

    if (u.status === 'done') {
      const task = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [u.id] });
      const t = task.rows[0] as any;
      if (t) {
        if (t.assigned_to) {
          await db.execute({ sql: 'UPDATE agents SET current_load = MAX(0, current_load - 1) WHERE id = ?', args: [t.assigned_to] });
        }
        await notifyDependents(u.id, t.title);
      }
    }

    results.push({ id: u.id, status: u.status });
  }

  return c.json({ ok: true, results });
});

// Auto-archive: done for 24+ hours → archived
async function autoArchive() {
  const cutoff = Date.now() - 86_400_000;
  await db.execute({
    sql: "UPDATE tasks SET status = 'archived' WHERE status = 'done' AND completed_at IS NOT NULL AND completed_at < ?",
    args: [cutoff],
  });
}

// List tasks
tasks.get('/', async (c) => {
  await autoArchive();

  const status = c.req.query('status');
  const channel = c.req.query('channel');
  const priority = c.req.query('priority');
  const includeArchived = c.req.query('include_archived') === 'true';

  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const args: any[] = [];

  if (status) { sql += ' AND status = ?'; args.push(status); }
  else if (!includeArchived) { sql += " AND status != 'archived'"; }
  if (channel) { sql += ' AND channel = ?'; args.push(channel); }
  if (priority) { sql += ' AND priority = ?'; args.push(priority); }

  sql += ' ORDER BY created_at DESC LIMIT 100';

  const result = await db.execute({ sql, args });
  const now = Date.now();
  const STALE_THRESHOLD = 10 * 60_000; // 10 minutes
  const rows = result.rows.map((r: any) => ({
    ...r,
    stale: r.status === 'pending' && !r.assigned_to && (now - Number(r.created_at)) > STALE_THRESHOLD,
  }));
  return c.json(rows);
});

// Archived tasks
tasks.get('/archived', async (c) => {
  await autoArchive();
  const channel = c.req.query('channel');
  let sql = "SELECT * FROM tasks WHERE status = 'archived'";
  const args: any[] = [];
  if (channel) { sql += ' AND channel = ?'; args.push(channel); }
  sql += ' ORDER BY completed_at DESC LIMIT 100';
  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// Ready tasks (all dependencies done)
tasks.get('/ready', async (c) => {
  const result = await db.execute({
    sql: "SELECT * FROM tasks WHERE status = 'pending' AND (depends_on IS NULL OR depends_on = '') ORDER BY created_at ASC",
    args: [],
  });

  // Also check tasks with depends_on where all deps are done
  const withDeps = await db.execute({
    sql: "SELECT * FROM tasks WHERE status = 'pending' AND depends_on IS NOT NULL AND depends_on != '' ORDER BY created_at ASC",
    args: [],
  });

  const ready = [...result.rows];

  for (const row of withDeps.rows) {
    const task = row as any;
    const depIds = task.depends_on.split(',').map((d: string) => d.trim()).filter(Boolean);
    if (depIds.length === 0) { ready.push(row); continue; }

    const placeholders = depIds.map(() => '?').join(',');
    const depsResult = await db.execute({
      sql: `SELECT COUNT(*) as done_count FROM tasks WHERE id IN (${placeholders}) AND status = 'done'`,
      args: depIds,
    });
    const doneCount = Number((depsResult.rows[0] as any).done_count);
    if (doneCount === depIds.length) {
      ready.push(row);
    }
  }

  return c.json(ready);
});

// Blocked tasks
tasks.get('/blocked', async (c) => {
  const withDeps = await db.execute({
    sql: "SELECT * FROM tasks WHERE status != 'done' AND depends_on IS NOT NULL AND depends_on != '' ORDER BY created_at ASC",
    args: [],
  });

  const blocked: any[] = [];

  for (const row of withDeps.rows) {
    const task = row as any;
    const depIds = task.depends_on.split(',').map((d: string) => d.trim()).filter(Boolean);
    if (depIds.length === 0) continue;

    const placeholders = depIds.map(() => '?').join(',');
    const depsResult = await db.execute({
      sql: `SELECT COUNT(*) as done_count FROM tasks WHERE id IN (${placeholders}) AND status = 'done'`,
      args: depIds,
    });
    const doneCount = Number((depsResult.rows[0] as any).done_count);
    if (doneCount < depIds.length) {
      blocked.push({ ...task, blocking_deps: depIds.length - doneCount, total_deps: depIds.length });
    }
  }

  return c.json(blocked);
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

// Claim a task
tasks.post('/:id/claim', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ agent_id: string }>();
  if (!body.agent_id) return c.json({ error: 'agent_id is required' }, 400);

  const result = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return c.json({ error: 'Task not found' }, 404);
  const task = result.rows[0] as any;

  if (task.status !== 'pending') {
    return c.json({ error: `Cannot claim task in status '${task.status}'` }, 409);
  }

  const now = Date.now();
  await db.execute({
    sql: "UPDATE tasks SET assigned_to = ?, status = 'in_progress', updated_at = ? WHERE id = ?",
    args: [body.agent_id, now, id],
  });

  // Update agent load
  await db.execute({ sql: 'UPDATE agents SET current_load = current_load + 1 WHERE id = ?', args: [body.agent_id] });

  // Broadcast task_claimed SSE event
  const claimPayload = JSON.stringify({ type: 'task_claimed', task_id: id, agent_id: body.agent_id, title: task.title });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(claimPayload, 'task_claimed'));
  }

  // Post message
  const msgId = uuid();
  const content = `✋ @${body.agent_id} claimed: **${task.title}**`;
  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, channel, type, content, metadata, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msgId, body.agent_id, task.channel, 'task', content, JSON.stringify({ task_id: id }), now, 'normal'],
  });
  const msgPayload = JSON.stringify({ id: msgId, from_agent: body.agent_id, channel: task.channel, type: 'task', content, created_at: now });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(msgPayload));
  }

  return c.json({ ok: true, task_id: id, claimed_by: body.agent_id });
});

// Complete a task
tasks.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ agent_id?: string; output?: string }>().catch(() => ({}));

  const result = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] });
  if (result.rows.length === 0) return c.json({ error: 'Task not found' }, 404);
  const task = result.rows[0] as any;

  if (task.status === 'done' || task.status === 'archived') {
    return c.json({ error: 'Task already completed' }, 400);
  }

  const now = Date.now();
  await db.execute({
    sql: "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?",
    args: [now, now, id],
  });

  // Update agent load
  if (task.assigned_to) {
    await db.execute({ sql: 'UPDATE agents SET current_load = MAX(0, current_load - 1) WHERE id = ?', args: [task.assigned_to] });
  }

  // Notify dependents
  await notifyDependents(id, task.title);

  // Broadcast task_completed SSE event
  const agent = (body as any).agent_id || task.assigned_to || 'system';
  const completePayload = JSON.stringify({ type: 'task_completed', task_id: id, agent_id: agent, title: task.title, output: (body as any).output ?? null });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(completePayload, 'task_completed'));
  }

  // Post message
  const msgId = uuid();
  const content = `✅ @${agent} completed: **${task.title}**`;
  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, channel, type, content, metadata, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [msgId, agent, task.channel, 'task', content, JSON.stringify({ task_id: id, output: (body as any).output ?? null }), now, 'normal'],
  });
  const msgPayload = JSON.stringify({ id: msgId, from_agent: agent, channel: task.channel, type: 'task', content, created_at: now });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(msgPayload));
  }

  return c.json({ ok: true, task_id: id, completed_by: agent });
});

// Update task
tasks.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string; priority?: string; assigned_to?: string; title?: string; description?: string; updated_by?: string; depends_on?: string[]; deadline?: number }>();

  const now = Date.now();
  const sets: string[] = ['updated_at = ?'];
  const args: any[] = [now];

  if (body.status) { sets.push('status = ?'); args.push(body.status); }
  if (body.priority) { sets.push('priority = ?'); args.push(body.priority); }
  if (body.assigned_to !== undefined) { sets.push('assigned_to = ?'); args.push(body.assigned_to); }
  if (body.title) { sets.push('title = ?'); args.push(body.title); }
  if (body.description !== undefined) { sets.push('description = ?'); args.push(body.description); }
  if (body.status === 'done') { sets.push('completed_at = ?'); args.push(now); }
  if (body.depends_on) { sets.push('depends_on = ?'); args.push(body.depends_on.join(',')); }
  if (body.deadline !== undefined) { sets.push('deadline = ?'); args.push(body.deadline); }

  args.push(id);
  const result = await db.execute({ sql: `UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, args });
  if (result.rowsAffected === 0) return c.json({ error: 'Task not found' }, 404);

  // Handle completion: update load, notify dependents
  if (body.status === 'done') {
    const task = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] });
    const t = task.rows[0] as any;
    if (t) {
      if (t.assigned_to) {
        await db.execute({ sql: 'UPDATE agents SET current_load = MAX(0, current_load - 1) WHERE id = ?', args: [t.assigned_to] });
      }
      await notifyDependents(id, t.title);
    }
  }

  // Auto-post update message
  if (body.status) {
    const task = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] });
    const t = task.rows[0] as any;
    if (t) {
      const msgId = uuid();
      const content = `📋 Task "${t.title}" → ${body.status}`;
      const updatedBy = body.updated_by || 'system';
      await db.execute({
        sql: 'INSERT INTO messages (id, from_agent, channel, type, content, metadata, created_at, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        args: [msgId, updatedBy, t.channel, 'task', content, JSON.stringify({ task_id: id }), now, 'normal'],
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
