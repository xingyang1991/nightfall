---
name: plan-architecture-citywalk
description: Design non-academic architecture citywalk routes that teach how to observe buildings (proportion, material, corner). Use when a user asks for an architect-led or style-led citywalk, wants 3 stops with 3 observation prompts per stop, or wants a simple "how to look at buildings" walk without academic history.
---
# 建筑控路线

## Overview
Enable a two-stage citywalk plan: offer a small set of themed 3-stop routes, then finalize one route with 3 observation prompts per stop plus a one-stop fallback.

## Inputs to Collect
- City/area, date/time window, walking pace, mobility constraints.
- Preference: follow an architect, follow a style, or "not sure".
- Scope: 1 stop or 3 stops.

If preference is "not sure", ask for a quick vibe pick. Provide 6 short facade vibes and let the user choose 1-2 (or let them share reference photos).

## Workflow (Two-Stage)

### Stage A: Shortlist
Produce 2-3 route cards only (no big list).

Each route card includes:
- Theme name
- Keywords
- Total time estimate
- 3 stops (names or types)
- One-line reason it fits the theme

### Stage B: Finalize
Once the user picks a route, output:
- 3-stop route order (or 1-stop if requested)
- For each stop: 3 observation prompts (proportion, material, corner) and a one-sentence memory hook
- Observation cheat sheet (the 3 lenses and how to do a 30-second scan)
- Plan B: 1-stop version + nearest sit/coffee spot
- Practical notes: transit/entry notes if relevant and safe

## Observation Prompts (Fixed Lenses)
Keep exactly 3 per stop, always:
1. Proportion: scale, rhythm, grid vs. mass, tall vs. wide.
2. Material: surface, texture, joinery, aging, light response.
3. Corner: how the building turns; edge treatment; openness vs. closure.

Vary wording per stop but keep the same lenses.

## Guardrails
- Do not write academic history or long research.
- Do not include dangerous or inaccessible locations.
- Do not exceed 3 observation points per stop.
- The route should still work if only 1 stop is visited.

## Fallbacks
- If real points are insufficient: switch to a shopfront/typography/transition-space observation walk using the same lenses.
- If data is uncertain: ask for user-supplied candidate locations and apply the observation framework.

## Data/Tools (If Available)
- ArchitectureIndex for candidate sites.
- RoutePlanner for walk order and time.
- Public facade reference images only if needed for vibe selection.

## Output Format
Use compact route cards for Stage A and a guide card for Stage B with:
- route list
- observation prompts per stop
- cheat sheet
- Plan B

## Acceptance Checks
- User can repeat the 3-lens method after the walk.
- The 1-stop version is provided.


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
