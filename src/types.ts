export type MessageType =
  | 'chat'
  | 'task'
  | 'status_update'
  | 'handoff'
  | 'code_review'
  | 'approval'
  | 'broadcast'
  | 'request'
  | 'response'
  | 'heartbeat'
  | 'coordination'
  | 'delegation';

export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Agent {
  id: string;
  name: string;
  platform: string | null;
  last_seen_at: number | null;
  metadata: string | null;
  webhook_url: string | null;
  capabilities: string | null;
  current_load: number;
}

export interface Message {
  id: string;
  from_agent: string;
  to_agent: string | null;
  channel: string;
  type: MessageType;
  content: string;
  metadata: string | null;
  created_at: number;
  delivered_at: number | null;
  read_at: number | null;
  reply_to: string | null;
  pinned: number | null;
  priority: MessagePriority;
  expires_at: number | null;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  topic: string | null;
  pinned_context: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channel: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  depends_on: string | null;
  deadline: number | null;
  required_capabilities: string | null;
}

export interface SharedMemory {
  key: string;
  value: string;
  updated_by: string;
  updated_at: number;
}

export interface Barrier {
  id: string;
  agents: string;
  channel: string;
  ready_agents: string;
  created_at: number;
  cleared: number;
}

export interface Lock {
  resource: string;
  agent: string;
  acquired_at: number;
  expires_at: number;
}

export interface Context {
  name: string;
  channel: string;
  messages: string;
  memory: string;
  tasks: string;
  created_at: number;
}

// SSE connection registry
export type SSEWriter = (data: string, event?: string) => void;
export type SSEConnections = Map<string, Set<SSEWriter>>;
