/**
 * Build script: creates a self-contained distribution folder.
 * Usage: npx tsx scripts/build-dist.ts
 */
import { cpSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "pi-web-dist");

mkdirSync(OUT, { recursive: true });

// 1. Copy compiled server
console.log("Copying server...");
cpSync(resolve(ROOT, "server"), resolve(OUT, "server"), { recursive: true });

// 2. Copy built frontend
if (!existsSync(resolve(ROOT, "dist"))) {
  console.error("Run 'npm run build:ui' first to build the frontend.");
  process.exit(1);
}
console.log("Copying frontend...");
cpSync(resolve(ROOT, "dist"), resolve(OUT, "dist"), { recursive: true });

// 3. Write minimal package.json
console.log("Writing package.json...");
const pkg = {
  name: "pi-web",
  private: true,
  type: "module",
  scripts: {
    start: "node --import tsx server/index.ts",
  },
  dependencies: {
    "@earendil-works/pi-agent-core": "file:../pi/packages/agent",
    "@earendil-works/pi-ai": "file:../pi/packages/ai",
    "@earendil-works/pi-coding-agent": "file:../pi/packages/coding-agent",
    express: "^5.1.0",
    ws: "^8.18.2",
    cors: "^2.8.5",
  },
  devDependencies: {
    tsx: "^4.22.1",
  },
};
writeFileSync(resolve(OUT, "package.json"), JSON.stringify(pkg, null, 2));

// 4. Write launcher script (.cmd for Windows)
console.log("Writing launcher...");
const cmd = `@echo off
title Pi Web
echo.
echo  Pi Web - Browser-based Coding Agent
echo  ====================================
echo.

:: Install dependencies if needed
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install --production
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
  echo.
)

:: Auto-detect agent path
set "PI_CLI_PATH=%~dp0..\\pi\\packages\\coding-agent\\dist\\cli.js"
if not exist "%PI_CLI_PATH%" (
  echo Agent CLI not found at: %PI_CLI_PATH%
  echo.
  echo Please set PI_CLI_PATH environment variable to the agent cli.js path.
  echo Example: set PI_CLI_PATH=D:\\path\\to\\pi\\packages\\coding-agent\\dist\\cli.js
  echo.
  pause
  exit /b 1
)

echo Starting Pi Web...
echo Open http://localhost:3001 in your browser.
echo Press Ctrl+C to stop.
echo.
node --import tsx server/index.ts
pause
`;
writeFileSync(resolve(OUT, "start.cmd"), cmd);

// 5. Write .sh launcher for Linux/Mac
const sh = `#!/bin/bash
echo ""
echo "  Pi Web - Browser-based Coding Agent"
echo "  ===================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --production
  echo ""
fi

# Auto-detect agent path
PI_CLI_PATH="$SCRIPT_DIR/../pi/packages/coding-agent/dist/cli.js"
if [ ! -f "$PI_CLI_PATH" ]; then
  echo "Agent CLI not found at: $PI_CLI_PATH"
  echo "Please set PI_CLI_PATH environment variable."
  exit 1
fi

export PI_CLI_PATH
echo "Starting Pi Web..."
echo "Open http://localhost:3001 in your browser."
echo "Press Ctrl+C to stop."
echo ""
node --import tsx server/index.ts
`;
writeFileSync(resolve(OUT, "start.sh"), sh);

console.log(`\nDone! Distribution created at: ${OUT}`);
console.log("\nTo use:");
console.log(`  cd "${OUT}"`);
console.log("  start.cmd");
