import { createHash } from 'crypto';
import db from './db.js';

// === Generic In-Memory Cache ===
class Cache {
  private store = new Map<string, { data: any; expires: number }>();

  get(key: string): { data: any; hit: boolean } {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expires) {
      if (entry) this.store.delete(key);
      return { data: null, hit: false };
    }
    return { data: entry.data, hit: true };
  }

  set(key: string, data: any, ttlMs: number): void {
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const cache = new Cache();

// === ETag helper ===
export function generateETag(data: any): string {
  const hash = createHash('md5').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  return `"${hash}"`;
}

// === Agent cache (30s TTL) ===
export async function getCachedAgents(): Promise<any[]> {
  const { data, hit } = cache.get('agents:list');
  if (hit) return data;
  const result = await db.execute('SELECT * FROM agents');
  const rows = result.rows as any[];
  cache.set('agents:list', rows, 30_000);
  return rows;
}

export function invalidateAgentCache() {
  cache.invalidate('agents:');
}

// === Channel cache (60s TTL) ===
export async function getCachedChannels(): Promise<any[]> {
  const { data, hit } = cache.get('channels:list');
  if (hit) return data;
  const result = await db.execute('SELECT * FROM channels');
  const rows = result.rows as any[];
  cache.set('channels:list', rows, 60_000);
  return rows;
}

export function invalidateChannelCache() {
  cache.invalidate('channels:');
}

// === Unread count cache (5s TTL) ===
const UNREAD_TTL = 5_000;

export async function getCachedUnreadCount(agentId: string): Promise<{ total: number; urgent: number }> {
  const key = `unread:${agentId}`;
  const { data, hit } = cache.get(key);
  if (hit) return data;

  const result = await db.execute({
    sql: `SELECT COUNT(*) as total, SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent 
          FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
    args: [agentId, agentId, Date.now()],
  });
  const row = result.rows[0] as any;
  const counts = { total: Number(row.total) || 0, urgent: Number(row.urgent) || 0 };
  cache.set(key, counts, UNREAD_TTL);
  return counts;
}

export function invalidateUnreadCache(agentId?: string) {
  if (agentId) {
    cache.invalidate(`unread:${agentId}`);
  } else {
    cache.invalidate('unread:');
  }
}

// === Analytics cache (30s TTL) ===
export async function getCachedAnalyticsOverview(): Promise<any> {
  const { data, hit } = cache.get('analytics:overview');
  if (hit) return { data, hit: true };

  const today = new Date().toISOString().slice(0, 10);
  const startOfDay = new Date(today).getTime();

  const [msgStats, activeAgents, avgResp, busiestChannel] = await Promise.all([
    db.execute({ sql: 'SELECT COALESCE(SUM(messages_sent + messages_received), 0) as total FROM message_stats WHERE date = ?', args: [today] }),
    db.execute({ sql: 'SELECT COUNT(DISTINCT agent_id) as count FROM message_stats WHERE date = ?', args: [today] }),
    db.execute({ sql: 'SELECT COALESCE(AVG(avg_response_time_ms), 0) as avg FROM message_stats WHERE date = ? AND avg_response_time_ms > 0', args: [today] }),
    db.execute({ sql: 'SELECT channel, COUNT(*) as count FROM messages WHERE created_at >= ? GROUP BY channel ORDER BY count DESC LIMIT 1', args: [startOfDay] }),
  ]);

  const overview = {
    total_messages_today: Number(msgStats.rows[0]?.total ?? 0),
    active_agents: Number(activeAgents.rows[0]?.count ?? 0),
    avg_response_time_ms: Math.round(Number(avgResp.rows[0]?.avg ?? 0)),
    busiest_channel: busiestChannel.rows[0]?.channel ?? null,
  };

  cache.set('analytics:overview', overview, 30_000);
  return { data: overview, hit: false };
}

// === Task counts cache (10s TTL) ===
export async function getCachedTaskCounts(): Promise<any> {
  const { data, hit } = cache.get('tasks:counts');
  if (hit) return { data, hit: true };

  const result = await db.execute(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `);

  const counts: Record<string, number> = {};
  for (const row of result.rows) {
    counts[(row as any).status] = Number((row as any).count);
  }

  cache.set('tasks:counts', counts, 10_000);
  return { data: counts, hit: false };
}

export function invalidateTaskCache() {
  cache.invalidate('tasks:');
}

// === Was the last response from cache? (for X-Cache header) ===
let lastCacheHit = false;
export function setLastCacheHit(hit: boolean) { lastCacheHit = hit; }
export function getLastCacheHit(): boolean { return lastCacheHit; }
