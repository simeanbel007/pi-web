import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { WsServerMessage } from "@/types";

type EventListener = (event: AgentHarnessEvent) => void;
type StateListener = (connected: boolean) => void;

/**
 * Browser-side WebSocket client that mirrors the RpcClient API.
 * Connects to the pi-web server which manages the actual Pi agent process.
 */
export class AgentClient {
  private ws: WebSocket | null = null;
  private eventListeners = new Set<EventListener>();
  private stateListeners = new Set<StateListener>();
  private requestId = 0;
  private pendingRequests = new Map<
    string,
    { resolve: (data: unknown) => void; reject: (err: Error) => void }
  >();
  private _connected = false;
  private _cwd = "";
  private url: string;

  constructor(url?: string) {
    this.url = url ?? `ws://${location.host}/ws`;
  }

  get connected(): boolean {
    return this._connected;
  }

  get cwd(): string {
    return this._cwd;
  }

  private setConnected(value: boolean): void {
    this._connected = value;
    for (const l of this.stateListeners) l(value);
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  async connect(cwd?: string): Promise<void> {
    if (this.ws) return;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setConnected(true);
        this.send({ type: "init", cwd });
      };

      this.ws.onmessage = (ev) => {
        const msg: WsServerMessage = JSON.parse(ev.data);
        this.handleMessage(msg);
        if (msg.type === "init_ok") {
          this._cwd = msg.cwd;
          resolve();
        }
        if (msg.type === "init_error") reject(new Error(msg.error));
      };

      this.ws.onclose = () => {
        this.setConnected(false);
        this.ws = null;
      };

      this.ws.onerror = () => {
        reject(new Error("WebSocket connection failed"));
      };
    });
  }

  /** Switch the agent instance to a different working directory */
  async switchWorkspace(cwd: string): Promise<void> {
    this._cwd = cwd;
    return new Promise((resolve, reject) => {
      const handler = (ev: MessageEvent) => {
        const msg: WsServerMessage = JSON.parse(ev.data);
        if (msg.type === "switch_ok") {
          this.ws?.removeEventListener("message", handler);
          this._cwd = msg.cwd;
          resolve();
        }
        if (msg.type === "switch_error") {
          this.ws?.removeEventListener("message", handler);
          reject(new Error(msg.error));
        }
      };
      this.ws?.addEventListener("message", handler);
      this.send({ type: "switch_instance", cwd });
    });
  }

  private send(data: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[agent-client] not connected");
      return;
    }
    this.ws.send(JSON.stringify(data));
  }

  private async sendCmd(
    command: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const id = `cmd_${++this.requestId}`;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.send({ type: "command", id, command, ...params });
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout: ${command}`));
        }
      }, 30000);
    });
  }

  private handleMessage(msg: WsServerMessage): void {
    switch (msg.type) {
      case "agent_event":
        for (const l of this.eventListeners) l(msg.event);
        break;
      case "rpc_response": {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
          this.pendingRequests.delete(msg.id);
          pending.resolve(msg.data);
        }
        break;
      }
      case "error":
        if (msg.id) {
          const pending = this.pendingRequests.get(msg.id);
          if (pending) {
            this.pendingRequests.delete(msg.id);
            pending.reject(new Error(msg.error));
          }
        }
        break;
      // init_ok, init_error, switch_ok, switch_error handled in connect/switchWorkspace
    }
  }

  // --- Public API ---

  async prompt(
    message: string,
    images?: { type: "image"; data: string; mimeType: string }[],
  ): Promise<void> {
    await this.sendCmd("prompt", { message, images });
  }

  async steer(message: string): Promise<void> {
    await this.sendCmd("steer", { message });
  }

  async abort(): Promise<void> {
    await this.sendCmd("abort");
  }

  async getState(): Promise<unknown> {
    return this.sendCmd("get_state");
  }

  async setModel(
    provider: string,
    modelId: string,
  ): Promise<{ provider: string; id: string }> {
    return this.sendCmd("set_model", { provider, modelId }) as Promise<{
      provider: string;
      id: string;
    }>;
  }

  async getAvailableModels(): Promise<
    Array<{ provider: string; id: string; contextWindow: number; reasoning: boolean }>
  > {
    const result = (await this.sendCmd("get_available_models")) as {
      models: Array<{
        provider: string; id: string; contextWindow: number; reasoning: boolean;
      }>;
    };
    return result.models;
  }

  async refreshModels(): Promise<
    Array<{ provider: string; id: string; contextWindow: number; reasoning: boolean }>
  > {
    const result = (await this.sendCmd("refresh_models")) as {
      models: Array<{
        provider: string; id: string; contextWindow: number; reasoning: boolean;
      }>;
    };
    return result.models;
  }

  async setThinkingLevel(level: string): Promise<void> {
    await this.sendCmd("set_thinking_level", { level });
  }
}
