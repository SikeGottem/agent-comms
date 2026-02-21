import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';

const delegations = new Hono();

// ---------- schema migration ----------
async function initDelegationTable() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      parent_agent TEXT,
      sub_agent_id TEXT,
      sub_agent_label TEXT,
      status TEXT DEFAULT 'running',
      spawned_at INTEGER,
      completed_at INTEGER,
      result TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_delegations_task ON delegations(task_id);
    CREATE INDEX IF NOT EXISTS idx_delegations_parent ON delegations(parent_agent);
    CREATE INDEX IF NOT EXISTS idx_delegations_status ON delegations(status);
  `);
}
initDelegationTable().catch(console.error);

// ---------- helpers ----------
function broadcast(payload: object) {
  const data = JSON.stringify(payload);
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(data));
  }
}

async function postMessage(from: string, channel: string, type: string, content: string, meta?: object) {
  const id = uuid();
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, channel, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, from, channel, type, content, meta ? JSON.stringify(meta) : null, now],
  });
  broadcast({ id, from_agent: from, channel, type, content, created_at: now });
}

// POST / — record a new delegation
delegations.post('/', async (c) => {
  const body = await c.req.json<{
    task_id: string;
    parent_agent: string;
    sub_agent_id: string;
    sub_agent_label: string;
  }>();

  if (!body.task_id || !body.parent_agent || !body.sub_agent_id || !body.sub_agent_label) {
    return c.json({ error: 'task_id, parent_agent, sub_agent_id, and sub_agent_label are required' }, 400);
  }

  // Verify task exists
  const taskResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [body.task_id] });
  if (taskResult.rows.length === 0) {
    return c.json({ error: 'Task not found' }, 404);
  }
  const task = taskResult.rows[0] as any;

  const now = Date.now();
  const id = uuid();
  const delegation = {
    id,
    task_id: body.task_id,
    parent_agent: body.parent_agent,
    sub_agent_id: body.sub_agent_id,
    sub_agent_label: body.sub_agent_label,
    status: 'running',
    spawned_at: now,
    completed_at: null,
    result: null,
    error: null,
  };

  await db.execute({
    sql: 'INSERT INTO delegations (id, task_id, parent_agent, sub_agent_id, sub_agent_label, status, spawned_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, delegation.task_id, delegation.parent_agent, delegation.sub_agent_id, delegation.sub_agent_label, delegation.status, delegation.spawned_at],
  });

  // Post delegation message
  const content = `Delegating "${task.title}" to sub-agent ${body.sub_agent_label}`;
  await postMessage(body.parent_agent, task.channel || 'general', 'delegation', content, {
    task_id: body.task_id,
    sub_agent_id: body.sub_agent_id,
    delegation_id: id,
  });

  return c.json({ ok: true, delegation }, 201);
});

// GET /active — all currently running delegations
delegations.get('/active', async (c) => {
  const result = await db.execute({
    sql: "SELECT d.*, t.title as task_title FROM delegations d LEFT JOIN tasks t ON d.task_id = t.id WHERE d.status = 'running' ORDER BY d.spawned_at DESC",
    args: [],
  });
  return c.json(result.rows);
});

// GET / — list delegations with optional filters
delegations.get('/', async (c) => {
  const taskId = c.req.query('task_id');
  const parentAgent = c.req.query('parent_agent');

  let sql = 'SELECT d.*, t.title as task_title FROM delegations d LEFT JOIN tasks t ON d.task_id = t.id WHERE 1=1';
  const args: any[] = [];

  if (taskId) { sql += ' AND d.task_id = ?'; args.push(taskId); }
  if (parentAgent) { sql += ' AND d.parent_agent = ?'; args.push(parentAgent); }

  sql += ' ORDER BY d.spawned_at DESC LIMIT 100';

  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// GET /:id — single delegation detail
delegations.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({
    sql: 'SELECT d.*, t.title as task_title FROM delegations d LEFT JOIN tasks t ON d.task_id = t.id WHERE d.id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return c.json({ error: 'Delegation not found' }, 404);
  return c.json(result.rows[0]);
});

// PATCH /:id — update delegation status
delegations.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ status: string; result?: string; error?: string }>();

  if (!body.status || !['running', 'completed', 'failed'].includes(body.status)) {
    return c.json({ error: 'status must be running, completed, or failed' }, 400);
  }

  // Get delegation
  const delResult = await db.execute({ sql: 'SELECT * FROM delegations WHERE id = ?', args: [id] });
  if (delResult.rows.length === 0) return c.json({ error: 'Delegation not found' }, 404);
  const delegation = delResult.rows[0] as any;

  const now = Date.now();
  const sets: string[] = ['status = ?'];
  const args: any[] = [body.status];

  if (body.status === 'completed' || body.status === 'failed') {
    sets.push('completed_at = ?');
    args.push(now);
  }
  if (body.result !== undefined) { sets.push('result = ?'); args.push(body.result); }
  if (body.error !== undefined) { sets.push('error = ?'); args.push(body.error); }

  args.push(id);
  await db.execute({ sql: `UPDATE delegations SET ${sets.join(', ')} WHERE id = ?`, args });

  // Get parent task
  const taskResult = await db.execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [delegation.task_id] });
  const task = taskResult.rows[0] as any;

  if (task) {
    if (body.status === 'completed') {
      // Auto-update parent task to done
      await db.execute({
        sql: "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?",
        args: [now, now, delegation.task_id],
      });
      // Reduce agent load
      if (task.assigned_to) {
        await db.execute({ sql: 'UPDATE agents SET current_load = MAX(0, current_load - 1) WHERE id = ?', args: [task.assigned_to] });
      }
      const summary = body.result ? body.result.substring(0, 200) : 'No summary';
      await postMessage('system', task.channel || 'general', 'delegation',
        `🤖 Sub-agent ${delegation.sub_agent_label} completed task: ${task.title}. Result: ${summary}`,
        { task_id: delegation.task_id, delegation_id: id }
      );
    } else if (body.status === 'failed') {
      // Set parent task to blocked
      await db.execute({
        sql: "UPDATE tasks SET status = 'blocked', updated_at = ? WHERE id = ?",
        args: [now, delegation.task_id],
      });
      const errorMsg = body.error || 'Unknown error';
      await postMessage('system', task.channel || 'general', 'delegation',
        `⚠️ Sub-agent ${delegation.sub_agent_label} failed on: ${task.title}. Error: ${errorMsg}`,
        { task_id: delegation.task_id, delegation_id: id }
      );
    }
  }

  return c.json({ ok: true });
});

export default delegations;
