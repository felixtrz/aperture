# Generic Frame Resource Success Path Migration Plan - 2026-05-17

## Goal

Plan the next small slice after failure-only frame-resource route shell
diagnostics: route successful built-in frame-resource preparation through the
same generic shell internally while preserving successful app report shape,
backend cache keys, draw output, and valid-frame allocation discipline.

This is a planning slice only. It does not change app rendering, resource
preparation, cache summaries, or public diagnostics.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_APP_FRAME_RESOURCE_ADAPTER_MIGRATION_PLAN_2026_05_17.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SHELL_APP_INTEGRATION_PLAN_2026_05_17.md`
- `docs/research/SUCCESSFUL_FRAME_ROUTE_SHELL_REPORTING_POLICY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Current State

The app now has two generic route layers:

- `routeQueuedMaterialPrepare()` validates queue items and built-in family route
  support before frame-resource preparation.
- `createQueuedMaterialFrameResourceRouteShell()` can describe frame-resource
  preparation status with facade queue keys, backend source-version keys, frame,
  source version, pipeline key, family, and diagnostics.

The shell is currently emitted only for frame-resource failures through
`webGpuApp.frameResourceRoute` diagnostics. Successful frames intentionally omit
successful shells from reports to avoid report-shape churn and valid-frame
diagnostic allocation.

## Key Preservation Rule

Any successful-path migration must continue to distinguish:

- facade queue keys from `MaterialQueueItem.meshResourceKey` and
  `.materialResourceKey`;
- backend resource keys from `QueuedBuiltInAppResourceItem.meshKey` and
  `.materialKey`, which are source-handle/version cache keys.

The migration must not substitute facade keys for backend cache keys.

## Proposed Implementation Slice

Add a reusable internal writer around the existing per-family
`adapter.createFrameResources()` call in `prepareQueuedBuiltInFrameResources()`.
The writer should:

1. call the existing family adapter exactly as today;
2. create a `QueuedMaterialFrameResourceRouteShell` into a caller-owned scratch
   object or existing failure-only diagnostic path;
3. preserve failure diagnostics exactly as today;
4. omit successful shells from public reports by default;
5. keep existing successful-frame resource reuse counts unchanged.

The first implementation may stay local to `app.ts` if extracting a new module
would require reshaping large option types. If extracted, keep it in
`packages/webgpu/src/webgpu` and pass only route/item/result data, not raw GPU
resources.

## Tests

Targeted tests should prove:

- successful mixed-family frames still report the same draw count and resource
  reuse counters as before;
- successful route shell data is not serialized into default app reports;
- failed frame-resource preparation still emits `webGpuApp.frameResourceRoute`
  with both key families;
- source-version backend keys remain distinct from facade queue keys;
- no raw GPU-like handles appear in JSON diagnostics.

Suggested commands:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "frameResourceRoute|routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`

## Non-Goals

- No public successful-frame route report field.
- No app report shape change for successful frames.
- No new material family.
- No render graph, IBL, shadow, or multipass work.
- No cache key redesign.
- No replacement of unlit, Matcap, or Standard frame-resource helpers in one
  broad refactor.

## Recommended Follow-Up

Proceed with a focused implementation task that wraps successful and failed
frame-resource preparation through the route shell internally, but only exposes
the shell through existing failure diagnostics.
