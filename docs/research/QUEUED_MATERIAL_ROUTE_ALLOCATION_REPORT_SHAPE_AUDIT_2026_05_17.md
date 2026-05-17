# Queued Material Route Allocation Report Shape Audit - 2026-05-17

## Scope

Audit queued material route reporting after the reusable report shell and
failure-only app diagnostic wiring.

The goal is to verify that route report projection does not allocate on the
successful frame path, that JSON output remains payload-safe, and that any
remaining allocation concerns are scoped for follow-up.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/DECISIONS.md`
- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_INTEGRATION_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_MATERIAL_QUEUE_ROUTE_REPORT_SHELL_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_ROUTE_REPORT_SHELL_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/material-queue-route-report-shell.test.ts`
- `test/webgpu/material-queue-route-report-json.test.ts`
- `test/webgpu/material-queue-route-report-diagnostics.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### Report projection stays off the successful path

`collectQueuedBuiltInAppResourceSet()` calls
`createWebGpuAppMaterialQueueRouteReportDiagnostic()` only when the route is
invalid. Successful queued unlit, Matcap, and StandardMaterial frames therefore
do not allocate report JSON or append `webGpuApp.materialQueueRouteReport`
diagnostics by default.

The reusable `WebGpuAppMaterialQueueRouteReportShell` is stored in
`frameScratch.queueRoute.routeReport`, and the shell test verifies that maps,
diagnostic arrays, summary objects, and routed-key storage are reused across
writes.

### Failure projection allocates at an explicit inspection boundary

The failure diagnostic path uses `.map()`, `.flatMap()`, copied diagnostics, and
`webGpuAppMaterialQueueRouteReportShellToJsonValue()`. That projection allocates,
but only after the route has already failed. This matches
`docs/ARCHITECTURE.md`: failure diagnostics may allocate, while a valid frame
should not depend on fresh diagnostic wrappers.

### JSON remains source/GPU payload free

The route report JSON shape contains scalar counts, family/phase buckets,
diagnostic summaries, and sanitized diagnostic fields. Existing tests assert
that route report JSON omits queue item payloads, adapters, source assets,
function values, and GPU-like handle names.

The app route diagnostic is created from scalar `MaterialQueueItem` fields and
copied diagnostic metadata. It does not store source mesh/material assets,
prepared resources, pipelines, bind groups, devices, command encoders, canvas
contexts, or render snapshots.

### Non-report route collection still allocates

The surrounding route collector still allocates per call:

- `const diagnostics: unknown[] = [...queue.diagnostics];`
- `const items: QueuedBuiltInAppResourceItem[] = [];`
- `valid ? { items } : null` for the returned resource set object.

These are not route report allocations, and they predate the report shell, but
they are part of the queued material route hot path. This should be tightened in
a focused follow-up by moving route collector diagnostics and routed items into
`QueuedBuiltInAppRouteScratch`, mirroring the existing reusable maps/lists used
for source assets, pipeline results, mesh resources, and route reports.

## Result

No report-shape boundary drift found.

The queued material route report is still failure-only and JSON-safe. The main
follow-up is allocation cleanup around the route collector's local arrays and
resource-set wrapper, not a change to the route report JSON surface.

## Recommended Follow-Up

Add a narrow `webgpu-render` implementation task to reuse queued material route
collector arrays through `QueuedBuiltInAppRouteScratch`.

Acceptance should prove that:

- route `diagnostics` and routed `items` array identity is reused across
  successful frames;
- failure route reports still include the same JSON-safe diagnostics;
- no source assets, WebGPU handles, or adapters are exposed by the reused route
  state.
