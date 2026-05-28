# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pi-Web is a browser-based coding agent UI built with React (frontend) and Express/WebSocket (backend). It provides a chat interface for interacting with the Pi coding agent (`@earendil-works/pi-coding-agent`), which runs as a separate CLI process.

The UI is in Chinese (zh-CN) — "Pi - 编程助手" (Pi - Programming Assistant).

## Commands

```bash
# Development (runs both frontend and backend concurrently)
npm run dev

# Frontend only (Vite dev server on port 5173)
npm run dev:ui

# Backend only (Express + WebSocket on port 3001)
npm run dev:server

# Production build (outputs to dist/ and dist-server/)
npm run build

# Build self-contained distribution folder (pi-web-dist/)
npm run build:dist

# Run production server (after building)
npm run preview
```

There are no tests or linting configured in this project.

## Architecture

```
Browser (React) <-> WebSocket <-> Express Server <-> RpcClient <-> Pi Agent CLI Process
```

### Frontend (`src/`)
- **State Management**: Zustand store (`src/store/agent-store.ts`) holds all UI state: connection status, messages, streaming state, model info, workspaces
- **Agent Communication**: `AgentClient` (`src/lib/agent-client.ts`) connects to the server via WebSocket at `/ws`, supports `switchWorkspace()` for changing agent cwd without reconnecting
- **Event Processing**: `applyEvent()` in the store processes `AgentEvent` objects from the agent core and updates state reactively
- **Message Flow**: `ChatInput` → `client.prompt()` → server → agent → events stream back → store updates → UI re-renders
- **Workspaces**: Each workspace is a folder with independent agent cwd and conversation history. Workspace list and conversations are persisted in `localStorage` key `pi-workspaces`. Adding a workspace sends `switch_instance` to create a new agent process for that directory.
- **Sidebar** (`src/components/Sidebar.tsx`): Workspace tree with expandable folders, per-workspace conversation lists, add/delete workspace modals

### Server (`server/`)
- **Entry Point**: `server/index.ts` — Express app with WebSocketServer at path `/ws`, serves static frontend in production
- **Agent Bridge**: `server/agent-manager.ts` — `AgentInstance` class wraps `RpcClient`, forwards commands and events between browser and agent process
- **Ports**: Server runs on 3001 (or `PORT` env var), Vite dev server on 5173 with WebSocket proxy

### External Dependencies
The project depends on Pi agent packages via `file:` references to a sibling directory:
```
../pi/packages/
  ├── agent/         → @earendil-works/pi-agent-core
  ├── ai/            → @earendil-works/pi-ai
  └── coding-agent/  → @earendil-works/pi-coding-agent
```

Clone https://github.com/earendil-works/pi into the same parent directory as this repo.

The agent CLI path is auto-detected from `../pi/packages/coding-agent/dist/cli.js` or can be set via `PI_CLI_PATH` environment variable.

## Key Technical Details

- **Path Alias**: `@/*` maps to `./src/*` (configured in both tsconfig.json and vite.config.ts)
- **Build Tools**: Vite for frontend, `tsgo` for server compilation (outputs to `dist-server/`)
- **TypeScript**: Strict mode enabled, ES2022 target
- **CSS**: Tailwind CSS 4 via Vite plugin
- **WebSocket Protocol**: JSON messages. Server messages typed as `WsServerMessage` in `src/types/index.ts`: `init_ok/error`, `switch_ok/error`, `agent_event`, `rpc_response`, `error`. Client sends `init`, `switch_instance`, and `command` messages.
- **Streaming**: Supports real-time streaming of agent responses with "steer" command to redirect agent mid-generation
