import type { AgentHarnessEvent, AgentMessage } from "@earendil-works/pi-agent-core";

// Re-export pi types used across the frontend
export type { AgentHarnessEvent, AgentMessage };

// --- Workspace ---

export interface Workspace {
  id: string;
  path: string;
  label: string;
  conversations: ConversationData[];
  createdAt: number;
}

export interface ConversationData {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
}

// Messages exchanged over WebSocket

export type WsServerMessage =
  | { type: "init_ok"; instanceId: string; cwd: string }
  | { type: "init_error"; error: string }
  | { type: "switch_ok"; instanceId: string; cwd: string }
  | { type: "switch_error"; error: string }
  | { type: "agent_event"; event: AgentHarnessEvent }
  | { type: "rpc_response"; id: string; data: unknown }
  | { type: "error"; id?: string; error: string };
