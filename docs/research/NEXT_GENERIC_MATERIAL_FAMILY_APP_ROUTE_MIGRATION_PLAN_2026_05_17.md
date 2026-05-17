# Next Generic Material-Family App Route Migration Plan

Date: 2026-05-17

Task: `task-1026`

## Context

The queued built-in app route now uses an append-only generic helper for the
successful frame-resource bucket append step. The remaining app route still has
family-specific texture/sampler dependency preparation and frame-resource
creation option construction inside `prepareQueuedBuiltInFrameResources()`.

## Reference Anchors Inspected

- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/webgpu-app.test.ts`
- Bevy render phase/material preparation patterns in
  `references/bevy/crates/bevy_render/src/render_phase/mod.rs` and
  `references/bevy/crates/bevy_pbr/src/material.rs`.

## Recommended Slice

Do not move the entire app route yet. The smallest useful next step is to
extract the repeated frame-resource option assembly into a named helper:

```ts
createQueuedBuiltInFrameResourceOptions({
  app,
  cache,
  item,
  snapshot,
  textureSamplerDependencies,
  viewUniforms,
  worldTransforms,
  layouts,
  reuse,
});
```

Then `prepareQueuedBuiltInFrameResources()` can call:

```ts
const frameOptions = createQueuedBuiltInFrameResourceOptions(...);
const resources = adapter.createFrameResources(frameOptions);
```

This keeps resource creation order unchanged but makes the adapter call surface
explicit and easier to migrate behind a generic route later.

## Non-Goals

- Do not change successful-frame report shape.
- Do not allocate successful route shells.
- Do not move texture/sampler dependency preparation yet.
- Do not change family-specific resource creation helpers.
- Do not merge prepared facade and backend cache summaries.

## Implementation Follow-Up

Add a new ready task:

```md
### task-1028 — Extract queued built-in frame-resource option helper

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`, targeted app tests,
and WebGPU typecheck.
Reference anchor:
Plan from `task-1026`, `prepareQueuedBuiltInFrameResources()`, and generic
built-in app resource adapter helpers.

Acceptance criteria:

- Frame-resource option assembly is isolated in a named helper.
- Existing app route behavior and diagnostics remain unchanged.
- Targeted frameResourceRoute and mixed built-in app tests pass.
```
