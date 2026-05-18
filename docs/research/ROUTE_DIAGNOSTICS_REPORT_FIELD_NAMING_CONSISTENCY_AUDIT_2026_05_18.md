# Route Diagnostics Report Field Naming Consistency Audit

Date: 2026-05-18

Task: `task-1556`

## Scope

Audit whether material queue route diagnostics consistently expose nested route
reports under `report` versus `routeReport`, and whether the tested JSON shape
leaks routed resources or raw GPU handles.

## References Inspected

- `docs/DECISIONS.md` decision 0010
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

- Public diagnostics consistently emit route report payloads as:

  ```ts
  {
    code: "webGpuApp.materialQueueRouteReport",
    message: "...",
    report: { ... }
  }
  ```

- `QueuedMaterialAppRouteReportDiagnostic` explicitly names the nested payload
  `report`, and `createQueuedMaterialAppRouteReportDiagnostic()` writes the
  JSON-safe route shell into that field.
- Consumers in `packages/webgpu/src/webgpu/app.ts` and route tests read the
  public diagnostic through `candidate.report`.
- `routeReport` remains an internal scratch field on
  `QueuedBuiltInAppRouteCollectorScratch`; it identifies the reusable shell, not
  a public diagnostic JSON property.
- Older research notes use names such as `routeReportQueueItems` and
  `routeReportDiagnostics` as planning/internal terminology. Those names are not
  emitted diagnostics and do not create a public field-name conflict.
- The current tests assert no raw GPU handles or routed resource objects leak
  through route failure diagnostics. The unknown-family regression also asserts
  `resourceSet` stays null when route collection fails.

## Recommendation

Keep the public field name as `report`. It matches the wider renderer
diagnostic convention where diagnostic entries contain a nested `report` object,
and the current route-report tests document that shape.

Do not add a `routeReport` compatibility field now. Adding a second public field
would make the diagnostic shape less crisp without helping any current
consumer. If an external consumer later needs compatibility, add a small helper
that reads either field at the boundary rather than duplicating emitted JSON.

## Follow-Up

Proceed to `task-1557`: plan the next route or StandardMaterial follow-up after
the naming audit. The strongest candidates are still a small generic route
contract slice, a StandardMaterial/glTF browser fidelity slice, or tracker-only
alignment if the route naming audit changes public status.
