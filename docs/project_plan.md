# Nightfall 项目方案文档

## 一、项目概述

### 1.1 项目定位

**Nightfall** 是一款"夜间场景编排器"应用，旨在帮助用户规划和执行夜晚活动。它不是简单的推荐系统，而是一个能够理解用户意图、编排场景、提供可执行结局的智能助手。

### 1.2 核心理念

- **夜晚收束**：将散乱的夜晚可能性收束为一个可执行的"结局"
- **双轨保障**：每个结局都配有 Plan B，确保用户不会落空
- **氛围优先**：通过 Radio、Veil 等模块营造沉浸式夜间体验
- **轻量执行**：一键导航、清单提醒，降低执行门槛

### 1.3 目标用户

- 下班后需要找地方工作/放松的职场人群
- 希望探索城市夜生活但不想花时间规划的用户
- 追求高效决策、讨厌选择困难的用户

---

## 二、技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                  │
├─────────────────────────────────────────────────────────────────┤
│  App.tsx (Host Shell)                                            │
│    ├── A2UIBridge (状态同步)                                      │
│    ├── SurfaceView (渲染器)                                       │
│    └── Navigation (频道切换)                                      │
├─────────────────────────────────────────────────────────────────┤
│  A2UI Renderer                                                   │
│    ├── Core Primitives (Column, Row, Card, Text, Button)         │
│    └── Custom Components (NightfallTicket, GalleryWall, etc.)    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (Node.js + Express)              │
├─────────────────────────────────────────────────────────────────┤
│  Server (index.ts)                                               │
│    ├── /api/bootstrap (初始化)                                    │
│    ├── /api/a2ui/action (Action 分发)                             │
│    └── /api/places/photo (图片代理)                               │
├─────────────────────────────────────────────────────────────────┤
│  NightfallEngine (核心引擎)                                       │
│    ├── SkillRouter (技能路由)                                     │
│    ├── SkillRuntime (技能执行)                                    │
│    └── ToolBus (工具调用)                                         │
├─────────────────────────────────────────────────────────────────┤
│  Skills (技能层)                                                  │
│    ├── tonightComposer (今晚编排)                                 │
│    ├── whispersNote (低语笔记)                                    │
│    └── manusLoader (Manus 技能包)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ External APIs
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  External Services                                               │
│    ├── Gemini API (LLM)                                          │
│    ├── Google Places API (地点数据)                               │
│    └── Open-Meteo API (天气数据)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块说明

#### A2UI 协议

A2UI (Agentic UI) 是一种声明式 UI 协议，允许后端通过 JSON 消息描述 UI 结构，前端负责渲染。这种架构的优势在于：

- **解耦**：后端专注于业务逻辑，前端专注于渲染
- **动态性**：UI 可以根据后端状态实时变化
- **可扩展**：新增组件只需在前端添加渲染逻辑

#### NightfallEngine

NightfallEngine 是应用的"舞台经理"，负责：

- **技能路由**：根据用户输入匹配最合适的技能
- **技能执行**：调用技能生成候选和定稿
- **效果分发**：将技能输出转换为 A2UI 消息

#### ToolBus

ToolBus 提供技能可调用的工具集，包括：

- `searchPlaces`: 搜索附近地点
- `getPlaceDetails`: 获取地点详情
- `getWeather`: 获取天气信息
- `generateImage`: 生成图片（未实现）

---

## 三、频道设计

### 3.1 Tonight（今晚）

**核心流程**：Order → Clarify → Candidate → Result

**数据模型**：
```typescript
interface TonightBundle {
  primary_ending: {
    id: string;
    title: string;
    subtitle: string;
    action: { type: 'NAVIGATE' | 'START_ROUTE' | 'PLAY'; payload: any };
    checklist: string[];
    risk_note: string;
  };
  plan_b: {
    id: string;
    title: string;
    subtitle: string;
    action: { type: string; payload: any };
  };
  media_pack: {
    cover_ref: string;
    gallery_refs: string[];
  };
  audio_payload: {
    track_id: string;
    narrative: string;
  };
}
```

### 3.2 Discover（发现）

**核心功能**：技能货架，展示所有可用场景编排技能

**数据模型**：
```typescript
interface SkillCard {
  id: string;
  name: string;
  tagline: string;
  tags: string[];
  icon: string;
}
```

### 3.3 Sky（天穹）

**核心功能**：环境感知面板，显示当前位置的氛围压力

**数据模型**：
```typescript
interface SkyStats {
  node_id: string;
  pressure: 'Quiet' | 'Moderate' | 'Busy';
  ambient: string;
  weather: { temp: number; condition: string };
}
```

### 3.4 Pocket（口袋）

**核心功能**：个人档案库，保存票根、节奏曲线、Veil 封面和足迹

**数据模型**：
```typescript
interface PocketData {
  tickets: StoredTicket[];
  rhythm: RhythmData;
  veil: VeilData;
  footprints: FootprintsStats;
}
```

### 3.5 Whispers（低语）

**核心功能**：私密笔记层，记录夜晚碎片想法

**数据模型**：
```typescript
interface Whisper {
  id: string;
  timestamp: number;
  text: string;
  symbol: string;
}
```

### 3.6 Veil（面纱）

**核心功能**：每日封面与动态文案，作为夜晚的视觉锚点

### 3.7 Focus（专注）

**核心功能**：极简专注模式，屏蔽干扰

### 3.8 Radio（电台）

**核心功能**：背景音频层，提供氛围音乐和叙事性文案

---

## 四、技能系统

### 4.1 技能定义

每个技能需要实现以下接口：

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  tags: string[];
  
  // 判断是否匹配用户意图
  match(intent: string): Promise<number>;
  
  // 生成候选列表
  generateCandidates(context: SkillContext): Promise<Candidate[]>;
  
  // 根据选择生成最终结局
  finalize(candidateId: string, context: SkillContext): Promise<Bundle>;
}
```

### 4.2 内置技能

| 技能 ID | 名称 | 描述 |
|---------|------|------|
| tonightComposer | Tonight Composer | 通用夜晚编排，处理未匹配的请求 |
| whispersNote | Whispers Note | 低语笔记技能 |

### 4.3 Manus 技能包

通过 `manusLoader` 加载的外部技能包，包括：

- 咖啡懂王 (coffice)
- 隐形参与活动 (stealth-event)
- 书里偷闲 (book-escape)
- 预算控制 (budget-guard)
- 等 18 个技能

---

## 五、部署方案

### 5.1 当前部署

- **平台**：Render (Web Service)
- **URL**：https://nightfall-uuyl.onrender.com
- **套餐**：Starter (免费)
- **自动部署**：已启用（推送到 main 分支自动触发）

### 5.2 环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| GEMINI_API_KEY | Gemini API 密钥 | (在部署环境中设置) |
| NF_TOOL_MODE | 工具模式 (stub/real) | real |
| PLACES_PROVIDER | 地点服务提供商 | google |
| WEATHER_PROVIDER | 天气服务提供商 | openmeteo |
| NF_DEFAULT_CITY | 默认城市 | Shanghai |

### 5.3 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前后端同时）
npm run dev:full

# 仅启动后端
npm run server

# 仅启动前端
npm run dev

# 运行测试
npm run test:fixtures
```

---

## 六、开发路线图

### 6.1 当前阶段：PoC (概念验证)

**完成度**：35%

**已完成**：
- 基础架构搭建
- A2UI 协议实现
- Tonight 核心流程
- 技能路由系统
- Gemini API 集成

**待完成**：
- 数据持久化
- 执行动作实现
- 频道联动机制

### 6.2 下一阶段：MVP (最小可行产品)

**目标完成度**：70%

**优先级 P0**：
1. 实现票根保存到 Pocket
2. 实现 Go 按钮动作
3. 添加数据持久化层

**优先级 P1**：
4. 实现 Radio 音频播放
5. 完善 Gallery Wall
6. 添加 Veil/Focus 入口

### 6.3 未来阶段：Production

**目标完成度**：90%+

- 用户账户系统
- 云端数据同步
- 推送通知
- 性能优化
- 多语言支持

---

## 七、附录

### 7.1 目录结构

```
nf_prod_ready/
├── a2ui/                   # A2UI 协议实现
│   ├── messages.ts         # 消息类型定义
│   ├── orchestrator.ts     # 编排器
│   ├── programs.ts         # 频道程序定义
│   ├── renderer.tsx        # 渲染器
│   └── store.ts            # 状态管理
├── runtime/                # 后端运行时
│   ├── nightfallEngine.ts  # 核心引擎
│   ├── skillRouter.ts      # 技能路由
│   ├── skills/             # 技能实现
│   └── tools/              # 工具实现
├── server/                 # 服务器
│   └── index.ts            # 入口文件
├── tests/                  # 测试
│   └── fixtures/           # 测试用例
├── App.tsx                 # 前端入口
├── index.css               # 样式
├── package.json            # 依赖配置
└── vite.config.ts          # Vite 配置
```

### 7.2 API 参考

#### POST /api/bootstrap

初始化应用状态，返回初始 A2UI 消息。

#### POST /api/a2ui/action

分发用户 Action，返回更新后的 A2UI 消息。

**请求体**：
```json
{
  "name": "TONIGHT_SUBMIT_ORDER",
  "payload": { "text": "我想找一个安静的咖啡馆工作" },
  "surfaceId": "tonight"
}
```

#### GET /api/places/photo

代理 Google Places 图片请求。

**查询参数**：
- `ref`: 图片引用 ID
- `maxw`: 最大宽度
