# Generic Material-Family Preparation Handoff Implementation Plan

Date: 2026-05-17

Task: `task-1010`

## Context

The current architecture has the pieces needed for a generic handoff, but the
WebGPU app still contains family-specific frame-resource routing in the hot path:

- `MaterialQueueItem` carries material family, pipeline key, mesh/material
  resource keys, and draw metadata.
- `routeQueuedMaterialPrepare()` validates a queued material against a registered
  family adapter and returns a JSON-safe route shell.
- `QueuedBuiltInAppResourceAdapter` composes built-in queue validation with
  texture/sampler preparation, frame-resource creation, and family bucket
  append callbacks.
- Successful-frame route shells are intentionally omitted from default app
  reports to preserve current report shape and avoid extra valid-frame
  allocation.

The next implementation should reduce family-specific branching without moving
source ownership or backend cache ownership.

## Reference Anchors Inspected

- Aperture:
  - `packages/render/src/rendering/material-queue.ts`
  - `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
  - `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
  - `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- Bevy:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
  - `references/bevy/crates/bevy_pbr/src/material.rs`
  - `references/bevy/crates/bevy_pbr/src/material_bind_groups.rs`

Common pattern: queue/phase code should consume prepared render assets through a
family/material abstraction, while concrete GPU resources remain renderer-owned
and source ECS/assets remain authoritative elsewhere.

## Smallest Implementation Slice

Add a helper in `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
that drives frame-resource creation through `QueuedBuiltInAppResourceAdapter`
instead of direct family-specific branching.

Suggested helper shape:

```ts
createQueuedBuiltInFrameResourceViaAdapter({
  adapter,
  frameOptions,
  buckets,
});
```

Expected behavior:

- Calls `adapter.createFrameResources(frameOptions)`.
- If the result is valid and contains resources, calls
  `adapter.appendFrameResource(result.resources, buckets)`.
- Returns a compact JSON-safe result with `valid`, `status`, `family`, and
  diagnostics.
- Does not expose raw resource objects in the returned shell.
- Does not change app successful-frame report shape yet.

This is intentionally a helper/test slice. It should prove that built-in
resource creation can be driven by the generic adapter contract before rewiring
the larger app loop.

## Non-Goals

- Do not rewrite `prepareQueuedBuiltInFrameResources()` wholesale.
- Do not add successful route shells to every app report.
- Do not merge facade prepared summaries with backend cache summaries.
- Do not change concrete unlit, Matcap, or Standard resource creation helpers.
- Do not add new material families.

## Implementation Follow-Up

Proceed with `task-1011`:

- Add the helper and focused tests in the existing
  `built-in-material-app-resource-adapter` test file or a nearby targeted file.
- Use fake resources/options to prove all built-in families can append through
  the same adapter method.
- Prove invalid frame-resource results do not append resources and keep
  diagnostics JSON-safe.

Expected validation:

- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
