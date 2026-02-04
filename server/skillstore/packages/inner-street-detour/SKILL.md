---
name: inner-street-detour
description: "Guide users to detour from main streets into quieter side streets to find owner-run independent shops and pick one long-term-use small item (about 50–200 CNY). Use when users ask for niche/quiet neighborhoods, independent/curated shops, small tasteful purchases, short 30–90 minute strolls, or a \"生活补丁/小物\" experience with a no-buy option."
---

# 拐进内街

## 概览
带用户从主街拐入内街，快速给 2–4 个候选片区，让用户选择后再补齐路线与购买细节，目标是“发现感 + 小满足”，而不是逛到疲惫。

## 核心原则
- 保持克制：首轮只给 2–4 个候选，不给长清单。
- 不强种草：只说可验证细节（材质、品类、价位、服务风格）。
- 不引导冲动消费：默认提供“不买也成立”的 Plan B。
- 轻参与：先让用户点选方向，再给落地细节。

## 工作流程（两段式）
### 1. 轻量询问
- 先问 1 句偏好品类：`纸品 / 陶器 / 金属配饰 / 旧物 / 香氛 / 杂货 / 随缘但要对味`。
- 若缺关键信息，再补问预算上限（默认 50–200 元）。
- 若缺关键信息，再补问时间（30/60/90 分钟）。
- 若缺关键信息，再补问社交电量（完全不聊天 / 可以简单问一句）。
- 若缺关键信息，再补问当前位置或可到达范围。

### 2. 召回候选片区并筛选
- 围绕用户位置，用关键词检索：`片区 + 独立店/主理人店/选物/文具/陶/中古/香氛`。
- 过滤明显高拥挤/排队点，优先安静、陈列克制的街巷。
- 明确营业时间与拥挤不确定性；若不确定，提前声明并准备 Plan B。

### 3. 输出首轮候选卡（2–4 张）
- 每张卡只包含：1 句“为什么对味”、1 句“你去主要看什么”、1 个“预计耗时”、拥挤风险（低/中/高）。
- 提供轻量调整选项：`更安静 / 更便宜 / 更近 / 随缘换一组`
- 模板与示例见 `references/examples.md`。

### 4. 敲定最终方案
- 给 2–3 站短动线（步行优先）。
- 每站最多 3 行：`看什么 + 选购小提示 + 不尴尬退场方式`。
- 加一条“买什么更不后悔”的提示：按材质/用途/体积选择。
- 给 Plan B：下雨/太挤/不想买时的室内替代或“只摸材质任务”。

### 5. 票根式回声
- 给一个“今日主题”+ 一个细节提示，邀请用户补一句触感或印象。

## 风控与降级
- 附近无足够内街店：改为“室内小志/书店/小展”版本。
- 用户不想出门：改为“在家做一个材质小补丁”（整理桌面一角 + 选一件物件摆放）。
- 信息不确定：明确说明不确定，并把 Plan B 放到并列位置。

## 输出约束
- 首轮候选固定 2–4 个。
- 最终方案固定 2–3 站。
- 每站说明不超过 3 行。
- 必须包含“不买也成立”的 Plan B。

## 资源
- `references/examples.md`：候选卡与最终方案模板、示例对话。


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
