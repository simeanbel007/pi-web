import { useState, useEffect, useRef } from "react";
import { useAgentStore } from "@/store/agent-store";
import type { AgentClient } from "@/lib/agent-client";

interface ModelSelectorProps {
  client: AgentClient | null;
}

export default function ModelSelector({ client }: ModelSelectorProps) {
  const connected = useAgentStore((s) => s.connected);
  const { model, availableModels, setAvailableModels, setModel } = useAgentStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load available models when connection is established
  useEffect(() => {
    if (!client || !connected) return;

    const loadModels = async () => {
      try {
        setLoadingModels(true);
        const models = await client.getAvailableModels();
        setAvailableModels(models);
      } catch (err) {
        console.error("Failed to load models:", err);
      } finally {
        setLoadingModels(false);
      }
    };

    loadModels();
  }, [client, connected, setAvailableModels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleModelSelect = async (provider: string, modelId: string) => {
    if (!client) return;

    try {
      setSwitching(true);
      await client.setModel(provider, modelId);
      // Optimistic update — event handler will also update, but this is instant
      setModel({
        provider,
        id: modelId,
        name: modelId,
      });
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to set model:", err);
    } finally {
      setSwitching(false);
    }
  };

  // Group models by provider
  const modelsByProvider = availableModels.reduce(
    (acc, m) => {
      if (!acc[m.provider]) {
        acc[m.provider] = [];
      }
      acc[m.provider].push(m);
      return acc;
    },
    {} as Record<string, typeof availableModels>,
  );

  const sortedProviders = Object.keys(modelsByProvider).sort();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loadingModels || switching || !connected}
        className="flex items-center gap-1 px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="选择模型"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
          <circle cx="12" cy="15" r="2" />
        </svg>
        <span className="max-w-[100px] truncate">
          {model ? model.name : "模型"}
        </span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 right-0 bottom-full mb-1 bg-white border border-zinc-200 rounded-lg shadow-lg max-h-64 overflow-y-auto min-w-[200px]">
          {loadingModels ? (
            <div className="px-3 py-2 text-xs text-zinc-400">加载中...</div>
          ) : sortedProviders.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-400">无可用模型</div>
          ) : (
            sortedProviders.map((provider) => (
              <div key={provider}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase bg-zinc-50 sticky top-0">
                  {provider}
                </div>
                {modelsByProvider[provider].map((m) => (
                  <button
                    key={`${m.provider}/${m.id}`}
                    onClick={() => handleModelSelect(m.provider, m.id)}
                    disabled={switching}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors flex items-center justify-between disabled:opacity-50 ${
                      model?.provider === m.provider && model?.id === m.id
                        ? "bg-blue-50 text-blue-600"
                        : "text-zinc-700"
                    }`}
                  >
                    <span className="truncate">{m.id}</span>
                    {m.reasoning && (
                      <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded shrink-0 ml-2">
                        推理
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
