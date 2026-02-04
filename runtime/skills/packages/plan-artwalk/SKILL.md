---
name: plan-artwalk
description: Plan 60-120 minute Artwalk routes as three-scene, three-stop storyboards with clear pacing, optional camera tasks, and a rain/indoor Plan B. Use when a user asks for Artwalk/Citywalk, a "三段分镜" route, a short aesthetic walk (60-120 分钟), or a two-person walk that avoids awkward silence.
---
# 走一条很艺术的路

## Overview

Turn a Citywalk into an Artwalk with a three-scene structure (opening, middle, ending) and exactly three stops that move from busy to calm.

## Inputs To Collect

- Ask for city + starting point + time window + day/time (for opening hours).
- Ask for vibe: quiet architecture / small exhibit / bookstore + objects / restrained random.
- Ask for intensity: walk more or sit more.
- Ask whether two people are walking together.

If key inputs are missing, ask the smallest number of questions needed to proceed.

## Non-Negotiables

- Keep the route to 60-120 minutes and exactly 3 stops.
- Keep each stop to 2 lines: "why stop" + an optional task.
- Include exactly 2 optional camera tasks (no forced photo tasks).
- Provide a Plan B for rain or crowds, preferably indoor.
- Avoid long art-history explanations; focus on where to pause and why.
- Avoid large lists: 2-3 route cards only in the first round.

## Workflow (Two-Stage)

1. **Intake**
   - Confirm city/start/time window/day/time.
   - Ask for vibe and walking intensity if not provided.
2. **Recall candidates**
   - Pull 3-5 candidates across: small exhibit, bookstore, object shop, architecture point.
   - Filter to walkable distances and likely open hours.
3. **First round: 2-3 route cards**
   - Provide 2-3 route cards only.
   - Each card includes: three scene titles, total duration, opening + ending, and a risk note.
4. **User pick + adjust**
   - Ask for "walk more vs sit more" and confirm two-person or solo.
5. **Final plan**
   - Output the three-scene storyboard with 3 stops.
   - Add 2 optional camera tasks.
   - Add a 3-point mini-map (A -> B -> C with walk times).
   - Add Plan B (rain/crowd indoor line).
   - End with a light echo (film title card or one-line exhibit label).
6. **Fallback if data is weak**
   - If hours or pacing cannot be verified, downgrade to an indoor 60-minute line (bookstore + cafe + quiet corner).
   - Mark unverified items explicitly.

## Output Templates

### Route Cards (First Round)

```
[Route 1] <Scene 1 title> → <Scene 2 title> → <Scene 3 title> (80-100 min)
Opening: <where it starts>
Ending: <where it ends>
Risk: <hours/crowds/uncertainty>
```

### Final Plan

```
Opening — <Stop 1 name>
- Why stop: <reason>
- Optional task: <small action>

Middle — <Stop 2 name>
- Why stop: <reason>
- Optional task: <small action>

Ending — <Stop 3 name>
- Why stop: <reason>
- Optional task: <small action>

Camera tasks (optional):
1) <task>
2) <task>

Mini-map:
A -> B (<x min>) -> C (<y min>)

Plan B (rain/crowds):
<indoor three-stop line>

Echo:
<film title / exhibit label line>
```

## Notes On Tone

- Keep language concise, cinematic, and calm.
- Make the route feel safe for two people who do not want to force conversation.

## References

- See `references/examples.md` for sample prompts and outputs.


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
