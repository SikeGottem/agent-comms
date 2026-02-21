import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import db from '../db.js';
import { sseConnections } from './stream.js';

const workflows = new Hono();

// ---------- schema migration ----------
async function initWorkflowTables() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      steps TEXT,
      status TEXT DEFAULT 'draft',
      created_at INTEGER,
      started_at INTEGER,
      completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      name TEXT NOT NULL,
      assigned_to TEXT,
      required_capabilities TEXT,
      status TEXT DEFAULT 'pending',
      input TEXT,
      output TEXT,
      started_at INTEGER,
      completed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_ws_workflow ON workflow_steps(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
  `);
}
initWorkflowTables().catch(console.error);

// ---------- helpers ----------
function broadcast(channel: string, payload: object) {
  const data = JSON.stringify(payload);
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(data));
  }
}

async function postMessage(from: string, channel: string, content: string, meta?: object) {
  const id = uuid();
  const now = Date.now();
  await db.execute({
    sql: 'INSERT INTO messages (id, from_agent, channel, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, from, channel, 'coordination', content, meta ? JSON.stringify(meta) : null, now],
  });
  broadcast(channel, { id, from_agent: from, channel, type: 'coordination', content, created_at: now });
}

async function activateDependentSteps(workflowId: string) {
  const allSteps = await db.execute({ sql: 'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_index', args: [workflowId] });
  const workflow = await db.execute({ sql: 'SELECT * FROM workflows WHERE id = ?', args: [workflowId] });
  if (!workflow.rows[0]) return;
  const wf = workflow.rows[0] as any;
  const stepDefs: any[] = JSON.parse(wf.steps || '[]');
  const steps = allSteps.rows as any[];
  const now = Date.now();

  let activated = 0;
  for (const step of steps) {
    if (step.status !== 'pending') continue;
    const def = stepDefs[step.step_index];
    if (!def) continue;
    const depIndex = def.depends_on_step;
    if (depIndex != null) {
      const depStep = steps.find((s: any) => s.step_index === depIndex);
      if (!depStep || depStep.status !== 'completed') continue;
    }
    // All deps satisfied — activate
    await db.execute({ sql: 'UPDATE workflow_steps SET status = ?, started_at = ? WHERE id = ?', args: ['active', now, step.id] });
    step.status = 'active';
    activated++;
    if (step.assigned_to) {
      broadcast('general', { type: 'workflow_step_active', workflow_id: workflowId, step_id: step.id, assigned_to: step.assigned_to });
    }
  }

  // Check if all complete
  const pending = steps.filter((s: any) => s.status !== 'completed');
  if (pending.length === 0) {
    await db.execute({ sql: "UPDATE workflows SET status = 'completed', completed_at = ? WHERE id = ?", args: [now, workflowId] });
    await postMessage('system', 'general', `✅ Workflow "${wf.name}" completed!`, { workflow_id: workflowId });
    broadcast('general', { type: 'workflow_completed', workflow_id: workflowId });
  }
}

// ---------- routes ----------

// POST / — create workflow
workflows.post('/', async (c) => {
  const body = await c.req.json<{ name: string; description?: string; created_by?: string; steps: any[] }>();
  if (!body.name || !body.steps?.length) return c.json({ error: 'name and steps[] required' }, 400);

  const now = Date.now();
  const id = uuid();
  const wf = {
    id,
    name: body.name,
    description: body.description ?? null,
    created_by: body.created_by ?? null,
    steps: JSON.stringify(body.steps),
    status: 'draft',
    created_at: now,
    started_at: null,
    completed_at: null,
  };

  await db.execute({
    sql: 'INSERT INTO workflows (id, name, description, created_by, steps, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [wf.id, wf.name, wf.description, wf.created_by, wf.steps, wf.status, wf.created_at],
  });

  // Create step rows
  const stepRows: any[] = [];
  for (let i = 0; i < body.steps.length; i++) {
    const s = body.steps[i];
    const stepId = uuid();
    await db.execute({
      sql: 'INSERT INTO workflow_steps (id, workflow_id, step_index, name, assigned_to, required_capabilities, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [stepId, id, i, s.name, s.assigned_to ?? null, s.required_capabilities ? JSON.stringify(s.required_capabilities) : null, 'pending'],
    });
    stepRows.push({ id: stepId, step_index: i, name: s.name, status: 'pending' });
  }

  return c.json({ ok: true, workflow: { ...wf, steps: body.steps }, step_rows: stepRows }, 201);
});

// GET /active — in-progress workflows
workflows.get('/active', async (c) => {
  const result = await db.execute({ sql: "SELECT * FROM workflows WHERE status = 'active' ORDER BY started_at DESC", args: [] });
  return c.json(result.rows);
});

// GET / — list all
workflows.get('/', async (c) => {
  const status = c.req.query('status');
  let sql = 'SELECT * FROM workflows';
  const args: any[] = [];
  if (status) { sql += ' WHERE status = ?'; args.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT 100';
  const result = await db.execute({ sql, args });
  return c.json(result.rows);
});

// GET /:id — full detail
workflows.get('/:id', async (c) => {
  const id = c.req.param('id');
  const wf = await db.execute({ sql: 'SELECT * FROM workflows WHERE id = ?', args: [id] });
  if (!wf.rows[0]) return c.json({ error: 'Workflow not found' }, 404);
  const steps = await db.execute({ sql: 'SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_index', args: [id] });
  return c.json({ ...wf.rows[0], step_rows: steps.rows });
});

// POST /:id/start
workflows.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const wf = await db.execute({ sql: 'SELECT * FROM workflows WHERE id = ?', args: [id] });
  if (!wf.rows[0]) return c.json({ error: 'Workflow not found' }, 404);
  const w = wf.rows[0] as any;
  if (w.status !== 'draft') return c.json({ error: `Cannot start workflow in status '${w.status}'` }, 400);

  const now = Date.now();
  await db.execute({ sql: "UPDATE workflows SET status = 'active', started_at = ? WHERE id = ?", args: [now, id] });
  await postMessage(w.created_by || 'system', 'general', `🚀 Workflow "${w.name}" started!`, { workflow_id: id });

  // Activate steps with no dependencies
  await activateDependentSteps(id);

  return c.json({ ok: true, status: 'active' });
});

// POST /:id/steps/:stepId/complete
workflows.post('/:id/steps/:stepId/complete', async (c) => {
  const { id, stepId } = c.req.param() as any;
  const body = await c.req.json<{ output?: string }>().catch(() => ({}));

  const step = await db.execute({ sql: 'SELECT * FROM workflow_steps WHERE id = ? AND workflow_id = ?', args: [stepId, id] });
  if (!step.rows[0]) return c.json({ error: 'Step not found' }, 404);
  const s = step.rows[0] as any;
  if (s.status === 'completed') return c.json({ error: 'Step already completed' }, 400);

  const now = Date.now();
  await db.execute({
    sql: 'UPDATE workflow_steps SET status = ?, output = ?, completed_at = ? WHERE id = ?',
    args: ['completed', (body as any).output ?? null, now, stepId],
  });

  // Progress workflow
  await activateDependentSteps(id);

  return c.json({ ok: true, step_id: stepId, status: 'completed' });
});

// POST /:id/steps/:stepId/assign
workflows.post('/:id/steps/:stepId/assign', async (c) => {
  const { id, stepId } = c.req.param() as any;
  const body = await c.req.json<{ agent_id: string }>();
  if (!body.agent_id) return c.json({ error: 'agent_id required' }, 400);

  const result = await db.execute({
    sql: 'UPDATE workflow_steps SET assigned_to = ? WHERE id = ? AND workflow_id = ?',
    args: [body.agent_id, stepId, id],
  });
  if (result.rowsAffected === 0) return c.json({ error: 'Step not found' }, 404);
  return c.json({ ok: true });
});

// DELETE /:id — cancel
workflows.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({ sql: "UPDATE workflows SET status = 'cancelled' WHERE id = ?", args: [id] });
  if (result.rowsAffected === 0) return c.json({ error: 'Workflow not found' }, 404);
  return c.json({ ok: true, status: 'cancelled' });
});

export default workflows;
