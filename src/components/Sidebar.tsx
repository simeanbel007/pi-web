import React, { useState } from "react";
import { useAgentStore } from "@/store/agent-store";
import ModelConfig from "./ModelConfig";
import type { AgentClient } from "@/lib/agent-client";

interface SidebarProps {
  connected: boolean;
  onClose: () => void;
  client: AgentClient | null;
  cwd: string;
  onSwitchWorkspace: (path: string) => Promise<void>;
}

export default function Sidebar({
  connected,
  onClose,
  client,
  cwd,
  onSwitchWorkspace,
}: SidebarProps) {
  const {
    model, sessionId, messages,
    workspaces, currentWorkspaceId, currentConversationId,
    addWorkspace, removeWorkspace, switchWorkspace,
    createConversation, switchConversation, deleteConversation,
  } = useAgentStore();
  const [showConfig, setShowConfig] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspacePath, setNewWorkspacePath] = useState("");
  const [adding, setAdding] = useState(false);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday)
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  };

  const handleAddWorkspace = async () => {
    const path = newWorkspacePath.trim();
    if (!path || adding) return;
    setAdding(true);
    try {
      // Tell server to switch/create instance for this cwd
      await onSwitchWorkspace(path);
      // Create workspace in store
      addWorkspace(path);
      setNewWorkspacePath("");
      setShowAddWorkspace(false);
    } catch (err) {
      console.error("Failed to add workspace:", err);
    } finally {
      setAdding(false);
    }
  };

  const handleSwitchWorkspace = async (wsId: string) => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws || ws.id === currentWorkspaceId) return;
    try {
      await onSwitchWorkspace(ws.path);
      switchWorkspace(wsId);
    } catch (err) {
      console.error("Failed to switch workspace:", err);
    }
  };

  const handleRemoveWorkspace = (wsId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeWorkspace(wsId);
  };

  const currentWs = workspaces.find((w) => w.id === currentWorkspaceId);

  return (
    <>
      <div className="w-64 h-full bg-zinc-50 border-r border-zinc-200 flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-wide text-zinc-800">
            Pi 助手
          </span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-lg leading-none"
          >
            x
          </button>
        </div>

        {/* Actions */}
        <div className="px-3 py-2 border-b border-zinc-200 space-y-1.5">
          <button
            onClick={() => setShowAddWorkspace(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            <span>新工作区</span>
          </button>
          {currentWorkspaceId && (
            <button
              onClick={() => createConversation()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              <span className="text-sm leading-none">+</span>
              <span>新对话</span>
            </button>
          )}
        </div>

        {/* Workspace tree */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {workspaces.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-zinc-400">
              暂无工作区，点击上方添加
            </div>
          ) : (
            <div className="py-1">
              {workspaces.map((ws) => {
                const isActive = ws.id === currentWorkspaceId;
                const sortedConvs = [...ws.conversations].sort(
                  (a, b) => b.updatedAt - a.updatedAt,
                );

                return (
                  <div key={ws.id}>
                    {/* Workspace row */}
                    <div
                      className={`group flex items-center px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors ${
                        isActive
                          ? "text-zinc-900 font-semibold"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800"
                      }`}
                      onClick={() => handleSwitchWorkspace(ws.id)}
                    >
                      <span className="mr-1.5 text-sm">&#128193;</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{ws.label}</div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {ws.path || "(未设置路径)"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleRemoveWorkspace(ws.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs ml-1 transition-opacity shrink-0"
                        title="删除工作区"
                      >
                        &#128465;
                      </button>
                    </div>

                    {/* Conversations under this workspace */}
                    {sortedConvs.length > 0 && (
                      <div className="ml-5">
                        {sortedConvs.map((conv) => {
                          const isConvActive =
                            conv.id === currentConversationId && isActive;
                          return (
                            <div key={conv.id} className="flex items-center">
                              <span
                                className={`shrink-0 text-[8px] mr-1.5 select-none ${
                                  isConvActive
                                    ? "text-zinc-700"
                                    : "text-zinc-300"
                                }`}
                              >
                                {"●"}
                              </span>
                              <div
                                className={`group flex-1 flex items-center px-2 py-1 mr-1 rounded-lg cursor-pointer transition-colors ${
                                  isConvActive
                                    ? "text-zinc-900 font-medium"
                                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isActive) {
                                    handleSwitchWorkspace(ws.id).then(() => {
                                      switchConversation(conv.id);
                                    });
                                  } else {
                                    switchConversation(conv.id);
                                  }
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm truncate">{conv.title}</div>
                                  <div className="text-[10px] text-zinc-400">
                                    {formatTime(conv.updatedAt)} ·{" "}
                                    {conv.messages.length} 条消息
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteConversation(conv.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 text-xs ml-1 transition-opacity"
                                  title="删除对话"
                                >
                                  &#10005;
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {sortedConvs.length === 0 && (
                      <div className="ml-5 pl-4 py-1 text-[10px] text-zinc-400">
                        暂无对话
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status footer */}
        <div className="px-4 py-3 border-t border-zinc-200 space-y-2 text-xs">
          <StatusRow
            label="连接状态"
            value={connected ? "已连接" : "未连接"}
            ok={connected}
          />
          <StatusRow
            label="工作目录"
            value={cwd ? cwd.split(/[/\\]/).pop() || cwd : "—"}
          />
          <div className="flex items-center justify-between">
            <span className="text-zinc-500 text-xs">
              模型:{" "}
              <span className="text-zinc-700">{model ? model.name : "未选择"}</span>
            </span>
            <button
              onClick={() => setShowConfig(true)}
              className="text-zinc-400 hover:text-zinc-600 text-xs"
              title="配置模型"
            >
              &#9881;
            </button>
          </div>
          <StatusRow label="消息数" value={String(messages.length)} />
          {sessionId && (
            <StatusRow label="会话" value={sessionId.slice(0, 8) + "..."} />
          )}
        </div>
      </div>

      {/* Add workspace modal */}
      {showAddWorkspace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-zinc-200 w-96 p-6">
            <h3 className="text-sm font-semibold text-zinc-800 mb-4">添加工作区</h3>
            <label className="block text-xs text-zinc-500 mb-1">
              工作目录路径
            </label>
            <input
              type="text"
              value={newWorkspacePath}
              onChange={(e) => setNewWorkspacePath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddWorkspace()}
              placeholder="例如: /home/user/my-project"
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:border-zinc-400 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAddWorkspace(false)}
                className="px-4 py-2 text-xs text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddWorkspace}
                disabled={!newWorkspacePath.trim() || adding}
                className="px-4 py-2 text-xs bg-zinc-900 text-white hover:bg-zinc-700 rounded-lg transition-colors disabled:bg-zinc-200 disabled:text-zinc-400"
              >
                {adding ? "添加中..." : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Model Config Modal */}
      {showConfig && (
        <ModelConfig
          onClose={() => setShowConfig(false)}
          onSaved={() => {
            if (client?.connected) {
              client.refreshModels().then((models) => {
                useAgentStore.getState().setAvailableModels(models);
              });
            }
          }}
        />
      )}
    </>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-500">{label}</span>
      <span
        className={
          ok === undefined
            ? "text-zinc-700"
            : ok
              ? "text-green-600"
              : "text-red-500"
        }
      >
        {value}
      </span>
    </div>
  );
}
