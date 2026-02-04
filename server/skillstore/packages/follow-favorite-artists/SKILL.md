---
name: follow-favorite-artists
description: Track favorite artists with low-frequency, high-signal reminders by building an artist watchlist, disambiguating names, and surfacing 1 main + 2 backup upcoming appearances within the next 60 days; deliver a final visit plan (time/place/booking/what-to-see) and a minimal reminder strategy. Use when users say they only want to follow specific artists (e.g., “盯喜欢的艺术家”, “不要展讯流”, “艺术家提醒”, “follow favorite artists”).
---
# 盯住我爱的艺术家（艺术家雷达）

## Overview

Build a focused artist watchlist and run a two-stage flow: first propose a small set of candidates, then output one final, actionable plan with low-frequency reminders.

## Inputs To Collect

- Ask for 3-10 artist names or links (if more, ask to prioritize top 10).
- Ask for city and whether travel is OK (only local vs willing to go).
- Confirm time window (default: next 60 days).
- Ask preferred reminder frequency (key nodes vs monthly summary; default low and in-app).
- Collect any constraints that affect selection (budget, weekday only, etc.).

## Non-Negotiables

- Use only the artists on the user’s list; do not output trend lists or generic feeds.
- Confirm same-name disambiguation once before searching.
- Keep output small: 1 main + 2 backups in the first round.
- Keep reminders low-frequency and optional; default to one-time, “该去看” moments.
- Prefer official sources (artist, gallery, museum) for confirmation.

## Workflow (Two-Stage)

1. **Intake + disambiguation**
   - Collect artist list and resolve name ambiguity once.
   - Confirm city/travel and time window.
2. **Validate appearances**
   - Look up official sources to confirm upcoming shows/appearances.
   - Filter to the next 60 days unless user overrides.
3. **First round (1 main + 2 backups)**
   - Pick 1 main + 2 backups from the user list.
   - Explain the main pick with one concise sentence.
   - Mark any uncertainty with its source.
4. **User pick + adjust**
   - Let the user choose one, or adjust for city/travel.
5. **Final plan**
   - Provide time/place/booking + recommended time slot.
   - Provide ≤4 stop points (“what to notice”).
   - Provide a Plan B (same city or low-effort alternative).
   - Propose a reminder strategy (opening / last week / same-city appearance, or monthly summary).
6. **Fallback**
   - If official confirmation is missing or uncertain, downgrade to a monthly summary and label sources.

## Output Templates

### First Round

```
[主选] <艺术家> — <同城/可奔赴> <展/演/出现> (<日期区间>)
为什么是它：<一句理由>
风险/不确定：<来源或未确认项>

[备选] <艺术家> — <同城/可奔赴> <展/演/出现> (<日期区间>)
风险/不确定：<来源或未确认项>

[备选] <艺术家> — <同城/可奔赴> <展/演/出现> (<日期区间>)
风险/不确定：<来源或未确认项>
```

### Final Plan

```
展览卡:
- 时间：<日期/时段>
- 地点：<场馆 + 城市>
- 预约/购票：<有则给>
- 导航：<可提供地图深链>
- 推荐时段：<更适合去的时间>

停点（≤4）:
1) <停点>
2) <停点>
3) <停点>
4) <停点>

Plan B:
<同城或线上替代方案>

提醒策略:
<开幕/最后一周/同城出现一次 or 月度汇总>
```

## Tone

- Keep language concise, minimal, and decisive.
- Avoid art-history lectures; focus on why go and where to pause.


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
