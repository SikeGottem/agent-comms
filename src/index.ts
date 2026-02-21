import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { authMiddleware } from './middleware/auth.js';
import agentRoutes from './routes/agents.js';
import messageRoutes from './routes/messages.js';
import channelRoutes from './routes/channels.js';
import streamRoute from './routes/stream.js';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

// Health check (no auth)
app.get('/', (c) => c.json({
  name: 'agent-comms',
  version: '0.1.0',
  status: 'running',
  endpoints: ['/agents', '/messages', '/channels', '/stream'],
}));

// Auth for all API routes
app.use('/agents/*', authMiddleware);
app.use('/messages/*', authMiddleware);
app.use('/channels/*', authMiddleware);
app.use('/stream/*', authMiddleware);

app.route('/agents', agentRoutes);
app.route('/messages', messageRoutes);
app.route('/channels', channelRoutes);
app.route('/stream', streamRoute);

const port = Number(process.env.PORT) || 3141;
console.log(`🚀 agent-comms running on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
