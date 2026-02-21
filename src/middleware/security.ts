import type { Context, Next } from 'hono';
import db from '../db.js';

// --- Audit Log Helper ---
export async function auditLog(
  database: typeof db,
  agentId: string,
  action: string,
  target: string,
  details: string,
  ip: string,
) {
  await database.execute({
    sql: 'INSERT INTO audit_log (agent_id, action, target, details, ip, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    args: [agentId, action, target, details, ip, Date.now()],
  });
}

// --- In-memory rate limit tracking ---
const rateCounts: Record<string, { count: number; windowStart: number }> = {};

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(rateCounts)) {
    if (now - rateCounts[key].windowStart > 120_000) delete rateCounts[key];
  }
}, 300_000);

function checkRateLimit(agentId: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateCounts[agentId];
  if (!entry || now - entry.windowStart > 60_000) {
    rateCounts[agentId] = { count: 1, windowStart: now };
    return { allowed: true, remaining: limit - 1 };
  }
  entry.count++;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

// --- Rate Limiter Middleware ---
export const rateLimiter = async (c: Context, next: Next) => {
  const agentId = c.req.header('X-Agent-Id') || (c.req.query('agent_id') as string);
  if (!agentId) {
    await next();
    return;
  }

  try {
    const row = await db.execute({
      sql: 'SELECT muted_until, revoked, rate_limit_per_min FROM agent_restrictions WHERE agent_id = ?',
      args: [agentId],
    });

    if (row.rows.length > 0) {
      const r = row.rows[0] as any;

      if (r.revoked) {
        return c.json({ error: 'Agent access has been revoked' }, 403);
      }

      if (r.muted_until && Number(r.muted_until) > Date.now()) {
        return c.json({ error: 'Agent is muted', muted_until: r.muted_until }, 403);
      }

      const limit = Number(r.rate_limit_per_min) || 10;
      const { allowed, remaining } = checkRateLimit(agentId, limit);
      c.res.headers.set('X-RateLimit-Remaining', String(remaining));
      if (!allowed) {
        return c.json({ error: 'Rate limit exceeded', limit_per_min: limit }, 429);
      }
    } else {
      const { allowed, remaining } = checkRateLimit(agentId, 10);
      c.res.headers.set('X-RateLimit-Remaining', String(remaining));
      if (!allowed) {
        return c.json({ error: 'Rate limit exceeded', limit_per_min: 10 }, 429);
      }
    }
  } catch {
    // Table might not exist yet, skip
  }

  await next();
};

// --- Agent Whitelist Check ---
export function isAgentWhitelisted(agentId: string): boolean {
  const whitelist = process.env.AGENT_WHITELIST;
  if (!whitelist) return true; // open registration
  const allowed = new Set(whitelist.split(',').map(s => s.trim()).filter(Boolean));
  return allowed.has(agentId);
}
