# WebGPU App Material Queue Route Report Integration Plan - 2026-05-17

## Scope

Plan the smallest safe wiring of
`createWebGpuAppMaterialQueueRouteReport` into `createWebGpuApp` frame
diagnostics.

This is a planning slice only. It does not change runtime behavior, render
output, queue sorting, pipeline creation, resource preparation, draw submission,
or public app API shape.

## References Inspected

- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_MATERIAL_QUEUE_ROUTE_REPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Reference Pattern

Three.js keeps reusable render items and phase buckets, then sorts opaque and
transparent buckets separately. PlayCanvas layers keep culled opaque and
transparent instance arrays and apply phase-specific sort policies.

Aperture should borrow the reusable-list and phase-bucket idea, not the scene
object model. The WebGPU app route already derives queue items from
`RenderSnapshot` and stores intermediate route state in `frameScratch`; route
report integration should project that derived state into JSON-safe diagnostics
without retaining source assets, adapters, or GPU handles.

## Current Aperture Route

`collectQueuedBuiltInAppResourceSet` currently:

1. indexes source mesh and material assets into scratch maps;
2. writes `MaterialQueueItem`s into `frameScratch.materialQueue`;
3. emits queue diagnostics from `writeMaterialQueueFromSnapshot`;
4. looks up the built-in adapter by material family;
5. emits unsupported family, phase, blend, and asset-mismatch diagnostics;
6. returns a valid `QueuedBuiltInAppResourceSet` when every queue item routed.

`createQueuedBuiltInFrameResources` then:

1. clears route scratch arrays and maps;
2. prepares/reuses pipelines, texture/sampler resources, and frame resources;
3. appends successful resources into `unlit`, `matcap`, and `standard` buckets;
4. returns resource diagnostics from pipeline, texture, and frame-resource
   preparation.

The existing route report helper can summarize the first route stage today. It
needs a small scratch/report shell before being used in the frame path.

## Proposed Scratch Changes

Add report-oriented reusable scratch to `QueuedBuiltInAppRouteScratch`:

```ts
readonly routeReportQueueItems: WebGpuAppMaterialQueueRouteQueueItem[];
readonly routeReportRoutedItems: WebGpuAppMaterialQueueRouteRoutedItem[];
readonly routeReportDiagnostics: WebGpuAppMaterialQueueRouteDiagnostic[];
```

Each array is cleared at the start of `collectQueuedBuiltInAppResourceSet`.

During queue iteration:

- Push one queue summary per `MaterialQueueItem`.
- Push one routed summary only after the item passes adapter lookup,
  phase/blend validation, source asset lookup, and material kind/type checks.
- Push diagnostic summaries for unsupported family, phase/blend, asset mismatch,
  and queue diagnostics.

Do not store `MaterialQueueItem`, adapter objects, `MeshDrawPacket`, source
assets, prepared resources, pipelines, bind groups, or GPU handles in the report
scratch.

## Proposed Report Shell

The existing `createWebGpuAppMaterialQueueRouteReport` allocates maps and arrays.
Keep that helper as a test and failure-report projection first.

For app integration, add one of these two narrow options:

- Option A: create a route report only on route failure and include it in the
  failed `renderReport` diagnostics.
- Option B: add a reusable writer that fills a caller-owned report shell, then
  expose a JSON copy only when requested by diagnostics.

Start with Option A. It avoids success-path allocations while still explaining
unsupported family, unsupported phase/blend, and asset mismatch failures. Option
B should wait until route report data is needed in successful frame reports.

## Diagnostic Placement

On route failure, append one diagnostic object after the existing route
diagnostics:

```ts
{
  code: "webGpuApp.materialQueueRouteReport",
  report: webGpuAppMaterialQueueRouteReportToJsonValue(routeReport),
  message: "WebGPU app material queue routing failed."
}
```

The report diagnostic should include only scalar counts, family/phase buckets,
diagnostic summaries, and copied route diagnostic fields. It must not include
raw queue items, assets, adapters, or GPU handles.

Keep existing specific diagnostics in the top-level diagnostics array so current
tests and user-facing failures continue to work.

## Successful Path

Do not allocate a report on the common successful route path in the first
implementation. If successful report visibility becomes necessary, add a
caller-owned route report shell plus focused allocation tests before adding it to
`renderReport`.

Successful unlit, matcap, and standard paths should continue to prove behavior
through existing frame reports and draw-resource diagnostics.

## Focused Validation

Add or update tests for:

- unsupported material queue family includes the existing specific diagnostic
  and one JSON-safe route report diagnostic;
- unsupported alpha-test family includes a route report with one queued item,
  zero routed items, and family/phase skipped counts;
- unsupported transparent blend preset includes the blend preset in the copied
  diagnostic;
- successful unlit, matcap, and standard queued paths do not add a route report
  diagnostic by default;
- route report diagnostic JSON stringifies without functions, source assets, or
  GPU-like handles.

Run:

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts --testNamePattern "unsupported material queue families|unsupported alpha-test material queue families|unsupported transparent material queue families"`
- focused successful queued built-in app tests covering unlit, matcap, and
  standard paths;
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/material-queue-route-report-json.test.ts test/webgpu/material-queue-route-report-diagnostics.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Non-Goals

- No new material family support.
- No change to material queue sorting or phase ordering.
- No route report allocation on successful frame renders in the first slice.
- No GPU resource creation in route report helpers.
- No ECS or render extraction imports in WebGPU route report projection.
- No WebGL fallback or scene-graph routing.

## Recommended Implementation Slice

Next task: add route report scratch arrays and failure-only route report
diagnostic emission to `collectQueuedBuiltInAppResourceSet`.

Acceptance criteria:

- Existing route diagnostics remain present and unchanged.
- Route failures include one JSON-safe aggregate report diagnostic.
- Successful queued built-in paths do not emit route report diagnostics by
  default.
- Focused unsupported-family, unsupported-phase/blend, and successful queued
  material tests pass.
