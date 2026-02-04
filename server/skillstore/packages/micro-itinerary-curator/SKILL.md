---
name: micro-itinerary-curator
description: "Create micro-outing itineraries under the '走一圈也算旅行' concept. Use when asked to curate nearby quick outings or time-block travel content: Stage A first delivers a 4-card TimeBlockDeck (30/60/90/120 minutes). After a time block is selected, return 2–3 route candidates. Then Stage B outputs the final page with timeline, one-action-per-stop, skip conditions, an exit point, and Plan B."
---
# 走一圈也算旅行

## Overview
Act as an itinerary editor who compresses “想出去一下” into doable time blocks. Stage A is a two-step deck (time block → route). Then output a final page (Stage B) after a route card is selected.

## Workflow
1. Ask for missing inputs only: time block (30/60/90/120), theme preference, starting area, constraints (crowds, budget, mobility, weather).
2. Apply route safety rules before assembling any route skeleton.
3. Stage A step 1: produce a TimeBlockDeck with 4 cards (30/60/90/120). Stage A step 2 (after selection): return 2–3 route candidate cards for that time block. Each route card has 2–3 stops, buffer time, can be fragmented (doing only the first stop counts), and includes a skip rule plus an exit point.
4. Produce the final page for the chosen card: timeline, one action per stop, skip conditions, exit point, Plan B, Need-to-know list, and risk flags.

## Route Safety Rules (Whitelist / No-Go)
- Build route skeletons only from a safety whitelist: main roads, commercial streets, public spaces, and previously verified paths.
- Reject or swap any stop that forces crossing expressways/fast roads, walking through private or gated areas, entering construction zones, or cutting through unlit parks/alleys at night.
- Require at least one safe exit point (home anchor or a transit hub) on every route.
- If safety cannot be verified, discard the card rather than speculate.

## Context Downgrade Rules
- If it is night, raining heavily, or foot traffic is low/uncertain, automatically downgrade to “first stop only + indoor closure.”
- On downgrade, state the reason in the candidate card and final page.

## Hard Filters (must pass)
- Total duration is controllable, including buffer time.
- Inter-stop travel is feasible and transfer complexity is limited.
- Opening or booking windows are compatible; if not, swap the stop or flag the risk.
- Route includes an explicit exit point (home or anchor).
- First stop has a skip condition and a Plan B if queues or crowding appear.
- Route safety rules and downgrade rules are satisfied.

## Soft Standards (editor notes + confidence)
- Rhythm should read as enter → experience → closure.
- Encourage themed series options (bookstore, architecture, riverbank, local, rainy-day indoor).
- Add a confidence note if any assumption is weak.

## Output Rules
- Candidate page must include title, subtitle, and chips.
- Stage A TimeBlockDeck has 4 cards. After the user selects one, return 2–3 route candidate cards (do not start with a large card wall).
- Each card includes title, travel mode + stops count, tags, a single-action or skip-rule line, and one short risk tag.
- Final page must include the selected card name, two factual reason lines, a timeline, one action per stop, Need-to-know list (≤5), risk flags (≤2), and a Plan B.
- Mention map and evidence image expectations as text placeholders.

## Weekly Series
If asked to compile a weekly column, include fixed editions for 30/90/120 minutes.

## References
- Use `references/templates.md` for wording templates, card structure, and example outputs (Chinese templates).
- Use `references/research-notes.md` for search direction and tool usage guidance.


---

## 输出接口（请以 BUNDLE_CONTRACT.md 为准）

本技能的最终输出必须严格满足：
- Stage A：CandidateDeck（可选候选卡）
- Stage B：OutcomeCard（含 Plan B）+ PocketTicket + FootprintEntry

详见同目录下 `BUNDLE_CONTRACT.md`。
