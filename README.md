# Nightfall

> 夜间场景编排器 — 将散乱的夜晚可能性收束为一个可执行的"结局"

Nightfall 是一款面向都市夜归人的智能场景编排应用。它不是简单的地点推荐系统，而是一个能够理解用户意图、编排场景、提供可执行结局的 AI 助手。

**在线体验**: [https://nightfall-uuyl.onrender.com](https://nightfall-uuyl.onrender.com)

## 核心特性

- **意图理解**: 通过自然语言描述你的需求，Nightfall 会理解并匹配最合适的场景技能
- **双轨保障**: 每个推荐结局都配有 Plan B，确保用户不会落空
- **氛围优先**: 通过 Sky、Radio、Veil 等模块营造沉浸式夜间体验
- **轻量执行**: 一键导航、清单提醒，降低执行门槛

## 技术架构

Nightfall 采用了两个创新的架构设计：

### Skills 系统

一个将特定能力封装成独立、可重用模块的微内核架构：

- **标准化契约**: 统一的 `SkillManifest`、`SkillRequest`、`SkillResult` 接口
- **独立技能包**: 18+ 个自包含的技能包（咖啡懂王、艺术漫步、书里偷闲等）
- **智能路由**: 规则优先 + 语义排序的混合路由策略
- **隔离运行时**: 沙盒化执行环境，支持权限控制和审计日志

### A2UI (Agent-to-UI)

一个声明式的、数据驱动的 UI 框架：

- **消息驱动**: 后端通过标准化消息控制前端 UI 的渲染和更新
- **数据与视图分离**: 业务逻辑与界面表现完全解耦
- **声明式渲染**: 前端作为"忠实的渲染器"，严格执行后端指令

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                   │
│  ├── A2UI Renderer (声明式组件渲染)                           │
│  └── SurfaceView (多界面管理)                                 │
└─────────────────────────────────────────────────────────────┘
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js + Express)                │
│  ├── NightfallEngine (核心引擎)                               │
│  ├── SkillRouter (技能路由)                                   │
│  ├── SkillRuntime (技能执行)                                  │
│  └── ToolBus (工具调用)                                       │
└─────────────────────────────────────────────────────────────┘
                              │ External APIs
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Gemini API │ Amap POI │ Unsplash │ Open-Meteo              │
└─────────────────────────────────────────────────────────────┘
```

## 频道设计

| 频道 | 功能 | 状态 |
|------|------|------|
| **Tonight** | 核心交互：订单 → 候选 → 结局 | ✅ 完成 |
| **Discover** | 技能货架，浏览所有可用场景 | ✅ 完成 |
| **Sky** | 环境感知，天气/日落/氛围压力 | ✅ 完成 |
| **Whispers** | 匿名走廊，留下夜晚碎片 | ✅ 基础完成 |
| **Pocket** | 个人档案，保存票根和足迹 | 🚧 开发中 |
| **Radio** | 背景音频，氛围音乐和叙事 | 🚧 开发中 |

## 本地开发

### 环境要求

- Node.js 18+
- pnpm (推荐) 或 npm

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/xingyang1991/nightfall.git
cd nightfall

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 GEMINI_API_KEY

# 启动开发服务器（前后端同时）
pnpm run dev:full
```

- 前端: http://localhost:3000
- 后端: http://localhost:4000

### 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `GEMINI_API_KEY` | Gemini API 密钥 | ✅ |
| `OPENAI_API_KEY` | OpenAI API 密钥（备选） | ❌ |
| `NF_TOOL_MODE` | 工具模式 (stub/real) | ❌ |
| `NF_DEFAULT_CITY` | 默认城市 | ❌ |

## 项目结构

```
nightfall/
├── a2ui/                   # A2UI 协议实现
│   ├── messages.ts         # 消息类型定义
│   ├── programs.ts         # 界面程序定义
│   ├── renderer.tsx        # 声明式渲染器
│   └── store.tsx           # 状态管理
├── runtime/                # 后端运行时
│   ├── nightfallEngine.ts  # 核心引擎
│   ├── skills/             # 技能系统
│   │   ├── packages/       # 技能包目录
│   │   ├── registry.ts     # 技能注册表
│   │   └── manusLoader.ts  # 技能加载器
│   ├── router/             # 路由系统
│   └── policy/             # 策略与审计
├── server/                 # Express 服务器
├── services/               # 外部服务集成
│   ├── gemini.ts           # Gemini LLM
│   ├── amap.ts             # 高德地图 POI
│   └── unsplash.ts         # Unsplash 图片
├── components/             # React 组件
└── App.tsx                 # 前端入口
```

## 技能包示例

每个技能包是一个自包含的目录，包含：

```
packages/coffee-dongwang/
├── SKILL.md              # 技能规格说明（自然语言）
├── BUNDLE_CONTRACT.md    # 输出契约定义
├── EXAMPLE_OUTPUT.md     # 示例输出
└── agents/
    └── openai.yaml       # Agent 配置
```

技能通过自然语言定义，由 LLM 在运行时解释执行，实现了"用自然语言驱动复杂业务逻辑"的核心思想。

## 部署

项目已部署在 Render 平台：

1. Fork 本仓库
2. 在 Render 创建 Web Service
3. 连接 GitHub 仓库
4. 设置环境变量 `GEMINI_API_KEY`
5. 部署完成

## 许可证

MIT License

## 致谢

- [Gemini API](https://ai.google.dev/) - LLM 能力支持
- [高德地图](https://lbs.amap.com/) - POI 数据
- [Unsplash](https://unsplash.com/) - 图片资源
- [Open-Meteo](https://open-meteo.com/) - 天气数据
