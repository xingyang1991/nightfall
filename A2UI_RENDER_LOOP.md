# A2UI Rendering Loop (Nightfall Orchestrator PoC)

This build converts the Nightfall UI into an **A2UI-style render loop**:

- **Backstage** (orchestrator / skills / tools) emits **messages**
- **Frontstage** (renderer) consumes messages to render **surfaces**
- Users interact with the surfaces; interactions emit **userAction** events back to backstage
- Backstage responds with more messages (update UI + data model)

## Concepts

### Surface
A surface is a named UI canvas: `tonight`, `discover`, `sky`, `pocket`, `whispers`, `radio`.

Each surface has:
- `components`: an adjacency list (id → component spec)
- `rootId`: which component id to render as the root
- `dataModel`: key/value store (typed A2UI values converted to plain JS)

### Messages
Supported message types (see `a2ui/messages.ts`):
- `surfaceUpdate`: replace the component graph for a surface
- `beginRendering`: set the root component id for a surface
- `dataModelUpdate`: update surface data by key
- `deleteSurface`: remove a surface

### Renderer
`a2ui/renderer.tsx` renders components by looking up their type in a **catalog**.
Unknown component types are rejected (fail-closed) so the UI stays controllable.

### Orchestrator
`a2ui/orchestrator.ts` is the PoC "stage manager".
It listens to `userAction`s and replies with A2UI messages.

Later you can replace this with:
- a Skills runtime
- a tool-calling agent
- your own policy + reliability layer

## Add a new surface

1) Create a program function in `a2ui/programs.ts` that returns:
- `surfaceUpdate`
- `dataModelUpdate`
- `beginRendering`

2) In `orchestrator.bootstrap()`, call `applyMessages(programNewSurface(context))`.

3) In `App.tsx`, display it using:
```tsx
<SurfaceView surfaceId="your_surface_id" />
```

## Add a new component type

1) Add a new `case` in the switch inside `a2ui/renderer.tsx`.
2) Keep it **pure** (render-only) when possible.
3) If it needs to emit actions, call `onAction('ACTION_NAME', payload)`.

## Hook up real skills / tools

The orchestrator is intentionally minimal:
- Replace `getCuratedEnding()` with your own Skills executor
- Have the Skills runtime return a bundle (your domain data model)
- Convert bundle → A2UI messages:
  - use `programTonightResult(context, bundle)`
  - or build a new `surfaceUpdate` if the UI layout should change

## Why this matters
This lets you keep a tight grip on:
- **UI density budget**
- **tone + style envelope**
- **privacy guardrails**
- **reliability / Plan-B policies**

…while still letting your AI/skills operate backstage.
