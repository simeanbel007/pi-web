import { RpcClient } from "@earendil-works/pi-coding-agent/modes/rpc/rpc-client";
import type { AgentEvent, ThinkingLevel } from "@earendil-works/pi-agent-core";

/**
 * Manages the lifecycle of a single Pi agent process.
 * Wraps RpcClient and bridges its events to a WebSocket.
 */
export class AgentInstance {
  public readonly id: string;
  private client: RpcClient;
  private ws: import("ws").WebSocket | null = null;
  private unsubEvent: (() => void) | null = null;
  private _cwd: string;

  constructor(id: string, cwd: string, cliPath: string) {
    this.id = id;
    this._cwd = cwd;
    this.client = new RpcClient({
      cliPath,
      cwd,
    });
  }

  get cwd(): string {
    return this._cwd;
  }

  async start(): Promise<void> {
    await this.client.start();
    this.unsubEvent = this.client.onEvent((event: AgentEvent) => {
      this.sendToWs({ type: "agent_event", event });
    });
  }

  bindWebSocket(ws: import("ws").WebSocket): void {
    this.ws = ws;
  }

  /** Forward a command from the browser to the RpcClient */
  async handleCommand(command: {
    id: string;
    type: string;
    message?: string;
    images?: { type: "image"; data: string; mimeType: string }[];
    provider?: string;
    modelId?: string;
    level?: string;
  }): Promise<void> {
    try {
      switch (command.type) {
        case "prompt":
          await this.client.prompt(command.message!, command.images);
          this.sendToWs({ type: "rpc_response", id: command.id, data: null });
          break;
        case "steer":
          await this.client.steer(command.message!, command.images);
          this.sendToWs({ type: "rpc_response", id: command.id, data: null });
          break;
        case "abort":
          await this.client.abort();
          this.sendToWs({ type: "rpc_response", id: command.id, data: null });
          break;
        case "get_state": {
          const state = await this.client.getState();
          this.sendToWs({ type: "rpc_response", id: command.id, data: state });
          break;
        }
        case "set_model": {
          const result = await this.client.setModel(command.provider as string, command.modelId as string);
          this.sendToWs({ type: "rpc_response", id: command.id, data: result });
          break;
        }
        case "get_available_models": {
          const models = await this.client.getAvailableModels();
          this.sendToWs({ type: "rpc_response", id: command.id, data: { models } });
          break;
        }
        case "refresh_models": {
          // This will trigger a reload of models.json
          const models = await this.client.refreshModels();
          this.sendToWs({ type: "rpc_response", id: command.id, data: { models } });
          break;
        }
        case "set_thinking_level": {
          await this.client.setThinkingLevel(command.level as ThinkingLevel);
          this.sendToWs({ type: "rpc_response", id: command.id, data: null });
          break;
        }
        default:
          this.sendToWs({
            type: "error",
            id: command.id,
            error: `Unknown command: ${command.type}`,
          });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.sendToWs({ type: "error", id: command.id, error: message });
    }
  }

  private sendToWs(data: unknown): void {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  async dispose(): Promise<void> {
    this.unsubEvent?.();
    await this.client.stop();
  }

  async refreshModels(): Promise<void> {
    await this.client.refreshModels();
  }
}
