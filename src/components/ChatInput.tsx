import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import { useAgentStore } from "@/store/agent-store";
import ModelSelector from "./ModelSelector";
import type { AgentClient } from "@/lib/agent-client";

interface ChatInputProps {
  isStreaming: boolean;
  connected: boolean;
  client: AgentClient | null;
  onSend: (text: string) => void;
  onSteer: (text: string) => void;
  onAbort: () => void;
}

const THINKING_LEVELS = [
  { value: "off", label: "关" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

export default function ChatInput({
  isStreaming,
  connected,
  client,
  onSend,
  onSteer,
  onAbort,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const thinkingLevel = useAgentStore((s) => s.thinkingLevel);
  const setThinkingLevel = useAgentStore((s) => s.setThinkingLevel);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [input]);

  // Close thinking dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (thinkingRef.current && !thinkingRef.current.contains(event.target as Node)) {
        setThinkingOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (isStreaming) {
      onSteer(trimmed);
    } else {
      onSend(trimmed);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (
      isStreaming &&
      ((e.key === "Escape") || (e.key === "c" && (e.ctrlKey || e.metaKey)))
    ) {
      e.preventDefault();
      onAbort();
    }
  };

  const handleThinkingSelect = async (level: string) => {
    setThinkingLevel(level);
    setThinkingOpen(false);
    if (client?.connected) {
      try {
        await client.setThinkingLevel(level);
      } catch {
        // ignore - backend may not support yet
      }
    }
  };

  const currentLevel = THINKING_LEVELS.find((l) => l.value === thinkingLevel) || THINKING_LEVELS[1];
  const canSend = connected && input.trim().length > 0;

  return (
    <div className="px-4 pb-4 pt-2 bg-white shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border border-zinc-300 rounded-3xl shadow-sm focus-within:border-zinc-400 focus-within:shadow-md transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "引导助手... (Enter) 或 Esc/Ctrl+C 中止"
                : "发送消息..."
            }
            rows={1}
            className="w-full bg-transparent px-5 pt-4 pb-2 text-sm text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none min-h-[64px] max-h-[240px] rounded-3xl"
            disabled={!connected}
          />
          <div className="flex items-center gap-1 px-3 pb-3">
            {/* Thinking depth selector */}
            <div className="relative" ref={thinkingRef}>
              <button
                onClick={() => setThinkingOpen(!thinkingOpen)}
                disabled={!connected}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="思考深度"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                  <path d="M9 21h6"/>
                  <path d="M10 21v1"/>
                  <path d="M14 21v1"/>
                </svg>
                <span>{currentLevel.label}</span>
              </button>
              {thinkingOpen && (
                <div className="absolute z-50 bottom-full mb-1 left-0 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[80px]">
                  {THINKING_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => handleThinkingSelect(level.value)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors ${
                        thinkingLevel === level.value
                          ? "text-blue-600 bg-blue-50"
                          : "text-zinc-700"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model selector */}
            <ModelSelector client={client} />

            <div className="flex-1" />

            {/* Send / Stop button */}
            {isStreaming ? (
              <button
                onClick={onAbort}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                title="停止"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="2" y="2" width="10" height="10" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white transition-colors disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed"
                title="发送"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/>
                  <path d="M12 5l7 7-7 7"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 mt-2 text-center">
          Enter 发送 · Shift+Enter 换行 · Esc 中止
        </p>
      </div>
    </div>
  );
}
