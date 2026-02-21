import { Hono } from 'hono';
import { randomBytes } from 'crypto';
import db from '../db.js';

const channels = new Hono();

// Helper: check if a channel is private
async function isChannelPrivate(channelId: string): Promise<boolean> {
  const result = await db.execute({ sql: 'SELECT is_private FROM channels WHERE id = ?', args: [channelId] });
  return result.rows.length > 0 && (result.rows[0] as any).is_private === 1;
}

// Helper: check if agent is a member of a private channel
export async function isChannelMember(channelId: string, agentId: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'SELECT 1 FROM channel_members WHERE channel_id = ? AND agent_id = ?',
    args: [channelId, agentId],
  });
  return result.rows.length > 0;
}

// Helper: check if agent has admin/owner role
async function hasAdminRole(channelId: string, agentId: string): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 FROM channel_members WHERE channel_id = ? AND agent_id = ? AND role IN ('owner', 'admin')",
    args: [channelId, agentId],
  });
  return result.rows.length > 0;
}

// Helper: check channel access (returns true if public or agent is member)
export async function checkChannelAccess(channelId: string, agentId: string): Promise<boolean> {
  const priv = await isChannelPrivate(channelId);
  if (!priv) return true;
  return isChannelMember(channelId, agentId);
}

// Create channel
channels.post('/', async (c) => {
  const body = await c.req.json<{
    id: string; name: string; description?: string; topic?: string;
    is_private?: boolean; allowed_agents?: string[]; created_by?: string;
  }>();
  if (!body.id || !body.name) {
    return c.json({ error: 'id and name are required' }, 400);
  }

  const isPrivate = body.is_private ? 1 : 0;
  const inviteCode = isPrivate ? randomBytes(8).toString('hex') : null;
  const createdBy = body.created_by || null;

  await db.execute({
    sql: 'INSERT OR IGNORE INTO channels (id, name, description, created_at, topic, is_private, invite_code, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [body.id, body.name, body.description ?? null, Date.now(), body.topic ?? null, isPrivate, inviteCode, createdBy],
  });

  // If private, add creator as owner and allowed_agents as members
  if (isPrivate && createdBy) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO channel_members (channel_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)',
      args: [body.id, createdBy, 'owner', Date.now()],
    });
  }

  if (isPrivate && body.allowed_agents) {
    for (const agentId of body.allowed_agents) {
      await db.execute({
        sql: 'INSERT OR IGNORE INTO channel_members (channel_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)',
        args: [body.id, agentId, 'member', Date.now()],
      });
    }
  }

  const response: any = { ok: true, channel: { id: body.id, name: body.name, is_private: !!isPrivate } };
  if (inviteCode) response.invite_code = inviteCode;
  return c.json(response, 201);
});

// List channels (filter private channels for non-members)
channels.get('/', async (c) => {
  const agentId = c.req.query('agent') || c.req.header('X-Agent-Id') || '';
  const result = await db.execute('SELECT * FROM channels');
  const rows = result.rows as any[];

  // Filter: only show private channels to members
  const filtered = [];
  for (const ch of rows) {
    if (ch.is_private) {
      if (agentId && await isChannelMember(ch.id, agentId)) {
        filtered.push(ch);
      }
      // Non-members don't see private channels
    } else {
      filtered.push(ch);
    }
  }
  return c.json(filtered);
});

// Update channel
channels.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ topic?: string; pinned_context?: string; description?: string }>();

  const sets: string[] = [];
  const args: any[] = [];

  if (body.topic !== undefined) { sets.push('topic = ?'); args.push(body.topic); }
  if (body.pinned_context !== undefined) { sets.push('pinned_context = ?'); args.push(body.pinned_context); }
  if (body.description !== undefined) { sets.push('description = ?'); args.push(body.description); }

  if (sets.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  args.push(id);
  const result = await db.execute({ sql: `UPDATE channels SET ${sets.join(', ')} WHERE id = ?`, args });
  if (result.rowsAffected === 0) return c.json({ error: 'Channel not found' }, 404);
  return c.json({ ok: true });
});

// Invite agent to private channel (owner/admin only)
channels.post('/:id/invite', async (c) => {
  const channelId = c.req.param('id');
  const body = await c.req.json<{ agent_id: string; invited_by: string }>();

  if (!body.agent_id || !body.invited_by) {
    return c.json({ error: 'agent_id and invited_by are required' }, 400);
  }

  if (!(await hasAdminRole(channelId, body.invited_by))) {
    return c.json({ error: 'Only owner/admin can invite members' }, 403);
  }

  await db.execute({
    sql: 'INSERT OR IGNORE INTO channel_members (channel_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)',
    args: [channelId, body.agent_id, 'member', Date.now()],
  });

  return c.json({ ok: true });
});

// Join channel via invite code
channels.post('/join', async (c) => {
  const body = await c.req.json<{ invite_code: string; agent_id: string }>();
  if (!body.invite_code || !body.agent_id) {
    return c.json({ error: 'invite_code and agent_id are required' }, 400);
  }

  const result = await db.execute({
    sql: 'SELECT id, is_private FROM channels WHERE invite_code = ?',
    args: [body.invite_code],
  });

  if (result.rows.length === 0) {
    return c.json({ error: 'Invalid invite code' }, 404);
  }

  const channel = result.rows[0] as any;
  await db.execute({
    sql: 'INSERT OR IGNORE INTO channel_members (channel_id, agent_id, role, joined_at) VALUES (?, ?, ?, ?)',
    args: [channel.id, body.agent_id, 'member', Date.now()],
  });

  return c.json({ ok: true, channel_id: channel.id });
});

// List channel members
channels.get('/:id/members', async (c) => {
  const channelId = c.req.param('id');
  const result = await db.execute({
    sql: 'SELECT * FROM channel_members WHERE channel_id = ? ORDER BY role, agent_id',
    args: [channelId],
  });
  return c.json(result.rows);
});

// Remove member (owner/admin only)
channels.delete('/:id/members/:agentId', async (c) => {
  const channelId = c.req.param('id');
  const agentId = c.req.param('agentId');
  const removedBy = c.req.query('by') || c.req.header('X-Agent-Id') || '';

  if (!removedBy) {
    return c.json({ error: 'Must specify who is removing (query param "by" or X-Agent-Id header)' }, 400);
  }

  if (!(await hasAdminRole(channelId, removedBy))) {
    return c.json({ error: 'Only owner/admin can remove members' }, 403);
  }

  // Can't remove the owner
  const target = await db.execute({
    sql: 'SELECT role FROM channel_members WHERE channel_id = ? AND agent_id = ?',
    args: [channelId, agentId],
  });
  if (target.rows.length > 0 && (target.rows[0] as any).role === 'owner') {
    return c.json({ error: 'Cannot remove channel owner' }, 403);
  }

  await db.execute({
    sql: 'DELETE FROM channel_members WHERE channel_id = ? AND agent_id = ?',
    args: [channelId, agentId],
  });

  return c.json({ ok: true });
});

// Channel summary
channels.get('/:id/summary', async (c) => {
  const id = c.req.param('id');
  const result = await db.execute({
    sql: 'SELECT * FROM messages WHERE channel = ? ORDER BY created_at DESC LIMIT 10',
    args: [id],
  });

  const channelResult = await db.execute({ sql: 'SELECT topic, pinned_context, is_private FROM channels WHERE id = ?', args: [id] });
  const channelInfo = channelResult.rows[0] as any;

  const msgs = result.rows.reverse();
  const summary = msgs.map((m: any) => ({
    from: m.from_agent,
    type: m.type,
    content: m.content?.length > 100 ? m.content.slice(0, 100) + '...' : m.content,
    time: m.created_at,
  }));

  return c.json({
    channel: id,
    topic: channelInfo?.topic ?? null,
    pinned_context: channelInfo?.pinned_context ?? null,
    is_private: !!(channelInfo?.is_private),
    message_count: msgs.length,
    time_range: msgs.length > 0 ? { from: (msgs[0] as any).created_at, to: (msgs[msgs.length - 1] as any).created_at } : null,
    summary,
  });
});

export default channels;
