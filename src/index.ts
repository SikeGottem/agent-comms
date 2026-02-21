import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { compress } from 'hono/compress';
import { serve } from '@hono/node-server';
import { authMiddleware } from './middleware/auth.js';
import { rateLimiter } from './middleware/security.js';
import agentRoutes from './routes/agents.js';
import messageRoutes from './routes/messages.js';
import channelRoutes from './routes/channels.js';
import streamRoute from './routes/stream.js';
import taskRoutes from './routes/tasks.js';
import memoryRoutes from './routes/memory.js';
import syncRoutes from './routes/sync.js';
import contextRoutes from './routes/contexts.js';
import adminRoutes from './routes/admin.js';
import healthRoutes from './routes/health.js';
import analyticsRoutes from './routes/analytics.js';
import eventRoutes from './routes/events.js';
import presenceRoutes from './routes/presence.js';
import batchRoutes from './routes/batch.js';
import { knowledgeRoutes, fileRoutes } from './routes/knowledge.js';
import workflowRoutes from './routes/workflows.js';
import delegationRoutes from './routes/delegations.js';
import { dashboardHTML } from './dashboard.js';
import db from './db.js';
import { generateETag } from './cache.js';

const app = new Hono();

// Compression (gzip/deflate for responses >1KB)
app.use('*', compress());

app.use('*', cors());
app.use('*', logger());

// Response time + keep-alive + cache headers
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const elapsed = Date.now() - start;
  c.res.headers.set('X-Response-Time', `${elapsed}ms`);
  c.res.headers.set('Connection', 'keep-alive');
  c.res.headers.set('Keep-Alive', 'timeout=30');
});

// Rate limiter for all API routes
app.use('*', rateLimiter);

// Root info (no auth)
app.get('/', (c) => c.json({
  name: 'agent-comms',
  version: '0.3.1',
  status: 'running',
  endpoints: ['/agents', '/messages', '/channels', '/stream', '/tasks', '/memory', '/sync', '/contexts', '/health', '/admin', '/analytics', '/events', '/presence', '/batch', '/knowledge', '/files', '/workflows', '/delegations'],
}));

// Health (no auth)
app.get('/health', async (c) => {
  const start = Date.now();
  try {
    await db.execute('SELECT 1');
    return c.json({ status: 'healthy', db_latency_ms: Date.now() - start, timestamp: Date.now() });
  } catch (e) {
    return c.json({ status: 'unhealthy', error: String(e), timestamp: Date.now() }, 500);
  }
});

// Dashboard (no auth)
app.get('/dashboard', (c) => c.html(dashboardHTML));

// Health routes (no auth)
app.route('/health-detail', healthRoutes);

// Admin routes (auth handled internally via X-Admin-Key)
app.route('/admin', adminRoutes);

// Analytics (mostly no auth, /track requires auth internally)
app.route('/analytics', analyticsRoutes);

// Auth for all other API routes
app.use('/agents/*', authMiddleware);
app.use('/messages/*', authMiddleware);
app.use('/channels/*', authMiddleware);
app.use('/stream/*', authMiddleware);
app.use('/tasks/*', authMiddleware);
app.use('/memory/*', authMiddleware);
app.use('/sync/*', authMiddleware);
app.use('/contexts/*', authMiddleware);
app.use('/knowledge/*', authMiddleware);
app.use('/files/*', authMiddleware);
app.use('/events/*', authMiddleware);
app.use('/presence/*', authMiddleware);
app.use('/batch/*', authMiddleware);
app.use('/workflows/*', authMiddleware);
app.use('/delegations/*', authMiddleware);

app.route('/agents', agentRoutes);
app.route('/messages', messageRoutes);
app.route('/channels', channelRoutes);
app.route('/stream', streamRoute);
app.route('/tasks', taskRoutes);
app.route('/memory', memoryRoutes);
app.route('/sync', syncRoutes);
app.route('/contexts', contextRoutes);
app.route('/events', eventRoutes);
app.route('/presence', presenceRoutes);
app.route('/batch', batchRoutes);
app.route('/knowledge', knowledgeRoutes);
app.route('/files', fileRoutes);
app.route('/workflows', workflowRoutes);
app.route('/delegations', delegationRoutes);

const port = Number(process.env.PORT) || 3141;
console.log(`🚀 agent-comms v0.3.1 running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
