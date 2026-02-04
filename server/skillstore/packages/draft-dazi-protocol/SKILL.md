---
name: draft-dazi-protocol
description: Draft low-pressure companion ("搭子"/dazi) meet-up protocols with three small rules (time, form, exit) plus start/end/Plan B lines. Use when a user wants to arrange a buddy activity without awkwardness, asks for 轻社交/低耗相处, or wants a short protocol instead of long advice.
---
# 搭子不尴尬协议

## Overview

Create a three-rule, low-pressure companion protocol that prevents awkwardness and social burnout. Always deliver three rules (time/form/exit), a simple start line, a clear end line, and a Plan B (reschedule sentence + solo alternative).

## Inputs To Collect

- Ask for activity form (walk, exhibit, study, bookstore, etc.).
- Ask for duration.
- Ask for interaction intensity (silent / light chat / flexible).
- After the user picks a template, ask for AA split preference and lateness tolerance.

## Non-Negotiables

- Output exactly three rules: time, form, exit.
- Include an explicit exit mechanism.
- Keep it short; avoid long advice or psychoanalysis.
- Do not do matching or private chat.
- Use a neutral, non-coercive tone; avoid PUA language.
- Always include a start line, an end line, and a Plan B.
- If inputs are missing, ask the smallest number of questions needed.

## Workflow (Two-Stage)

1. Intake: ask for activity form, duration, interaction intensity.
2. First round: provide 2-3 protocol cards only; each card contains the three rules in a copyable block.
3. User pick: ask which card they want.
4. Finalize: ask AA and lateness tolerance if not provided.
5. Final output: return the chosen protocol plus start line, end line, and Plan B (reschedule sentence + solo alternative).

## Fallback

- If the user is unsure, default to the silent 30-minute walk template and state the assumptions.

## Output Templates

### First Round: Protocol Cards

```text
[模板A] <风格名>
时间：<时长 + 频率/窗口>
形式：<活动 + 互动强度>
退出：<到点/半途退出的默认机制>
```

### Final Output

```text
三条协议（可复制）
1. 时间：<时长/时间窗/迟到容忍>
2. 形式：<活动形态 + 互动强度 + AA>
3. 退出：<结束句/到点即散/可中途退出>

开始方式：
<一行启动句>

结束方式：
<一行结束句>

Plan B（改期 + 单人替代）：
改期句：<一句话>
单人替代：<可独自做的同主题替代>
```

## Tone Notes

- Keep language ordinary, calm, and non-pushy.
- Optimize for low effort and low awkwardness.

## Example Fallback Template (Silent Walk 30 min)

```text
[默认] 沉默散步 30 分钟
时间：30 分钟，迟到 10 分钟内继续
形式：散步 + 几乎不聊
退出：到点就散，走累可提前说“我先回啦”
```


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
