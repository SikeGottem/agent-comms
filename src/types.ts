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
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
}

// SSE connection registry
export type SSEConnections = Map<string, Set<(data: string) => void>>;
