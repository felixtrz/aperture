# Generic Built-In Frame-Resource Helper App Integration Plan

Date: 2026-05-17

Task: `task-1016`

## Context

`createQueuedBuiltInFrameResourceViaAdapter()` now proves that built-in family
frame resources can be created and appended through the generic adapter
contract. The app route still calls `adapter.createFrameResources()` and
`adapter.appendFrameResource()` directly inside
`prepareQueuedBuiltInFrameResources()`.

## Reference Anchors Inspected

- Aperture:
  - `packages/webgpu/src/webgpu/app.ts`
  - `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
  - `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
  - `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- Bevy:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
  - `references/bevy/crates/bevy_pbr/src/material.rs`

## Smallest App Integration Slice

Update only the successful append step inside `prepareQueuedBuiltInFrameResources()`:

1. Keep the existing per-item setup intact:
   - pipeline lookup;
   - layout lookup;
   - texture/sampler dependency preparation;
   - existing frame-resource route shell diagnostics.
2. Replace the direct successful append call:
   - current: `adapter.appendFrameResource(resources.resources, buckets)`;
   - planned: call `createQueuedBuiltInFrameResourceViaAdapter()` only after
     the existing `resources` result has already been created would double-call
     resource creation, so do not use it directly here yet.
3. Instead, extract a second helper that accepts an already-created
   `CreateQueuedBuiltInFamilyFrameResourcesResult`:
   - `appendQueuedBuiltInFrameResourceViaAdapter({ adapter, result, buckets })`.
4. Make `createQueuedBuiltInFrameResourceViaAdapter()` delegate to the append
   helper after it creates the result.

This preserves current resource creation order and avoids accidentally creating
buffers/bind groups twice.

## Non-Goals

- Do not change app successful-frame report shape.
- Do not add successful frame-resource route shells to default reports.
- Do not move texture/sampler dependency preparation in this slice.
- Do not rewrite the whole queued built-in app route.
- Do not alter concrete unlit, Matcap, or Standard resource creation helpers.

## Implementation Follow-Up

Proceed with `task-1017`:

- Add `appendQueuedBuiltInFrameResourceViaAdapter()` beside
  `createQueuedBuiltInFrameResourceViaAdapter()`.
- Refactor the test helper to cover both create+append and append-only usage.
- Use append-only helper in `prepareQueuedBuiltInFrameResources()` after the
  existing `resources` result succeeds.
- Preserve existing failure diagnostics and successful-frame output.

Expected validation:

- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts`
- Targeted WebGPU app tests covering `frameResourceRoute` and successful mixed
  built-in routes.
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
