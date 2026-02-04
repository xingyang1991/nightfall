# Nightfall 高优先级改进建议 (P0)

本文档详细阐述了解决 Nightfall 应用核心体验闭环断裂问题的三个高优先级（P0）改进方案。每个方案都包含具体的问题描述、目标、详细的实现步骤和验证方法，旨在为开发者提供清晰、可执行的指引。

---

## 1. 实现票根保存到 Pocket (数据持久化)

### 1.1 问题描述

当前，用户在 Tonight 频道生成的票根（Ticket）在页面刷新后会丢失，无法在 Pocket 频道中回顾。这是因为所有状态都存储在内存中，缺乏持久化机制。

### 1.2 改进目标

- 在用户选择一个候选方案并生成票根后，自动将该票根数据保存到浏览器的 `localStorage` 中。
- Pocket 频道能够从 `localStorage` 读取并展示所有已保存的票根列表。
- 实现数据持久化，即使用户刷新或关闭浏览器后重新打开，历史票根依然存在。

### 1.3 实现步骤

#### 步骤一：创建 `localStorage` 工具函数

在 `a2ui/` 目录下创建一个新文件 `storage.ts`，用于封装 `localStorage` 的读写操作，并处理序列化和反序列化。

**文件: `a2ui/storage.ts`**
```typescript
// a2ui/storage.ts

const POCKET_STORAGE_KEY = 'nightfall_pocket_tickets';

export interface StoredTicket {
  id: string;
  timestamp: number;
  bundle: any; // 完整的票根数据
}

export function getPocketTickets(): StoredTicket[] {
  try {
    const rawData = localStorage.getItem(POCKET_STORAGE_KEY);
    if (!rawData) return [];
    return JSON.parse(rawData) as StoredTicket[];
  } catch (error) {
    console.error("Failed to parse pocket tickets from localStorage", error);
    return [];
  }
}

export function saveTicketToPocket(bundle: any): StoredTicket {
  const tickets = getPocketTickets();
  const newTicket: StoredTicket = {
    id: bundle.primary_ending?.id || `ticket_${Date.now()}`,
    timestamp: Date.now(),
    bundle: bundle,
  };

  // 避免重复添加
  const existingIndex = tickets.findIndex(t => t.id === newTicket.id);
  if (existingIndex !== -1) {
    tickets[existingIndex] = newTicket;
  } else {
    tickets.unshift(newTicket); // 新票根放在最前面
  }

  localStorage.setItem(POCKET_STORAGE_KEY, JSON.stringify(tickets));
  return newTicket;
}
```

#### 步骤二：在票根生成时调用保存函数

修改 `runtime/skills/tonightComposer.ts`，在 `finalize` 函数成功生成 `bundle` 后，调用 `saveTicketToPocket`。由于技能运行在后端，我们需要通过一个新的 Action 将 `bundle` 发送到前端进行保存。

**修改 `a2ui/store.ts`**：添加一个新的 Action Case 来处理保存逻辑。

```typescript
// a2ui/store.ts

// ... import ...
import { saveTicketToPocket } from './storage';

// ... 在 a2uiRuntimeReducer 的 switch(action.type) 中添加 ...
    case 'SAVE_TICKET_TO_POCKET': {
      if (action.payload?.bundle) {
        saveTicketToPocket(action.payload.bundle);
        // 可选：可以触发一个事件或状态更新，通知UI刷新
        console.log('Ticket saved to pocket');
      }
      return state;
    }
```

**修改 `runtime/nightfallEngine.ts`**：在处理完 `TONIGHT_SELECT_CANDIDATE` 后，分发一个 `SAVE_TICKET_TO_POCKET` 的 Action。

```typescript
// runtime/nightfallEngine.ts

// ... 在 handleA2UIAction 函数的 TONIGHT_SELECT_CANDIDATE case 中 ...
      // 在生成 bundle 之后
      if (bundle) {
        // ... 原有的 dispatchEffect('SHOW_UI', ...) 不变

        // 新增：分发保存票根的 Action
        dispatchEffect('SAVE_TICKET_TO_POCKET', { bundle });
      }
```

#### 步骤三：在 Pocket 频道渲染票根列表

修改 `a2ui/renderer.tsx` 中的 `PocketPanel` 组件，使其从 `storage.ts` 读取票根并渲染。

```typescript
// a2ui/renderer.tsx

// ... import ...
import { getPocketTickets, StoredTicket } from './storage';

// ... 找到 PocketPanel 组件 ...
function PocketPanel({ model, props, onAction }: { model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  const tickets = getPocketTickets();

  // ... 原有逻辑 ...

  return (
    <div className="w-full flex flex-col gap-6">
      {/* ... Veil, Footprints, Rhythm ... */}
      <div>
        <div className="text-[9px] mono uppercase tracking-[0.4em] text-white/15 px-8 mb-3">Tickets</div>
        {tickets.length > 0 ? (
          <div className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="bg-white/5 p-4 rounded-2xl">
                <div className="text-white/80 text-sm font-medium">{ticket.bundle.primary_ending?.title}</div>
                <div className="text-white/30 text-xs mt-1">{new Date(ticket.timestamp).toLocaleString()}</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No tickets yet" subtitle="SAVE A TICKET FROM TONIGHT" />
        )}
      </div>
    </div>
  );
}
```

### 1.4 验证方法

1.  完成一次 Tonight 流程，生成一个票根。
2.  切换到 Pocket 频道，确认新生成的票根已显示在列表中。
3.  刷新整个页面。
4.  再次进入 Pocket 频道，确认票根依然存在。

---

## 2. 实现 Go 按钮动作 (执行层)

### 2.1 问题描述

在票根（Ticket）页面，"Go" 按钮虽然存在，但点击后没有任何反应。用户无法根据生成的"结局"进行下一步操作，如导航到目的地。

### 2.2 改进目标

- 为 "Go" 按钮添加点击事件，根据票根中定义的 `action` 类型执行相应操作。
- 对于 `NAVIGATE` 类型的 `action`，在新标签页中打开一个包含目的地经纬度的 Google Maps URL。

### 2.3 实现步骤

#### 步骤一：修改 `NightfallTicket` 组件

在 `a2ui/renderer.tsx` 中找到 `NightfallTicket` 组件，为 "Go" 按钮绑定 `onClick` 事件。

```typescript
// a2ui/renderer.tsx

// ... 找到 NightfallTicket 组件 ...
function NightfallTicket({ model, props, onAction }: { surfaceId: string; model: any; props: any; onAction: (name: string, payload?: any) => void }) {
  // ... 原有逻辑 ...

  const handleGo = () => {
    const action = activePlan === 'primary' ? primary.action : planB.action;
    if (!action) return;

    switch (action.type) {
      case 'NAVIGATE': {
        const { lat, lng, name } = action.payload;
        if (lat && lng) {
          const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          window.open(url, '_blank');
        }
        break;
      }
      // 未来可以扩展其他 action type, e.g., START_ROUTE, PLAY_MUSIC
      default:
        console.log('Unhandled Go action type:', action.type);
    }
  };

  // ... 在返回的 JSX 中找到 "Go" 按钮 ...
  // <button>Go</button> -> <button onClick={handleGo}>Go</button>

  // 示例 (具体 JSX 结构需根据你的代码调整):
  return (
    // ...
    <div className="mt-6">
      <button onClick={handleGo} className="w-full bg-white text-black text-xs font-semibold py-4.5 rounded-2xl ...">
        Go
      </button>
    </div>
    // ...
  );
}
```

### 2.4 验证方法

1.  完成一次 Tonight 流程，生成一个包含咖啡馆推荐的票根。
2.  在票根页面，点击 "Go" 按钮。
3.  确认浏览器打开了一个新的标签页，并加载了 Google Maps，地图中心点是推荐的咖啡馆位置。

---

## 3. 修复数据不持久化问题

这个问题与第一个改进建议（实现票根保存到 Pocket）紧密相关。通过使用 `localStorage`，我们已经为票根数据建立了初步的持久化机制。为了全面解决数据持久化问题，需要将此模式推广到其他需要持久化的数据上。

### 3.1 问题描述

除了票根，用户的低语（Whispers）、足迹（Footprints）等个人数据也都是临时的，刷新后即丢失。

### 3.2 改进目标

- 将 `localStorage` 的使用模式推广到 Whispers 和 Footprints 模块。
- 确保所有用户生成的内容在会话之间保持不变。

### 3.3 实现步骤

#### 步骤一：为 Whispers 添加持久化

在 `a2ui/storage.ts` 中添加用于读写低语的函数。

**文件: `a2ui/storage.ts`**
```typescript
// ...
const WHISPERS_STORAGE_KEY = 'nightfall_whispers';

export interface StoredWhisper {
  id: string;
  timestamp: number;
  text: string;
}

export function getWhispers(): StoredWhisper[] { /* ...类似于 getPocketTickets... */ }
export function saveWhisper(text: string): StoredWhisper { /* ...类似于 saveTicketToPocket... */ }
```

修改 `WhisperWall` 和 `WhisperComposer` 组件，使用上述函数进行读写操作。

#### 步骤二：为 Footprints 添加持久化

Footprints 的数据是基于用户行为（如生成票根、使用专注模式）的统计。这需要在相应的事件发生时，更新 `localStorage` 中的统计数据。

**文件: `a2ui/storage.ts`**
```typescript
// ...
const FOOTPRINTS_STORAGE_KEY = 'nightfall_footprints';

export interface FootprintsStats {
  ticketsGenerated: number;
  focusMinutes: number;
  // ... 其他统计项
}

export function getFootprints(): FootprintsStats { /* ... */ }
export function incrementTicketsGenerated() {
  const stats = getFootprints();
  stats.ticketsGenerated += 1;
  localStorage.setItem(FOOTPRINTS_STORAGE_KEY, JSON.stringify(stats));
}
```

在 `saveTicketToPocket` 函数中调用 `incrementTicketsGenerated()`。

### 3.4 验证方法

1.  添加几条低语，刷新页面，确认低语依然存在。
2.  生成几个票根，进入 Footprints 频道（需先实现入口），确认 `ticketsGenerated` 计数正确。
