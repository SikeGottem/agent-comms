import { Hono } from 'hono';
import db from '../db.js';
import { sseConnections } from './stream.js';

const health = new Hono();
const startTime = Date.now();

health.get('/health', async (c) => {
  const t0 = Date.now();
  await db.execute('SELECT 1');
  const dbLatency = Date.now() - t0;

  let activeSSE = 0;
  sseConnections.forEach((conns) => {
    activeSSE += conns.size;
  });

  return c.json({
    status: 'ok',
    db_latency_ms: dbLatency,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    active_sse_connections: activeSSE,
    timestamp: Date.now(),
  });
});

export default health;
