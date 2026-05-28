# Pi Web - Browser-based Coding Assistant

A browser-based coding assistant UI that connects to the Pi agent CLI process via WebSocket.

[中文文档](./README-CN.md)

## Prerequisites

This project depends on the [Pi agent](https://github.com/earendil-works/pi) source code. Both repositories must be cloned into the **same parent directory**:

```
parent/
├── pi/             ← git clone https://github.com/earendil-works/pi.git
└── pi-web/         ← this repo
```

```bash
git clone https://github.com/earendil-works/pi.git
git clone <this-repo-url>
```

## Quick Start

```bash
# Build pi first (pi-web depends on compiled pi packages)
cd pi
npm ci --ignore-scripts   # or: npm install --ignore-scripts
npm run build

# Then install and start pi-web
cd ../pi-web
npm install
npm run dev
```

This starts both:
- Frontend dev server (http://localhost:5173)
- Backend WebSocket server (http://localhost:3001)

Open http://localhost:5173 in your browser.

## Project Structure

```
pi-web/
├── index.html              # Entry HTML
├── package.json            # Dependencies
├── README.md               # This file
├── CLAUDE.md               # Detailed project docs
├── vite.config.ts          # Vite config
├── tsconfig.json           # Frontend TypeScript config
├── tsconfig.server.json    # Backend TypeScript config
├── scripts/
│   └── build-dist.ts       # Build distribution script
├── server/                 # Backend code
│   ├── index.ts            # Express + WebSocket server entry
│   └── agent-manager.ts    # Agent instance management
└── src/                    # Frontend code
    ├── main.tsx            # React entry
    ├── App.tsx             # Main app component
    ├── index.css           # Global styles
    ├── types/              # Type definitions
    ├── lib/                # Utility libraries
    ├── store/              # State management
    ├── hooks/              # Custom hooks
    └── components/         # UI components
```

## Features

- **Real-time chat**: Chat with Pi agent via WebSocket
- **Streaming responses**: Stream agent responses in real-time
- **Tool execution**: Display tool calls and results from the agent
- **Model selection**: Switch between different AI models
- **Conversation history**: Save and manage chat history

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Express 5 + WebSocket
- **State Management**: Zustand
- **Build Tool**: Vite 6

## Scripts

```bash
npm run dev          # Start both frontend and backend dev servers
npm run dev:ui       # Start frontend dev server only
npm run dev:server   # Start backend dev server only
npm run build        # Build for production (compile only, no server start)
npm run preview      # Build and start production server → http://localhost:3001
```

## Configuration

### Environment Variables

- `PORT`: Backend server port (default: 3001)
- `PI_CLI_PATH`: Pi agent CLI path (optional, auto-detected)

### Model Configuration

Model config file is located at `~/.pi/agent/models.json` and can be edited via the UI.

## More Info

For detailed architecture and technical information, see [CLAUDE.md](./CLAUDE.md).
