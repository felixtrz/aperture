# Internal Frame Resource Route Shell Boundary Audit - 2026-05-17

## Scope

Audit `task-0989`, which extracted a named internal wrapper for creating
frame-resource route shells inside the WebGPU app frame-resource preparation
path.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_MIGRATION_PLAN_2026_05_17.md`
- `docs/research/GENERIC_FRAME_RESOURCE_SUCCESS_PATH_PLAN_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/webgpu-app.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`

## Findings

The implementation is boundary-safe:

- `createQueuedBuiltInFrameResourceRouteShell()` is an app-local wrapper around
  `createQueuedMaterialFrameResourceRouteShell()`.
- It keeps facade queue keys on `item.prepareRoute` and backend source-version
  keys on `item.meshKey` / `item.materialKey`.
- It does not change when unlit, Matcap, or Standard frame-resource helpers run.
- It does not change successful app report shape; the successful mixed-family
  regression still proves `webGpuApp.frameResourceRoute` diagnostics are absent
  from valid frames.
- It does not alter texture/sampler preparation, pipeline creation, bind group
  layout selection, retained cache summaries, draw submission, or resource reuse
  counters.

## Architecture Check

The wrapper remains inside the WebGPU backend/app facade and consumes data
already derived from render snapshots and built-in material adapters. It does
not make ECS state renderer-owned, does not query ECS, does not expose raw GPU
handles, and does not introduce scene-graph state.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "frameResourceRoute|routes scalar and textured StandardMaterial queue items with unlit and matcap draws"`
- `pnpm exec vitest run test/webgpu/queued-material-frame-resource-route.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`

No corrective follow-up is required for `task-0989`.
