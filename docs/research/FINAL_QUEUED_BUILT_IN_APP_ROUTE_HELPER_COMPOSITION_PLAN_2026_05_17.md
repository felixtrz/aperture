# Final Queued Built-In App Route Helper Composition Plan

Date: 2026-05-17

Task: `task-1033`

## Context

The queued built-in app route now has named helpers for:

- texture/sampler dependency preparation;
- frame-resource option assembly;
- appending valid frame resources through the generic adapter helper.

`prepareQueuedBuiltInFrameResources()` still owns the correct orchestration and
should remain the app-level loop for now.

## Reference Anchors Inspected

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`

## Recommendation

Do not extract a larger composition helper yet. The app loop is now readable
enough that the next implementation should move only if there is a concrete
diagnostic or allocation need.

Recommended next useful slice:

- Add a targeted regression that proves the new helpers do not change successful
  mixed built-in app output, failure route diagnostics, or resource reuse counts
  across two frames.

This gives a stronger safety net before moving more logic behind generic route
composition.

## Non-Goals

- Do not rewrite `prepareQueuedBuiltInFrameResources()`.
- Do not add default successful route diagnostics.
- Do not change resource reuse report fields.
- Do not move beyond built-in material families.

## Implementation Follow-Up

Add a new ready task:

```md
### task-1034 — Add queued built-in helper composition regression

Category: `webgpu-render`
Package/write-scope: `test/webgpu/webgpu-app.test.ts` or a nearby focused
WebGPU app test file, plus targeted validation.
Reference anchor:
Plan from `task-1033`, `prepareQueuedBuiltInFrameResources()`, and existing
frameResourceRoute/mixed built-in route tests.

Acceptance criteria:

- Test proves successful mixed built-in output remains unchanged after helper
  extraction.
- Test proves failure route diagnostics still include `webGpuApp.frameResourceRoute`.
- Test proves resource reuse counts still reflect expected cache reuse across
  two frames.
```
