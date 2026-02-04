---
name: plan-micro-exhibit-stop
description: Plan a 10–20 minute micro-exhibit/installation stop along a user's route with a main + backup candidate and a final on-site micro-plan (where to stand, what to look for, one photo reason, Plan B). Use when users ask for 顺路看展, 微展/装置, “10分钟就走”, “路上想看点东西”, or a quick cultural stop.
---
# 顺路看个小展

## Overview

Provide a “one-bite culture” stop: pick one nearby micro-exhibit/installation that fits the route and constraints, then deliver just-enough on-site guidance for a 10–20 minute visit.

## Inputs To Collect

- Ask for city + current location or route (start → end) + time window + day/time.
- Ask for constraints: indoor/outdoor, no-ticket/no-reservation, and 5/10/20 minutes.
- Ask for acceptable detour (minutes or meters).
- Ask for vibe if needed: quiet / playful / architecture / object-focused.

If key inputs are missing, ask the smallest number of questions needed to proceed.

## Non-Negotiables

- Offer only 2 candidates in the first round: main + backup.
- Keep each candidate “10 minutes and leave” feasible (fast in/out, easy exit).
- Prefer free and no-reservation points. If ticketed or reservation-only, label clearly and avoid unless the user allows.
- Avoid long exhibit lists and art-history explanations.
- Always include a Plan B in the final plan.
- If hours or access are unverified, mark uncertainty explicitly.

## Workflow (Two-Stage)

1. **Intake**
   - Confirm city/route/time window.
   - Confirm indoor/outdoor + duration + no-ticket requirement.
2. **Recall candidates**
   - Use map search and local listings to recall micro exhibits, installations, bookstore/gallery corners, or small public art.
   - Filter by route proximity, quick access, and likely open hours.
3. **First round: 2 candidates only**
   - Provide main + backup with duration and access threshold.
   - Ask the user to pick one or adjust constraints.
4. **Final plan**
   - Provide location + arrival cue (exit/landmark) + standing spot suggestion.
   - Provide what to look for (1–2 cues).
   - Provide a “拍一张理由” (single photo reason/shot).
   - Provide quick leave path and Plan B.
5. **Fallback when no micro-exhibit exists**
   - Downgrade to a transitional-space observation task (station concourse, underpass, plaza, lobby).
   - Keep it 10 minutes and label as fallback.

## Output Templates

### First Round (Main + Backup)

```
[主选] <地点名>（<10/15/20 分钟>，<免费/无需预约>）
- 亮点：<一行理由>
- 风险：<营业时间/不确定性>

[备选] <地点名>（<10/15/20 分钟>，<免费/无需预约>）
- 亮点：<一行理由>
- 风险：<营业时间/不确定性>

你选哪一个？或要改成室内/室外/更短停留？
```

### Final Plan (After User Picks)

```
地点：<名称 + 片区>
到达：<地铁口/路口/地标> → <步行分钟>
站位建议：<具体站点或角度>
看什么：<1-2 个观察线索>
拍一张理由：<一个明确画面/构图>
停留：<分钟>
快速离开：<离开方向或下一段路径>
Plan B：<备选或过渡空间观察任务>
```

## Tone

- Keep output concise and practical, one-screen length.
- Match the user’s language; default to Chinese if not specified.


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
