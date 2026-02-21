import db from './db.js';

// In-memory agent cache
let agentCache: any[] = [];
let agentCacheTime = 0;
const AGENT_CACHE_TTL = 30_000;

export async function getCachedAgents(): Promise<any[]> {
  if (Date.now() - agentCacheTime < AGENT_CACHE_TTL && agentCache.length > 0) {
    return agentCache;
  }
  const result = await db.execute('SELECT * FROM agents');
  agentCache = result.rows as any[];
  agentCacheTime = Date.now();
  return agentCache;
}

export function invalidateAgentCache() {
  agentCacheTime = 0;
}

// Unread count cache per agent
const unreadCache = new Map<string, { count: number; urgent: number; time: number }>();
const UNREAD_CACHE_TTL = 10_000;

export async function getCachedUnreadCount(agentId: string): Promise<{ total: number; urgent: number }> {
  const cached = unreadCache.get(agentId);
  if (cached && Date.now() - cached.time < UNREAD_CACHE_TTL) {
    return { total: cached.count, urgent: cached.urgent };
  }
  const result = await db.execute({
    sql: `SELECT COUNT(*) as total, SUM(CASE WHEN priority = 'urgent' THEN 1 ELSE 0 END) as urgent 
          FROM messages WHERE (to_agent = ? OR (to_agent IS NULL AND from_agent != ?)) AND read_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`,
    args: [agentId, agentId, Date.now()],
  });
  const row = result.rows[0] as any;
  const total = Number(row.total) || 0;
  const urgent = Number(row.urgent) || 0;
  unreadCache.set(agentId, { count: total, urgent, time: Date.now() });
  return { total, urgent };
}

export function invalidateUnreadCache(agentId?: string) {
  if (agentId) {
    unreadCache.delete(agentId);
  } else {
    unreadCache.clear();
  }
}
