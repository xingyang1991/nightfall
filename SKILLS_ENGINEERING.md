# Nightfall “Skills-Ready” Engineering Shape (PoC)

This repo is now split into three conceptual layers:

## 1) Host Shell (UI chrome)
**Files:** `App.tsx`, `components/StarMap.tsx`, overlays, navigation
- Owns *global* visual identity + Style Envelope CSS variables.
- Chooses which `surfaceId` to display (Tonight / Discover / Sky / Pocket).
- Executes **side effects** (open overlays, open external navigation, focus mode).

## 2) A2UI Runtime + Renderer
**Files:** `a2ui/store.tsx`, `a2ui/renderer.tsx`, `a2ui/messages.ts`, `a2ui/bindings.ts`
- Holds per-surface component graph + data model.
- Renders only the allowlisted component catalog.
- Dispatches `userAction` back to the host shell.

## 3) Production-shaped “Backstage Engine”
**Files:** `runtime/nightfallEngine.ts`, `runtime/skillRuntime.ts`, `runtime/skills/*`
- Routes user actions to a **SkillRuntime**.
- Converts **domain outputs** into A2UI message streams using templates in `a2ui/programs.ts`.
- Emits *effects* (enter focus, open whispers, open external link) rather than directly mutating UI.

> In production, Layer 3 moves server-side. Layer 1+2 stay client-side.

---

# What is a “Skill” in this repo?

A skill is a module implementing:

- a `manifest` (permissions, intents, allowed surfaces)
- a `run()` function that returns a `SkillResult`

**Contracts:** `runtime/contracts.ts`

## Current built-in skills
- `tonight_composer` (LLM-backed, calls Gemini to produce a `CuratorialBundle`)
- `whispers_note` (deterministic, appends a hallway note)

Registry: `runtime/skills/registry.ts`

---

# Permissions + audit (the minimum viable safety spine)

## Tool permissions
A skill must declare `permissions.tools[]` in its manifest.
At runtime, `ToolBus` enforces the allowlist and records tool calls:

- `runtime/toolbus/toolBus.ts`
- `runtime/audit/audit.ts`

> In production, this becomes server-enforced + signed policy.

## Output policy (density + guardrails)
All skill bundles pass through a *domain policy* clipper:

- `runtime/policy/bundlePolicy.ts`

Examples:
- checklist max 5 lines
- risk flags max 2
- ambient tokens max 4
- candidate pool max 18
- ensure Plan B has action + label

---

# How “skills” connect to A2UI (recommended path)

**Recommendation:** skills output domain bundles (Outcome bundles), not raw UI.

Flow:
`Skill -> CuratorialBundle -> A2UI program/template -> surface messages`

Why:
- consistent aesthetic & density budgets
- easier QA and regression testing
- prevents “UI drift” across skills

If you want a skill to output raw A2UI patches:
- use `SkillResult.patches[]` sparingly
- keep a strict component allowlist catalog

---

# How to add a new skill (PoC)
1. Create a file under `runtime/skills/builtin/<yourSkill>.ts`
2. Export a `Skill` with:
   - `manifest`
   - `run(req, ctx, tools)`
3. Register it in `runtime/skills/registry.ts`
4. Route an existing action (or add a new one) in `runtime/nightfallEngine.ts`

---

# Next milestones to make it “real”
1. **Move runtime server-side**
   - create `/api/bootstrap` and `/api/action` endpoints
   - client orchestrator becomes API client
2. **Session state persistence**
   - session token + server session store (Redis / KV)
   - pocket + footprints persisted per user
3. **Real tool integrations**
   - Places/Hours/Queue risk (Gaode/Tencent/Maps)
   - Parking signals (POI tags + user feedback flywheel)
4. **Policy expansion**
   - privacy redaction, hate/self-harm filters, location blur
   - rate-limit whispers + “no direct chat” enforcement
