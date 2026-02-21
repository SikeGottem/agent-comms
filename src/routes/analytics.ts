import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db.js';
import type { Client } from '@libsql/client';
import { getCachedAnalyticsOverview, generateETag } from '../cache.js';

// --- Init tables ---
async function initAnalyticsTables() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS message_stats (
      agent_id TEXT NOT NULL,
      date TEXT NOT NULL,
      messages_sent INTEGER DEFAULT 0,
      messages_received INTEGER DEFAULT 0,
      avg_response_time_ms INTEGER DEFAULT 0,
      PRIMARY KEY (agent_id, date)
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      messages_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_message_stats_date ON message_stats(date);
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent ON agent_sessions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_agent ON analytics_events(agent_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
  `);
}
initAnalyticsTables().catch(console.error);

// --- Helpers ---
export async function trackMessage(database: typeof db, agentId: string, direction: 'sent' | 'received') {
  const today = new Date().toISOString().slice(0, 10);
  const col = direction === 'sent' ? 'messages_sent' : 'messages_received';
  await database.execute({
    sql: `INSERT INTO message_stats (agent_id, date, ${col}) VALUES (?, ?, 1)
          ON CONFLICT(agent_id, date) DO UPDATE SET ${col} = ${col} + 1`,
    args: [agentId, today],
  });
}

export async function trackResponseTime(database: typeof db, agentId: string, ms: number) {
  const today = new Date().toISOString().slice(0, 10);
  // Rolling average: new_avg = (old_avg * (sent-1) + ms) / sent
  await database.execute({
    sql: `INSERT INTO message_stats (agent_id, date, avg_response_time_ms, messages_sent) VALUES (?, ?, ?, 1)
          ON CONFLICT(agent_id, date) DO UPDATE SET
            avg_response_time_ms = (avg_response_time_ms * (messages_sent - 1) + ?) / MAX(messages_sent, 1)`,
    args: [agentId, today, ms, ms],
  });
}

// --- Routes ---
const analyticsRoutes = new Hono();

// GET /overview — no auth, cached 30s
analyticsRoutes.get('/overview', async (c) => {
  const { data, hit } = await getCachedAnalyticsOverview();
  const etag = generateETag(data);
  if (c.req.header('If-None-Match') === etag) {
    c.res.headers.set('X-Cache', 'HIT');
    return c.body(null, 304);
  }
  c.res.headers.set('ETag', etag);
  c.res.headers.set('X-Cache', hit ? 'HIT' : 'MISS');
  return c.json(data);
});

// GET /agent/:id — no auth
analyticsRoutes.get('/agent/:id', async (c) => {
  const agentId = c.req.param('id');
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [dailyStats, avgResp, activeChannels, taskStats] = await Promise.all([
    db.execute({
      sql: 'SELECT date, messages_sent, messages_received, avg_response_time_ms FROM message_stats WHERE agent_id = ? AND date >= ? ORDER BY date',
      args: [agentId, sevenDaysAgo],
    }),
    db.execute({
      sql: 'SELECT COALESCE(AVG(avg_response_time_ms), 0) as avg FROM message_stats WHERE agent_id = ? AND avg_response_time_ms > 0',
      args: [agentId],
    }),
    db.execute({
      sql: `SELECT channel, COUNT(*) as count FROM messages WHERE from_agent = ? GROUP BY channel ORDER BY count DESC LIMIT 5`,
      args: [agentId],
    }),
    db.execute({
      sql: `SELECT
              COUNT(*) as total,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
            FROM tasks WHERE assigned_to = ?`,
      args: [agentId],
    }),
  ]);

  const total = Number(taskStats.rows[0]?.total ?? 0);
  const completed = Number(taskStats.rows[0]?.completed ?? 0);

  return c.json({
    agent_id: agentId,
    daily_stats: dailyStats.rows,
    avg_response_time_ms: Math.round(Number(avgResp.rows[0]?.avg ?? 0)),
    most_active_channels: activeChannels.rows,
    task_completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
  });
});

// GET /channels — no auth
analyticsRoutes.get('/channels', async (c) => {
  const channels = await db.execute(
    `SELECT
       channel,
       COUNT(*) as message_volume,
       COUNT(DISTINCT from_agent) as unique_agents,
       CAST((created_at / 3600000) % 24 AS INTEGER) as hour
     FROM messages
     GROUP BY channel`
  );

  // Get most active hours per channel
  const hourly = await db.execute(
    `SELECT channel, CAST((created_at / 3600000) % 24 AS INTEGER) as hour, COUNT(*) as count
     FROM messages GROUP BY channel, hour ORDER BY channel, count DESC`
  );

  const hourMap: Record<string, { hour: number; count: number }[]> = {};
  for (const row of hourly.rows) {
    const ch = String(row.channel);
    if (!hourMap[ch]) hourMap[ch] = [];
    hourMap[ch].push({ hour: Number(row.hour), count: Number(row.count) });
  }

  return c.json(
    channels.rows.map((r) => ({
      channel: r.channel,
      message_volume: Number(r.message_volume),
      unique_agents: Number(r.unique_agents),
      most_active_hours: (hourMap[String(r.channel)] || []).slice(0, 3),
    }))
  );
});

// GET /leaderboard — no auth
analyticsRoutes.get('/leaderboard', async (c) => {
  const [topSenders, topCompleters, fastestResponders] = await Promise.all([
    db.execute(
      `SELECT agent_id, SUM(messages_sent) as total_sent FROM message_stats GROUP BY agent_id ORDER BY total_sent DESC LIMIT 10`
    ),
    db.execute(
      `SELECT assigned_to as agent_id, COUNT(*) as tasks_completed FROM tasks WHERE status = 'done' GROUP BY assigned_to ORDER BY tasks_completed DESC LIMIT 10`
    ),
    db.execute(
      `SELECT agent_id, AVG(avg_response_time_ms) as avg_ms FROM message_stats WHERE avg_response_time_ms > 0 GROUP BY agent_id ORDER BY avg_ms ASC LIMIT 10`
    ),
  ]);

  return c.json({
    top_message_senders: topSenders.rows,
    top_task_completers: topCompleters.rows,
    fastest_responders: fastestResponders.rows,
  });
});

// POST /track — auth required
analyticsRoutes.use('/track', authMiddleware);
analyticsRoutes.post('/track', async (c) => {
  const body = await c.req.json<{ agent_id: string; event_type: string; metadata?: any }>();
  if (!body.agent_id || !body.event_type) {
    return c.json({ error: 'agent_id and event_type required' }, 400);
  }

  await db.execute({
    sql: 'INSERT INTO analytics_events (agent_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?)',
    args: [body.agent_id, body.event_type, body.metadata ? JSON.stringify(body.metadata) : null, Date.now()],
  });

  return c.json({ ok: true });
});

export default analyticsRoutes;
