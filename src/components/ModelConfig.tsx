import { useState, useEffect } from "react";

interface ProviderConfig {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  headers?: Record<string, string>;
  models?: Array<{
    id: string;
    name?: string;
    api?: string;
    baseUrl?: string;
    reasoning?: boolean;
    contextWindow?: number;
    maxTokens?: number;
    input?: string[];
  }>;
}

interface ModelsConfig {
  providers: Record<string, ProviderConfig>;
}

interface ModelConfigProps {
  onClose: () => void;
  onSaved?: () => void;
}

export default function ModelConfig({ onClose, onSaved }: ModelConfigProps) {
  const [config, setConfig] = useState<ModelsConfig>({ providers: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configPath, setConfigPath] = useState<string>("");
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [newProviderName, setNewProviderName] = useState("");

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load config path
      const pathRes = await fetch("/api/models-config/path");
      const pathData = await pathRes.json();
      setConfigPath(pathData.path);

      // Load config
      const res = await fetch("/api/models-config");
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载配置失败");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);

      const res = await fetch("/api/models-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存失败");
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存配置失败");
    } finally {
      setSaving(false);
    }
  };

  const addProvider = () => {
    if (!newProviderName.trim()) return;

    setConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [newProviderName.trim()]: {
          baseUrl: "",
          apiKey: "",
          api: "openai-completions",
          models: [],
        },
      },
    }));

    setEditingProvider(newProviderName.trim());
    setNewProviderName("");
  };

  const removeProvider = (providerName: string) => {
    if (!confirm(`确定删除提供商 "${providerName}" 吗？`)) return;

    setConfig((prev) => {
      const newProviders = { ...prev.providers };
      delete newProviders[providerName];
      return { ...prev, providers: newProviders };
    });

    if (editingProvider === providerName) {
      setEditingProvider(null);
    }
  };

  const updateProvider = (providerName: string, updates: Partial<ProviderConfig>) => {
    setConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerName]: {
          ...prev.providers[providerName],
          ...updates,
        },
      },
    }));
  };

  const addModel = (providerName: string) => {
    const provider = config.providers[providerName];
    if (!provider) return;

    const newModel = {
      id: "",
      name: "",
      reasoning: false,
      contextWindow: 128000,
      maxTokens: 4096,
      input: ["text"],
    };

    updateProvider(providerName, {
      models: [...(provider.models || []), newModel],
    });
  };

  const updateModel = (providerName: string, modelIndex: number, updates: any) => {
    const provider = config.providers[providerName];
    if (!provider || !provider.models) return;

    const newModels = [...provider.models];
    newModels[modelIndex] = { ...newModels[modelIndex], ...updates };

    updateProvider(providerName, { models: newModels });
  };

  const removeModel = (providerName: string, modelIndex: number) => {
    const provider = config.providers[providerName];
    if (!provider || !provider.models) return;

    const newModels = provider.models.filter((_, i) => i !== modelIndex);
    updateProvider(providerName, { models: newModels });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
          <div className="text-center py-8 text-zinc-400">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">模型配置</h2>
            <p className="text-xs text-zinc-400 mt-1">{configPath}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-xl"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex gap-4 min-h-0">
          {/* Provider List */}
          <div className="w-64 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-zinc-400">提供商</h3>
            </div>

            <div className="space-y-1 mb-3">
              {Object.keys(config.providers).map((providerName) => (
                <div
                  key={providerName}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer ${
                    editingProvider === providerName
                      ? "bg-blue-50 text-blue-600"
                      : "hover:bg-zinc-100 text-zinc-700"
                  }`}
                  onClick={() => setEditingProvider(providerName)}
                >
                  <span className="text-sm truncate">{providerName}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeProvider(providerName);
                    }}
                    className="text-zinc-400 hover:text-red-500 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-1">
              <input
                type="text"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                placeholder="新提供商名称"
                className="flex-1 bg-white border border-zinc-200 rounded px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400"
                onKeyDown={(e) => e.key === "Enter" && addProvider()}
              />
              <button
                onClick={addProvider}
                disabled={!newProviderName.trim()}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          {/* Provider Editor */}
          <div className="flex-1 overflow-y-auto">
            {editingProvider && config.providers[editingProvider] ? (
              <ProviderEditor
                name={editingProvider}
                config={config.providers[editingProvider]}
                onUpdate={(updates) => updateProvider(editingProvider, updates)}
                onAddModel={() => addModel(editingProvider)}
                onUpdateModel={(index, updates) =>
                  updateModel(editingProvider, index, updates)
                }
                onRemoveModel={(index) => removeModel(editingProvider, index)}
              />
            ) : (
              <div className="text-center py-8 text-zinc-400">
                选择或创建一个提供商
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            取消
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Provider Editor Component
function ProviderEditor({
  name,
  config,
  onUpdate,
  onAddModel,
  onUpdateModel,
  onRemoveModel,
}: {
  name: string;
  config: ProviderConfig;
  onUpdate: (updates: Partial<ProviderConfig>) => void;
  onAddModel: () => void;
  onUpdateModel: (index: number, updates: any) => void;
  onRemoveModel: (index: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-700 mb-2">
          提供商配置: {name}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">API 类型</label>
            <select
              value={config.api || "openai-completions"}
              onChange={(e) => onUpdate({ api: e.target.value })}
              className="w-full bg-white border border-zinc-200 rounded px-2 py-1.5 text-sm text-zinc-900"
            >
              <option value="openai-completions">OpenAI Completions</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic-messages">Anthropic Messages</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-500 block mb-1">Base URL</label>
            <input
              type="text"
              value={config.baseUrl || ""}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="w-full bg-white border border-zinc-200 rounded px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-500 block mb-1">API Key</label>
            <input
              type="password"
              value={config.apiKey || ""}
              onChange={(e) => onUpdate({ apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-white border border-zinc-200 rounded px-2 py-1.5 text-sm text-zinc-900 placeholder-zinc-400"
            />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-zinc-700">模型列表</h4>
          <button
            onClick={onAddModel}
            className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
          >
            添加模型
          </button>
        </div>

        <div className="space-y-2">
          {(config.models || []).map((model, index) => (
            <ModelEditor
              key={index}
              model={model}
              onUpdate={(updates) => onUpdateModel(index, updates)}
              onRemove={() => onRemoveModel(index)}
            />
          ))}

          {(!config.models || config.models.length === 0) && (
            <p className="text-xs text-zinc-400 py-2">暂无模型，点击上方按钮添加</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Model Editor Component
function ModelEditor({
  model,
  onUpdate,
  onRemove,
}: {
  model: any;
  onUpdate: (updates: any) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">模型 ID</label>
            <input
              type="text"
              value={model.id || ""}
              onChange={(e) => onUpdate({ id: e.target.value })}
              placeholder="gpt-4o"
              className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">显示名称</label>
            <input
              type="text"
              value={model.name || ""}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="GPT-4o"
              className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400"
            />
          </div>
        </div>
        <button
          onClick={onRemove}
          className="ml-2 text-zinc-400 hover:text-red-500 text-sm"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-zinc-500 block mb-1">上下文窗口</label>
          <input
            type="number"
            value={model.contextWindow || 128000}
            onChange={(e) =>
              onUpdate({ contextWindow: parseInt(e.target.value) || 128000 })
            }
            className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm text-zinc-900"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 block mb-1">最大 Tokens</label>
          <input
            type="number"
            value={model.maxTokens || 4096}
            onChange={(e) =>
              onUpdate({ maxTokens: parseInt(e.target.value) || 4096 })
            }
            className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-sm text-zinc-900"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={model.reasoning || false}
              onChange={(e) => onUpdate({ reasoning: e.target.checked })}
              className="rounded"
            />
            <span className="text-xs text-zinc-400">推理模型</span>
          </label>
        </div>
      </div>
    </div>
  );
}
