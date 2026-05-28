import { useState } from "react";

const MAX_RESULT_DISPLAY = 2000;

interface ToolExecutionProps {
  toolCall: {
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
  };
  toolResults: Array<{
    type: "toolResult";
    toolCallId: string;
    result: string;
  }>;
}

export default function ToolExecution({
  toolCall,
  toolResults,
}: ToolExecutionProps) {
  const [expanded, setExpanded] = useState(false);
  const resultText = toolResults
    .map((r) => r.result)
    .filter(Boolean)
    .join("\n");

  const needsTruncation = resultText.length > MAX_RESULT_DISPLAY;
  const displayText = expanded
    ? resultText
    : needsTruncation
      ? resultText.slice(0, MAX_RESULT_DISPLAY)
      : resultText;

  return (
    <div className="mb-2 border border-zinc-200 rounded-lg overflow-hidden">
      <div className="bg-zinc-50 px-3 py-1.5 flex items-center gap-2">
        <span className="text-xs text-blue-600 font-mono font-semibold">
          {toolCall.toolName}
        </span>
        <span className="text-xs text-zinc-400 truncate flex-1">
          {JSON.stringify(toolCall.toolInput).slice(0, 80)}
        </span>
      </div>
      {resultText && (
        <div className="px-3 py-2 bg-white text-xs text-zinc-500 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border-t border-zinc-100">
          {displayText}
          {needsTruncation && !expanded && (
            <button
              className="text-blue-500 hover:text-blue-700 ml-1"
              onClick={() => setExpanded(true)}
            >
              展开全部
            </button>
          )}
          {needsTruncation && expanded && (
            <button
              className="text-blue-500 hover:text-blue-700 ml-1"
              onClick={() => setExpanded(false)}
            >
              收起
            </button>
          )}
        </div>
      )}
    </div>
  );
}
