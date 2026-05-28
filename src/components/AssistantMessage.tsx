import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentMessage } from "@/types";
import type { AssistantMessage as AssistantMessageType } from "@earendil-works/pi-ai";

const MAX_RENDER_TEXT_LENGTH = 30000;

interface AssistantMessageProps {
  message: AgentMessage;
  isStreaming: boolean;
}

export default function AssistantMessage({
  message,
  isStreaming,
}: AssistantMessageProps) {
  if (message.role !== "assistant") return null;
  const msg = message as AssistantMessageType;

  const hasContent = msg.content.some(
    (c) =>
      (c.type === "text" && c.text?.trim()) ||
      (c.type === "thinking" && c.thinking?.trim()),
  );

  if (!hasContent) return null;

  return (
    <div
      className={`mb-2 ${isStreaming ? "border-l-2 border-blue-500 pl-3 animate-pulse" : ""}`}
    >
      {msg.content.map((content, i) => {
        if (content.type === "text" && content.text?.trim()) {
          const text = content.text;
          const truncated =
            text.length > MAX_RENDER_TEXT_LENGTH
              ? text.slice(0, MAX_RENDER_TEXT_LENGTH) + "\n\n...（内容过长，已截断）"
              : text;
          return (
            <div key={i} className="prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {truncated}
              </ReactMarkdown>
            </div>
          );
        }

        if (content.type === "thinking" && content.thinking?.trim()) {
          return (
            <details key={i} className="mb-2">
              <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 italic">
                思考中...
              </summary>
              <div className="mt-1 pl-3 border-l border-zinc-200 text-xs text-zinc-400 italic whitespace-pre-wrap">
                {content.thinking.trim()}
              </div>
            </details>
          );
        }

        return null;
      })}

      {msg.stopReason === "aborted" && (
        <p className="text-xs text-amber-600 mt-1">
          {msg.errorMessage && msg.errorMessage !== "Request was aborted"
            ? msg.errorMessage
            : "操作已中止"}
        </p>
      )}
      {msg.stopReason === "error" && (
        <p className="text-xs text-red-500 mt-1">
          错误：{msg.errorMessage || "未知错误"}
        </p>
      )}
    </div>
  );
}
