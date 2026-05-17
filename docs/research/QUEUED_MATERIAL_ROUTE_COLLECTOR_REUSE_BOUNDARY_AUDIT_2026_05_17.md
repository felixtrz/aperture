# Queued Material Route Collector Reuse Boundary Audit - 2026-05-17

## Scope

Audit queued built-in material route collector reuse after moving route
diagnostics, routed items, and the resource-set wrapper into reusable scratch.

The goal is to verify that the reused arrays remain WebGPU-local current-frame
scratch, do not become source of truth, and do not change failure route report
JSON safety.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/DECISIONS.md`
- `docs/research/QUEUED_MATERIAL_ROUTE_ALLOCATION_REPORT_SHAPE_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/reusable-route-collector.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/webgpu/reusable-route-collector.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### Route collector arrays are scratch-owned

`QueuedBuiltInAppRouteScratch` now owns a `routeCollector` with:

- a reusable `items` array;
- a reusable `diagnostics` array;
- a stable `resourceSet` wrapper that points at the same `items` array.

`collectQueuedBuiltInAppResourceSet()` resets that collector at the start of
each queued route collection, appends current-frame route diagnostics and routed
items, and returns the stable resource-set wrapper only when the route is valid.

The local per-call allocations for route `diagnostics`, routed `items`, and
`{ items }` resource-set wrapping have been removed from the successful route
collector path.

### Scratch does not become authoritative state

The collector is scoped to WebGPU app frame scratch. It is cleared before each
collection and is consumed immediately by queued built-in resource preparation.
It does not replace ECS state, `RenderSnapshot`, asset registry state,
prepared-resource stores, render-world state, or backend GPU caches.

The collector may temporarily hold current-frame routed item objects that refer
to adapters, source assets, and draw packets for resource preparation. Those
objects are not diagnostics, are not JSON-projected, and are not exposed through
the public app report.

### Failure route reports remain sanitized

Failure route reports still flow through
`createWebGpuAppMaterialQueueRouteReportDiagnostic()`, which converts queue and
routed items to scalar summaries before writing the reusable route report shell.

Existing focused app tests still cover unsupported families, unsupported
alpha-test/transparent routes, blend diagnostics, asset mismatch diagnostics,
route report shell reset behavior, and successful queued built-in frames without
route report diagnostics.

### Test coverage proves reusable identity

`test/webgpu/reusable-route-collector.test.ts` verifies that reset preserves
item array, diagnostic array, resource-set wrapper, and `resourceSet.items`
identity across writes.

Focused WebGPU app route tests passed with the collector wired into `app.ts`,
proving the successful route and failure report behavior is unchanged.

## Result

No ownership or JSON boundary drift found.

The next useful backlog work should move back to report/queue integration
planning before adding more successful-frame diagnostics, because the immediate
route collector allocation issue is resolved.
