import { useMemo } from "react";
import type { AgentMessage } from "@/types";
import type { ToolResultMessage } from "@earendil-works/pi-ai";
import AssistantMessage from "./AssistantMessage";
import UserMessage from "./UserMessage";
import ToolExecution from "./ToolExecution";
import ErrorBoundary from "./ErrorBoundary";

interface DisplayMessage {
  message: AgentMessage;
  isStreaming: boolean;
}

interface MessageListProps {
  messages: AgentMessage[];
  streamingMessage: AgentMessage | null;
}

export default function MessageList({
  messages,
  streamingMessage,
}: MessageListProps) {
  const displayMessages: DisplayMessage[] = useMemo(() => {
    const all: DisplayMessage[] = messages.map((m) => ({ message: m, isStreaming: false }));
    if (streamingMessage) {
      all.push({ message: streamingMessage, isStreaming: true });
    }
    return all;
  }, [messages, streamingMessage]);

  // Build a map of toolCallId -> ToolResultMessage for matching
  const toolResultMap = useMemo(() => {
    const map = new Map<string, ToolResultMessage>();
    for (const m of messages) {
      if (m.role === "toolResult") {
        map.set(m.toolCallId, m);
      }
    }
    return map;
  }, [messages]);

  if (displayMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-300 text-sm">
        <p>发送消息开始对话</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
      {displayMessages.map(({ message: msg, isStreaming }, i) => {
        const key = `${msg.role}-${i}`;

        switch (msg.role) {
          case "user":
            return (
              <ErrorBoundary key={key}>
                <UserMessage message={msg} />
              </ErrorBoundary>
            );
          case "assistant": {
            const toolCalls = msg.content.filter((c) => c.type === "toolCall");
            return (
              <ErrorBoundary key={key}>
                <div>
                  <AssistantMessage message={msg} isStreaming={isStreaming} />
                  {toolCalls.map((tc, j) => {
                    const toolResult = toolResultMap.get(tc.id);
                    return (
                      <ToolExecution
                        key={`${key}-tool-${j}`}
                        toolCall={{
                          toolCallId: tc.id,
                          toolName: tc.name,
                          toolInput: tc.arguments,
                        }}
                        toolResults={
                          toolResult
                            ? [{ type: "toolResult", toolCallId: toolResult.toolCallId, result: formatToolResult(toolResult) }]
                            : []
                        }
                      />
                    );
                  })}
                </div>
              </ErrorBoundary>
            );
          }
          case "toolResult":
            // Already rendered inline with the parent assistant message
            return null;
          default:
            return null;
        }
      })}
    </div>
  );
}

function formatToolResult(toolResult: ToolResultMessage): string {
  if (Array.isArray(toolResult.content)) {
    return toolResult.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return String(toolResult.content || "");
}
