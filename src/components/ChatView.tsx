import { useEffect, useRef } from "react";
import type { AgentMessage } from "@/types";
import { useAgentStore } from "@/store/agent-store";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import type { AgentClient } from "@/lib/agent-client";

interface ChatViewProps {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | null;
  isStreaming: boolean;
  connected: boolean;
  client: AgentClient | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSend: (text: string) => void;
  onSteer: (text: string) => void;
  onAbort: () => void;
}

export default function ChatView({
  messages,
  streamingMessage,
  isStreaming,
  connected,
  client,
  sidebarOpen,
  onToggleSidebar,
  onSend,
  onSteer,
  onAbort,
}: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const workspaces = useAgentStore((s) => s.workspaces);
  const currentWorkspaceId = useAgentStore((s) => s.currentWorkspaceId);
  const currentConversationId = useAgentStore((s) => s.currentConversationId);

  const currentWs = workspaces.find((w) => w.id === currentWorkspaceId);
  const currentTitle = currentConversationId
    ? currentWs?.conversations.find((c) => c.id === currentConversationId)?.title || "Pi"
    : "Pi";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingMessage]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Top bar */}
      <header className="h-12 border-b border-zinc-200 flex items-center px-4 shrink-0 bg-white">
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            className="text-zinc-500 hover:text-zinc-800 mr-3 text-sm"
          >
            &#9776;
          </button>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-zinc-800 truncate block leading-tight">
            {currentTitle}
          </span>
          {currentWs?.path && (
            <span className="text-[10px] text-zinc-400 truncate block leading-tight">
              {currentWs.path}
            </span>
          )}
        </div>
        <span
          className={`ml-auto w-2 h-2 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-red-500"}`}
          title={connected ? "已连接" : "未连接"}
        />
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-white">
        <MessageList
          messages={messages}
          streamingMessage={streamingMessage}
        />
      </div>

      {/* Input */}
      <ChatInput
        isStreaming={isStreaming}
        connected={connected}
        client={client}
        onSend={onSend}
        onSteer={onSteer}
        onAbort={onAbort}
      />
    </div>
  );
}
