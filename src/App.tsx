import { useState, useCallback } from "react";
import ChatView from "@/components/ChatView";
import Sidebar from "@/components/Sidebar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useAgent } from "@/hooks/useAgent";
import { useAgentStore } from "@/store/agent-store";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const {
    client,
    connected,
    messages,
    streamingMessage,
    isStreaming,
    cwd,
    switchToWorkspace,
    sendMessage,
    steer,
    abort,
  } = useAgent({ autoConnect: true });

  const currentConversationId = useAgentStore((s) => s.currentConversationId);
  const currentWorkspaceId = useAgentStore((s) => s.currentWorkspaceId);
  const createConversation = useAgentStore((s) => s.createConversation);

  const handleSend = useCallback(
    (text: string) => {
      if (!currentConversationId) {
        createConversation();
      }
      sendMessage(text);
    },
    [currentConversationId, createConversation, sendMessage],
  );

  return (
    <ErrorBoundary
      fallback={
        <div className="h-screen flex items-center justify-center bg-white">
          <div className="text-center p-8">
            <p className="text-lg font-semibold text-zinc-800">页面出错了</p>
            <p className="text-sm text-zinc-500 mt-2">请刷新页面重试</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
          </div>
        </div>
      }
    >
      <div className="h-screen flex bg-white text-zinc-900">
        {sidebarOpen && (
          <Sidebar
            connected={connected}
            onClose={() => setSidebarOpen(false)}
            client={client}
            cwd={cwd}
            onSwitchWorkspace={switchToWorkspace}
          />
        )}
        <ChatView
          messages={messages}
          streamingMessage={streamingMessage}
          isStreaming={isStreaming}
          connected={connected}
          client={client}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSend={handleSend}
          onSteer={steer}
          onAbort={abort}
        />
      </div>
    </ErrorBoundary>
  );
}
