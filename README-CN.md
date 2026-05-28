# Pi Web - 浏览器端编程助手

一个基于浏览器的编程助手 UI，通过 WebSocket 连接到 Pi agent CLI 进程。

## 前置要求

本项目依赖 [Pi agent](https://github.com/earendil-works/pi) 的源码。两个仓库必须克隆到**同一父目录**下：

```
parent/
├── pi/             ← git clone https://github.com/earendil-works/pi.git
└── pi-web/         ← 本仓库
```

```bash
git clone https://github.com/earendil-works/pi.git
git clone <本仓库地址>
```

## 快速开始

```bash
# 首先构建 pi（pi-web 依赖 pi 的编译产物）
cd pi
npm ci --ignore-scripts   # 或者: npm install --ignore-scripts
npm run build

# 然后安装并启动 pi-web
cd ../pi-web
npm install
npm run dev
```

这将同时启动：
- 前端开发服务器 (http://localhost:5173)
- 后端 WebSocket 服务器 (http://localhost:3001)

打开浏览器访问 http://localhost:5173

## 项目结构

```
pi-web/
├── index.html              # 入口 HTML
├── package.json            # 依赖配置
├── README.md               # 本文件
├── CLAUDE.md               # 项目详细文档
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # 前端 TypeScript 配置
├── tsconfig.server.json    # 后端 TypeScript 配置
├── scripts/
│   └── build-dist.ts       # 构建分发包脚本
├── server/                 # 后端代码
│   ├── index.ts            # Express + WebSocket 服务器入口
│   └── agent-manager.ts    # Agent 实例管理
└── src/                    # 前端代码
    ├── main.tsx            # React 入口
    ├── App.tsx             # 主应用组件
    ├── index.css           # 全局样式
    ├── types/              # 类型定义
    ├── lib/                # 工具库
    ├── store/              # 状态管理
    ├── hooks/              # 自定义 Hook
    └── components/         # UI 组件
```

## 核心功能

- **实时对话**: 通过 WebSocket 与 Pi agent 进行实时对话
- **流式响应**: 支持流式显示 agent 的响应
- **工具执行**: 显示 agent 执行的工具调用和结果
- **模型选择**: 支持切换不同的 AI 模型
- **对话历史**: 保存和管理对话历史

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4
- **后端**: Express 5 + WebSocket
- **状态管理**: Zustand
- **构建工具**: Vite 6

## 可用脚本

```bash
npm run dev          # 同时启动前端和后端开发服务器
npm run dev:ui       # 仅启动前端开发服务器
npm run dev:server   # 仅启动后端开发服务器
npm run build        # 构建生产版本（仅编译，不启动服务器）
npm run preview      # 构建并启动生产服务器 → http://localhost:3001
```

## 配置

### 环境变量

- `PORT`: 后端服务器端口 (默认: 3001)
- `PI_CLI_PATH`: Pi agent CLI 路径 (可选，会自动检测)

### 模型配置

模型配置文件位于 `~/.pi/agent/models.json`，可以通过 UI 界面进行编辑。

## 更多信息

详细的架构和技术信息请参考 [CLAUDE.md](./CLAUDE.md)。
