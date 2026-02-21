import { createMiddleware } from 'hono/factory';

const getValidKeys = (): Set<string> => {
  const keys = process.env.AGENT_KEYS || '';
  return new Set(keys.split(',').map(k => k.trim()).filter(Boolean));
};

export const authMiddleware = createMiddleware(async (c, next) => {
  const key = c.req.header('X-Agent-Key') || c.req.query('key');
  if (!key) {
    return c.json({ error: 'Missing X-Agent-Key header' }, 401);
  }
  const validKeys = getValidKeys();
  if (!validKeys.has(key)) {
    return c.json({ error: 'Invalid API key' }, 403);
  }
  await next();
});
