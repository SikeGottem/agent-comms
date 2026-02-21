export type MessageType =
  | 'chat'
  | 'task'
  | 'status_update'
  | 'handoff'
  | 'code_review'
  | 'approval'
  | 'broadcast';

export interface Agent {
  id: string;
  name: string;
  platform: string | null;
  last_seen_at: number | null;
  metadata: string | null;
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
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channel: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

export interface SharedMemory {
  key: string;
  value: string;
  updated_by: string;
  updated_at: number;
}

// SSE connection registry
export type SSEConnections = Map<string, Set<(data: string) => void>>;
