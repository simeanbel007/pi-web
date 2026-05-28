import type { AgentMessage } from "@/types";
import type { UserMessage as UserMessageType } from "@earendil-works/pi-ai";

interface UserMessageProps {
  message: AgentMessage;
}

export default function UserMessage({ message }: UserMessageProps) {
  if (message.role !== "user") return null;
  const { content } = message as UserMessageType;
  const text = typeof content === "string"
    ? content
    : content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");

  return (
    <div className="flex justify-end mb-2">
      <div className="max-w-[80%] bg-zinc-100 rounded-2xl px-4 py-2.5 text-sm text-zinc-900 whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  );
}
