import { Hono } from 'hono';
import db from '../db.js';
import { auditLog } from '../middleware/security.js';

const admin = new Hono();

// --- Init tables ---
async function initAdminTables() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT,
      action TEXT,
      target TEXT,
      details TEXT,
      ip TEXT,
      timestamp INTEGER
    );
    CREATE TABLE IF NOT EXISTS agent_restrictions (
      agent_id TEXT PRIMARY KEY,
      muted_until INTEGER,
      revoked INTEGER DEFAULT 0,
      rate_limit_per_min INTEGER DEFAULT 10
    );
  `);
}
initAdminTables().catch(console.error);

// --- Admin auth middleware ---
admin.use('*', async (c, next) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return c.json({ error: 'ADMIN_KEY not configured' }, 500);
  const provided = c.req.header('X-Admin-Key');
  if (provided !== adminKey) return c.json({ error: 'Unauthorized' }, 401);
  await next();
});

const getIp = (c: any) => c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';

// POST /mute/:agentId
admin.post('/mute/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const body = await c.req.json<{ duration_minutes?: number }>().catch(() => ({}));
  const mins = (body as any).duration_minutes || 60;
  const mutedUntil = Date.now() + mins * 60_000;

  await db.execute({
    sql: `INSERT INTO agent_restrictions (agent_id, muted_until) VALUES (?, ?)
          ON CONFLICT(agent_id) DO UPDATE SET muted_until = ?`,
    args: [agentId, mutedUntil, mutedUntil],
  });

  await auditLog(db, 'admin', 'mute', agentId, `${mins} minutes`, getIp(c));
  return c.json({ ok: true, muted_until: mutedUntil });
});

// POST /revoke/:agentId
admin.post('/revoke/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  await db.execute({
    sql: `INSERT INTO agent_restrictions (agent_id, revoked) VALUES (?, 1)
          ON CONFLICT(agent_id) DO UPDATE SET revoked = 1`,
    args: [agentId],
  });
  await auditLog(db, 'admin', 'revoke', agentId, '', getIp(c));
  return c.json({ ok: true });
});

// POST /restore/:agentId
admin.post('/restore/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  await db.execute({
    sql: `INSERT INTO agent_restrictions (agent_id, muted_until, revoked) VALUES (?, NULL, 0)
          ON CONFLICT(agent_id) DO UPDATE SET muted_until = NULL, revoked = 0`,
    args: [agentId],
  });
  await auditLog(db, 'admin', 'restore', agentId, '', getIp(c));
  return c.json({ ok: true });
});

// POST /purge/:agentId
admin.post('/purge/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const result = await db.execute({ sql: 'DELETE FROM messages WHERE from_agent = ?', args: [agentId] });
  await auditLog(db, 'admin', 'purge', agentId, `${result.rowsAffected} messages deleted`, getIp(c));
  return c.json({ ok: true, deleted: result.rowsAffected });
});

// GET /audit
admin.get('/audit', async (c) => {
  const result = await db.execute('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100');
  return c.json(result.rows);
});

// GET /agents
admin.get('/agents', async (c) => {
  const result = await db.execute(`
    SELECT a.*, r.muted_until, r.revoked, r.rate_limit_per_min
    FROM agents a
    LEFT JOIN agent_restrictions r ON a.id = r.agent_id
  `);
  return c.json(result.rows);
});

export default admin;
