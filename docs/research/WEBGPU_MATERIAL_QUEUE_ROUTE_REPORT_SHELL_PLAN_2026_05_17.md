# WebGPU Material Queue Route Report Shell Plan - 2026-05-17

## Scope

Plan a reusable route report shell for future successful-frame route reporting
without adding steady-state allocation to the WebGPU app hot path.

This is a planning slice only. It does not change runtime behavior or public
APIs.

## References Inspected

- `docs/ARCHITECTURE.md` frame hot-path allocation guidance
- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_INTEGRATION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Reference Pattern

Three.js reuses render item objects and clears phase arrays each frame.
PlayCanvas keeps visible opaque/transparent instance arrays on layers and sorts
those derived lists. The useful common pattern is reusable derived lists and
phase buckets; Aperture should keep the source of truth in ECS and snapshots,
then write scalar route summaries into caller-owned WebGPU scratch.

## Current State

`createWebGpuAppMaterialQueueRouteReport` is appropriate for tests and
failure-only diagnostics. It allocates maps, sets, arrays, and copied diagnostic
objects. `app.ts` therefore calls it only when route validation fails.

The current successful path proves route behavior through draw resources and
frame reports, but it does not expose route summary counts.

## Proposed Shell

Add an internal mutable shell beside the existing route scratch:

```ts
interface WebGpuAppMaterialQueueRouteReportShell {
  valid: boolean;
  queueItemCount: number;
  routedItemCount: number;
  skippedItemCount: number;
  readonly byFamily: Map<string, MutableBucketSummary>;
  readonly byPhase: Map<string, MutableBucketSummary>;
  readonly diagnosticSummary: MutableDiagnosticSummary;
}
```

Add helper functions:

- `createWebGpuAppMaterialQueueRouteReportShell()`
- `resetWebGpuAppMaterialQueueRouteReportShell(shell)`
- `writeWebGpuAppMaterialQueueRouteReportShell(input, shell)`
- `webGpuAppMaterialQueueRouteReportShellToJsonValue(shell, diagnostics?)`

The writer should update counts in place from route-item scalar data. JSON
projection can allocate because it is an explicit inspection boundary.

## App Scratch Placement

Extend `QueuedBuiltInAppRouteScratch` with one report shell:

```ts
readonly routeReport: WebGpuAppMaterialQueueRouteReportShell;
```

Do not store raw queue items, `MeshDrawPacket`s, adapters, source assets,
prepared resources, pipelines, bind groups, or GPU handles in the shell.

If per-item route details are needed later, store only scalar summaries in
reused arrays and make JSON projection opt-in.

## Validation Plan

- Allocation-focused unit test: write two frames into the same shell and assert
  the shell object and bucket maps are reused.
- JSON test: projection omits functions, source assets, and GPU-like handles.
- App test: successful queued unlit/matcap/StandardMaterial frame can include a
  route summary only when an explicit diagnostics option is added later.
- Failure test: existing failure-only aggregate report remains unchanged until
  the app intentionally switches to the shell writer.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Non-Goals

- Do not add route reports to successful app frames by default.
- Do not expose the mutable shell as public API.
- Do not move material routing into ECS or render extraction.
- Do not add GPU resource references to report data.
- Do not change queue sorting, supported families, phase support, or draw
  submission.

## Recommended Implementation Slice

Add the shell and unit tests inside `packages/webgpu/src/webgpu`, but keep
`app.ts` on the current failure-only report path until a separate task adds an
explicit diagnostics option for successful route summaries.
