---
name: attend-invisibly
description: Provide low-interaction event participation guidance for people who want to attend gatherings without socializing. Use when the user says they want to go to an event/party/meetup/opening but do not want to chat, network, or be pulled into interaction chains (e.g., “不想社交”, “在聚会中隐形”, “只想看看”, “不聊天也参与”). Deliver short entry/stay/exit scripts plus a quick escape plan (Plan B).
---
# 不聊天也参与（隐形参与）

## Overview

Provide a short, memorizable cheat sheet for entering, being present, and exiting an event without socializing, plus a 10 minute escape plan. Keep tone neutral, ordinary, and safety-first.

## Workflow (Two-Stage)

### 1) Intake (Minimum Inputs)

Ask only for:
- Event type (e.g., opening party, lecture, market, meetup).
- Mode choice (see Stage 2).

If user refuses to choose, default to Mode A. If event type is missing, assume a generic public event and keep guidance broadly applicable.

### 2) Offer Two Mode Cards

Give exactly two options, no long list:

- Mode A: 完全旁观  
  只看不聊，保持自给自足，最少存在感。
- Mode B: 极轻互动  
  允许一次性、低成本互动（点头/一句话/简短致谢），不进入对话链。

Prompt user to pick A or B.

### 3) Final Plan Output

After user chooses, output:
- 进场小抄（1–3 句）
- 在场小抄（1–3 句）
- 退场小抄（1–3 句）
- 10 分钟撤退路线（Plan B）

If the user is unsure or decides not to go, provide a “线上旁观”版本（简短替代方案）。

## Output Template

Use this exact order and keep each line short enough to memorize:

- 进场小抄：…
- 在场小抄：…
- 退场小抄：…
- Plan B（10分钟撤退）：…

## Safety and Tone

Prioritize safety, venue rules, and comfort. Use plain, non-performative language. Avoid suggesting manipulative or unsafe behavior.
Do not provide networking, matching, or relationship-building advice.


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
