import { create } from "zustand";
import type { AgentMessage, AgentHarnessEvent } from "@/types";
import type { Workspace, ConversationData } from "@/types";
import type { UserMessage, TextContent } from "@earendil-works/pi-ai";

// --- Persistence ---

const STORAGE_KEY = "pi-workspaces";
const LEGACY_KEY = "pi-conversations";

function loadWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Workspace[];
  } catch { /* ignore */ }

  // Migrate legacy flat conversations into a default workspace
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const conversations = JSON.parse(legacy) as ConversationData[];
      if (conversations.length > 0) {
        const ws: Workspace = {
          id: generateId(),
          path: "",
          label: "默认工作区",
          conversations,
          createdAt: Date.now(),
        };
        const workspaces = [ws];
        saveWorkspaces(workspaces);
        localStorage.removeItem(LEGACY_KEY);
        return workspaces;
      }
    }
  } catch { /* ignore */ }

  return [];
}

function saveWorkspaces(workspaces: Workspace[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch { /* ignore quota */ }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function deriveTitle(messages: AgentMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "新对话";
  const { content } = first as UserMessage;
  const text =
    typeof content === "string"
      ? content
      : content
          .filter((c): c is TextContent => c.type === "text")
          .map((c) => c.text)
          .join("");
  return text.slice(0, 30) || "新对话";
}

function deriveLabel(path: string): string {
  if (!path) return "默认工作区";
  const trimmed = path.replace(/[/\\]$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
}

// --- Store ---

interface AgentStore {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Messages (current conversation)
  messages: AgentMessage[];
  addMessage: (msg: AgentMessage) => void;
  updateStreamingMessage: (msg: AgentMessage) => void;
  clearStreamingMessage: () => void;

  // Streaming state
  streamingMessage: AgentMessage | null;
  isStreaming: boolean;
  pendingToolCalls: Set<string>;
  addPendingToolCall: (id: string) => void;
  removePendingToolCall: (id: string) => void;

  // Session
  sessionId: string;
  setSessionId: (id: string) => void;
  model: { provider: string; id: string; name: string } | null;
  setModel: (m: AgentStore["model"]) => void;
  thinkingLevel: string;
  setThinkingLevel: (l: string) => void;

  // Available models
  availableModels: Array<{
    provider: string; id: string; contextWindow: number; reasoning: boolean;
  }>;
  setAvailableModels: (models: AgentStore["availableModels"]) => void;

  // Workspaces
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentConversationId: string | null;

  addWorkspace: (path: string) => string;
  removeWorkspace: (id: string) => void;
  switchWorkspace: (id: string) => void;

  createConversation: () => string;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  saveCurrentConversation: () => void;

  // Persist all workspaces
  persist: () => void;
}

// --- Initial state helpers ---

function loadInitialState(): {
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  currentConversationId: string | null;
  messages: AgentMessage[];
} {
  const workspaces = loadWorkspaces();
  if (workspaces.length === 0) {
    return {
      workspaces: [],
      currentWorkspaceId: null,
      currentConversationId: null,
      messages: [],
    };
  }
  // Use first workspace (sorted by createdAt)
  const sorted = [...workspaces].sort((a, b) => a.createdAt - b.createdAt);
  const ws = sorted[0];
  const conversations = [...ws.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  if (conversations.length === 0) {
    return {
      workspaces,
      currentWorkspaceId: ws.id,
      currentConversationId: null,
      messages: [],
    };
  }
  return {
    workspaces,
    currentWorkspaceId: ws.id,
    currentConversationId: conversations[0].id,
    messages: conversations[0].messages,
  };
}

const init = loadInitialState();

const initialState = {
  connected: false,
  messages: init.messages,
  streamingMessage: null as AgentMessage | null,
  isStreaming: false,
  pendingToolCalls: new Set<string>(),
  sessionId: "",
  model: null as { provider: string; id: string; name: string } | null,
  thinkingLevel: "off",
  availableModels: [] as Array<{
    provider: string; id: string; contextWindow: number; reasoning: boolean;
  }>,
  workspaces: init.workspaces,
  currentWorkspaceId: init.currentWorkspaceId,
  currentConversationId: init.currentConversationId,
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  updateStreamingMessage: (msg) => set({ streamingMessage: msg }),

  clearStreamingMessage: () => set({ streamingMessage: null }),

  addPendingToolCall: (id) =>
    set((s) => {
      const next = new Set(s.pendingToolCalls);
      next.add(id);
      return { pendingToolCalls: next, isStreaming: true };
    }),

  removePendingToolCall: (id) =>
    set((s) => {
      const next = new Set(s.pendingToolCalls);
      next.delete(id);
      return { pendingToolCalls: next, isStreaming: next.size > 0 };
    }),

  setSessionId: (sessionId) => set({ sessionId }),
  setModel: (model) => set({ model }),
  setThinkingLevel: (thinkingLevel) => set({ thinkingLevel }),
  setAvailableModels: (availableModels) => set({ availableModels }),

  // --- Workspace actions ---

  addWorkspace: (path: string) => {
    // Check for duplicate path
    const existing = get().workspaces.find((w) => w.path === path);
    if (existing) return existing.id;

    const id = generateId();
    const ws: Workspace = {
      id,
      path,
      label: deriveLabel(path),
      conversations: [],
      createdAt: Date.now(),
    };
    set((s) => {
      const workspaces = [...s.workspaces, ws];
      saveWorkspaces(workspaces);
      return { workspaces, currentWorkspaceId: id, messages: [], currentConversationId: null };
    });
    return id;
  },

  removeWorkspace: (id: string) => {
    set((s) => {
      const workspaces = s.workspaces.filter((w) => w.id !== id);
      saveWorkspaces(workspaces);
      const update: Partial<AgentStore> = { workspaces };
      if (s.currentWorkspaceId === id) {
        const next = workspaces[0] ?? null;
        update.currentWorkspaceId = next?.id ?? null;
        update.messages = [];
        update.currentConversationId = null;
      }
      return update;
    });
  },

  switchWorkspace: (id: string) => {
    const s = get();
    if (s.currentWorkspaceId === id) return;

    // Save current conversation before switching
    s.saveCurrentConversation();

    const ws = s.workspaces.find((w) => w.id === id);
    if (!ws) return;

    const conversations = [...ws.conversations].sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    set({
      currentWorkspaceId: id,
      currentConversationId: conversations[0]?.id ?? null,
      messages: conversations[0]?.messages ?? [],
      streamingMessage: null,
    });
  },

  // --- Conversation actions ---

  createConversation: () => {
    const s = get();
    const wsId = s.currentWorkspaceId;
    if (!wsId) return "";

    const id = generateId();
    const now = Date.now();
    const conv: ConversationData = {
      id,
      title: "新对话",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    set((s) => {
      const workspaces = s.workspaces.map((w) =>
        w.id === wsId
          ? { ...w, conversations: [conv, ...w.conversations] }
          : w,
      );
      saveWorkspaces(workspaces);
      return {
        workspaces,
        currentConversationId: id,
        messages: [],
        streamingMessage: null,
      };
    });
    return id;
  },

  switchConversation: (id: string) => {
    const s = get();
    if (!s.currentWorkspaceId) return;

    // Save current conversation
    s.saveCurrentConversation();

    const ws = s.workspaces.find((w) => w.id === s.currentWorkspaceId);
    const conv = ws?.conversations.find((c) => c.id === id);
    if (conv) {
      set({ currentConversationId: id, messages: conv.messages, streamingMessage: null });
    }
  },

  deleteConversation: (id: string) => {
    const s = get();
    if (!s.currentWorkspaceId) return;

    set((s) => {
      const workspaces = s.workspaces.map((w) =>
        w.id === s.currentWorkspaceId
          ? { ...w, conversations: w.conversations.filter((c) => c.id !== id) }
          : w,
      );
      saveWorkspaces(workspaces);
      const update: Partial<AgentStore> = { workspaces };
      if (s.currentConversationId === id) {
        const remaining = workspaces
          .find((w) => w.id === s.currentWorkspaceId)
          ?.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
        update.currentConversationId = remaining?.[0]?.id ?? null;
        update.messages = remaining?.[0]?.messages ?? [];
        update.streamingMessage = null;
      }
      return update;
    });
  },

  saveCurrentConversation: () => {
    const s = get();
    if (!s.currentWorkspaceId || !s.currentConversationId) return;
    if (s.messages.length === 0 && !s.streamingMessage) return;

    const messagesToSave = s.streamingMessage
      ? [...s.messages, s.streamingMessage]
      : s.messages;
    if (messagesToSave.length === 0) return;

    set((s) => {
      const workspaces = s.workspaces.map((w) =>
        w.id === s.currentWorkspaceId
          ? {
              ...w,
              conversations: w.conversations.map((c) =>
                c.id === s.currentConversationId
                  ? {
                      ...c,
                      messages: messagesToSave,
                      title: deriveTitle(messagesToSave),
                      updatedAt: Date.now(),
                    }
                  : c,
              ),
            }
          : w,
      );
      saveWorkspaces(workspaces);
      return { workspaces };
    });
  },

}));

// --- Event processing ---

export function applyEvent(
  event: AgentHarnessEvent,
  store: ReturnType<typeof useAgentStore.getState>,
): void {
  switch (event.type) {
    case "message_start":
      if (event.message.role === "assistant") {
        store.updateStreamingMessage(event.message);
      }
      break;

    case "message_update":
      store.updateStreamingMessage(event.message);
      break;

    case "message_end":
      if (event.message.role !== "user") {
        store.addMessage(event.message);
      }
      store.clearStreamingMessage();
      store.saveCurrentConversation();
      break;

    case "tool_execution_start":
      store.addPendingToolCall(event.toolCallId);
      break;

    case "tool_execution_end":
      store.removePendingToolCall(event.toolCallId);
      break;

    case "agent_end":
      store.clearStreamingMessage();
      break;

    case "model_select":
      store.setModel({
        provider: event.model.provider,
        id: event.model.id,
        name: event.model.name,
      });
      break;

    case "thinking_level_select":
      store.setThinkingLevel(event.level);
      break;

    case "before_provider_request":
      if (event.sessionId) store.setSessionId(event.sessionId);
      break;
  }
}
