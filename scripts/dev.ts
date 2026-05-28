/**
 * Dev runner that starts the UI and server concurrently.
 * Uses direct spawn (no shell) to avoid cmd.exe Ctrl+C prompts on Windows.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { platform } from "node:os";

const ROOT = resolve(import.meta.dirname ?? ".", "..");
const children: ChildProcess[] = [];

// --- Kill any process lingering on port 3001 ---
function freePort(port: number): void {
  try {
    if (platform() === "win32") {
      const cmd = `FOR /F "tokens=5" %a IN ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') DO @taskkill /F /PID %a > nul 2>&1`;
      execSync(cmd, { stdio: "ignore", timeout: 3000 });
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
        stdio: "ignore",
        timeout: 3000,
      });
    }
  } catch {
    // port already free or kill failed — continue anyway
  }
}

// --- Clean shutdown ---
function exit() {
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      // best-effort
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", exit);
process.on("SIGTERM", exit);

// --- Start child processes ---
function start(name: string, cmd: string, args: string[]): void {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: platform() === "win32",
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null && signal !== "SIGTERM") {
      exit();
    }
  });

  children.push(child);
}

// --- Main ---
freePort(3001);

start("server", "npx", ["tsx", "watch", "server/index.ts"]);
start("ui", "npx", ["vite"]);

process.stdin.resume();
