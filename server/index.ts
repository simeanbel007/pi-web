import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { AgentInstance } from "./agent-manager.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3001", 10);

// Resolve agent CLI path: env var > auto-detect
function resolveAgentCli(): string {
  if (process.env.PI_CLI_PATH) {
    return process.env.PI_CLI_PATH;
  }

  // Try common relative locations
  const candidates = [
    // dev: pi-web/server/ -> pi/packages/coding-agent/dist/cli.js
    path.resolve(__dirname, "../../pi/packages/coding-agent/dist/cli.js"),
    // production: dist-server/ -> pi/...
    path.resolve(__dirname, "../../../pi/packages/coding-agent/dist/cli.js"),
    // sibling folder
    path.resolve(__dirname, "../pi/packages/coding-agent/dist/cli.js"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  console.error("[pi-web] Could not find agent CLI. Set PI_CLI_PATH environment variable.");
  console.error("[pi-web] Searched:", candidates);
  process.exit(1);
}

const PI_CLI_PATH = resolveAgentCli();
console.log(`[pi-web] agent CLI: ${PI_CLI_PATH}`);

// Resolve models.json path
function getModelsJsonPath(): string {
  const envDir = process.env.PI_CODING_AGENT_DIR;
  const agentDir = envDir || path.join(homedir(), ".pi", "agent");
  return path.join(agentDir, "models.json");
}

const MODELS_JSON_PATH = getModelsJsonPath();
console.log(`[pi-web] models.json: ${MODELS_JSON_PATH}`);

const app = express();
app.use(cors());
app.use(express.json());

// Serve built frontend in production
const distPath = path.resolve(__dirname, "../dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
}

// API: Get models.json content
app.get("/api/models-config", (_req, res) => {
  try {
    if (!existsSync(MODELS_JSON_PATH)) {
      res.json({ providers: {} });
      return;
    }
    const content = readFileSync(MODELS_JSON_PATH, "utf-8");
    const config = JSON.parse(content);
    res.json(config);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// API: Save models.json content
app.post("/api/models-config", async (req, res) => {
  try {
    const config = req.body;
    // Ensure directory exists
    const dir = path.dirname(MODELS_JSON_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(MODELS_JSON_PATH, JSON.stringify(config, null, 2), "utf-8");
    chmodSync(MODELS_JSON_PATH, 0o600);

    // Notify all connected agent instances to refresh models
    for (const instance of instances.values()) {
      try {
        await instance.refreshModels();
      } catch (err) {
        console.error("[pi-web] Failed to refresh models for instance:", err);
      }
    }

    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// API: Get models.json file path
app.get("/api/models-config/path", (_req, res) => {
  res.json({ path: MODELS_JSON_PATH });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Track active agent instances by session
const instances = new Map<string, AgentInstance>();

wss.on("connection", (ws: WebSocket) => {
  console.log("[ws] client connected");

  let instance: AgentInstance | null = null;

  ws.on("message", async (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    switch (msg.type) {
      case "init": {
        const instanceId = randomUUID();
        const cwd = (msg.cwd as string) || process.cwd();
        try {
          instance = new AgentInstance(instanceId, cwd, PI_CLI_PATH);
          await instance.start();
          instance.bindWebSocket(ws);
          instances.set(instanceId, instance);
          ws.send(
            JSON.stringify({ type: "init_ok", instanceId, cwd }),
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          ws.send(JSON.stringify({ type: "init_error", error: message }));
        }
        break;
      }

      case "switch_instance": {
        const newCwd = (msg.cwd as string) || process.cwd();
        try {
          // Find existing instance for this cwd or create a new one
          let targetInstance: AgentInstance | null = null;
          for (const [id, inst] of instances) {
            if (inst.cwd === newCwd) {
              targetInstance = inst;
              break;
            }
          }
          if (!targetInstance) {
            const newId = randomUUID();
            targetInstance = new AgentInstance(newId, newCwd, PI_CLI_PATH);
            await targetInstance.start();
            instances.set(newId, targetInstance);
          }
          // Update ws message routing: rebind ws to new instance
          instance = targetInstance;
          targetInstance.bindWebSocket(ws);
          ws.send(
            JSON.stringify({ type: "switch_ok", instanceId: targetInstance.id, cwd: newCwd }),
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          ws.send(JSON.stringify({ type: "switch_error", error: message }));
        }
        break;
      }

      case "command": {
        if (!instance) {
          ws.send(
            JSON.stringify({
              type: "error",
              id: msg.id,
              error: "No agent instance. Send 'init' first.",
            }),
          );
          return;
        }
        await instance.handleCommand({
          id: msg.id as string,
          type: msg.command as string,
          message: msg.message as string | undefined,
          images: msg.images as { type: "image"; data: string; mimeType: string }[] | undefined,
          provider: msg.provider as string | undefined,
          modelId: msg.modelId as string | undefined,
          level: msg.level as string | undefined,
        });
        break;
      }

      default:
        ws.send(
          JSON.stringify({ type: "error", error: `Unknown message type: ${msg.type}` }),
        );
    }
  });

  ws.on("close", async () => {
    console.log("[ws] client disconnected");
    if (instance) {
      instances.delete(instance.id);
      await instance.dispose();
    }
  });

  ws.on("error", async (err) => {
    console.error("[ws] error:", err.message);
    if (instance) {
      instances.delete(instance.id);
      await instance.dispose();
    }
  });
});

// Fallback to index.html for SPA routing
if (existsSync(distPath)) {
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`[pi-web] server running on http://localhost:${PORT}`);
  console.log(`[pi-web] websocket on ws://localhost:${PORT}/ws`);
});

// Graceful shutdown — release port 3001 on Ctrl+C or terminal close
async function shutdown() {
  console.log("[pi-web] shutting down...");
  for (const [id, instance] of instances) {
    try {
      await instance.dispose();
    } catch {
      // best-effort cleanup
    }
  }
  wss.close();
  server.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
