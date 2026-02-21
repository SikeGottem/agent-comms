import { Hono } from 'hono';
import db from '../db.js';
import { sseConnections } from './stream.js';
import type { Client } from '@libsql/client';

// Valid status types
const VALID_STATUSES = ['online', 'busy', 'away', 'dnd', 'offline'] as const;
type PresenceStatus = (typeof VALID_STATUSES)[number];

// --- Init tables ---
async function initPresenceTables() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS agent_presence (
      agent_id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'offline',
      status_text TEXT,
      current_task TEXT,
      current_channel TEXT,
      mood TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS agent_activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      activity TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log(agent_id, timestamp);
  `);
}
initPresenceTables().catch(console.error);

// --- Exported helpers ---

export async function updatePresence(
  database: typeof db,
  agentId: string,
  fields: Partial<{ status: string; status_text: string | null; current_task: string | null; current_channel: string | null; mood: string | null }>
) {
  const now = Date.now();

  // Upsert presence
  const existing = await database.execute({ sql: 'SELECT agent_id FROM agent_presence WHERE agent_id = ?', args: [agentId] });
  if (existing.rows.length === 0) {
    await database.execute({
      sql: 'INSERT INTO agent_presence (agent_id, status, status_text, current_task, current_channel, mood, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        agentId,
        fields.status ?? 'online',
        fields.status_text ?? null,
        fields.current_task ?? null,
        fields.current_channel ?? null,
        fields.mood ?? null,
        now,
      ],
    });
  } else {
    const sets: string[] = ['updated_at = ?'];
    const args: any[] = [now];
    if (fields.status !== undefined) { sets.push('status = ?'); args.push(fields.status); }
    if (fields.status_text !== undefined) { sets.push('status_text = ?'); args.push(fields.status_text); }
    if (fields.current_task !== undefined) { sets.push('current_task = ?'); args.push(fields.current_task); }
    if (fields.current_channel !== undefined) { sets.push('current_channel = ?'); args.push(fields.current_channel); }
    if (fields.mood !== undefined) { sets.push('mood = ?'); args.push(fields.mood); }
    args.push(agentId);
    await database.execute({ sql: `UPDATE agent_presence SET ${sets.join(', ')} WHERE agent_id = ?`, args });
  }

  return now;
}

export async function logActivity(
  database: typeof db,
  agentId: string,
  activity: string,
  details?: string | null
) {
  const now = Date.now();
  await database.execute({
    sql: 'INSERT INTO agent_activity_log (agent_id, activity, details, timestamp) VALUES (?, ?, ?, ?)',
    args: [agentId, activity, details ?? null, now],
  });
  return now;
}

/** Call this when an agent sends a message to auto-set online */
export async function touchPresence(agentId: string) {
  await updatePresence(db, agentId, { status: 'online' });
}

// --- Broadcast helper ---
function broadcastPresenceChange(agentId: string, presence: Record<string, any>) {
  const payload = JSON.stringify({ type: 'presence_update', agent: agentId, presence });
  for (const [, conns] of sseConnections) {
    conns.forEach(send => send(payload, 'presence'));
  }
}

// --- Routes ---
const presence = new Hono();

// PATCH / — update my presence
presence.patch('/', async (c) => {
  const agentId = c.req.header('X-Agent-Id') || c.req.query('agent');
  if (!agentId) return c.json({ error: 'X-Agent-Id header or agent query param required' }, 400);

  const body = await c.req.json<{
    status?: string;
    status_text?: string | null;
    current_task?: string | null;
    current_channel?: string | null;
    mood?: string | null;
  }>();

  if (body.status && !VALID_STATUSES.includes(body.status as PresenceStatus)) {
    return c.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, 400);
  }

  const now = await updatePresence(db, agentId, body);

  // Fetch updated row
  const row = await db.execute({ sql: 'SELECT * FROM agent_presence WHERE agent_id = ?', args: [agentId] });
  const updated = row.rows[0] as any;

  broadcastPresenceChange(agentId, updated);

  return c.json({ ok: true, presence: updated });
});

// GET / — all agents' presence (with staleness check)
presence.get('/', async (c) => {
  const AWAY_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  const result = await db.execute('SELECT * FROM agent_presence ORDER BY updated_at DESC');
  const rows = result.rows.map((r: any) => {
    const updatedAt = Number(r.updated_at) || 0;
    const effectiveStatus = (r.status === 'online' && now - updatedAt > AWAY_THRESHOLD) ? 'away' : r.status;
    return { ...r, effective_status: effectiveStatus };
  });
  return c.json(rows);
});

// GET /who-is-available
presence.get('/who-is-available', async (c) => {
  const AWAY_THRESHOLD = 5 * 60 * 1000;
  const now = Date.now();
  const result = await db.execute(
    "SELECT * FROM agent_presence WHERE status = 'online' ORDER BY updated_at DESC"
  );

  // Filter out stale ones and enrich with task count
  const available = [];
  for (const r of result.rows as any[]) {
    const updatedAt = Number(r.updated_at) || 0;
    if (now - updatedAt > AWAY_THRESHOLD) continue; // stale = away

    const taskCount = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM tasks WHERE assigned_to = ? AND status IN ('pending', 'in_progress')",
      args: [r.agent_id],
    });
    available.push({
      ...r,
      active_tasks: Number((taskCount.rows[0] as any).cnt) || 0,
    });
  }

  available.sort((a, b) => a.active_tasks - b.active_tasks);
  return c.json(available);
});

// GET /activity/:agentId
presence.get('/activity/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const result = await db.execute({
    sql: 'SELECT * FROM agent_activity_log WHERE agent_id = ? ORDER BY timestamp DESC LIMIT ?',
    args: [agentId, limit],
  });
  return c.json(result.rows);
});

// GET /:agentId — single agent presence + last 10 activities
presence.get('/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const AWAY_THRESHOLD = 5 * 60 * 1000;
  const now = Date.now();

  const presenceResult = await db.execute({ sql: 'SELECT * FROM agent_presence WHERE agent_id = ?', args: [agentId] });
  if (presenceResult.rows.length === 0) {
    return c.json({ error: 'No presence data for agent' }, 404);
  }

  const p = presenceResult.rows[0] as any;
  const effectiveStatus = (p.status === 'online' && now - Number(p.updated_at) > AWAY_THRESHOLD) ? 'away' : p.status;

  const activities = await db.execute({
    sql: 'SELECT * FROM agent_activity_log WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 10',
    args: [agentId],
  });

  return c.json({
    presence: { ...p, effective_status: effectiveStatus },
    recent_activity: activities.rows,
  });
});

// POST /activity — log activity
presence.post('/activity', async (c) => {
  const agentId = c.req.header('X-Agent-Id') || c.req.query('agent');
  if (!agentId) return c.json({ error: 'X-Agent-Id header or agent query param required' }, 400);

  const body = await c.req.json<{ activity: string; details?: string }>();
  if (!body.activity) return c.json({ error: 'activity is required' }, 400);

  const ts = await logActivity(db, agentId, body.activity, body.details);

  // Also touch presence to online
  await updatePresence(db, agentId, { status: 'online' });

  return c.json({ ok: true, timestamp: ts });
});

export default presence;
