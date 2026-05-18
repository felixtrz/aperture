# Generic App Route Report Diagnostic Builder Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_COLLECTOR_GENERICIZATION_AFTER_ROUTE_SURFACE_AUDIT_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_COLLECTOR_GENERICIZATION_AFTER_ROUTE_SURFACE_AUDIT_PLAN_2026_05_18.md`
- `docs/research/BUILT_IN_APP_ROUTE_COLLECTOR_DIAGNOSTICS_SURFACE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`

## Findings

The selected follow-up is concrete enough for one focused implementation run.
It has one clear target: move the route report diagnostic builder out of the
built-in collector surface and make it operate on generic queued material app
resource items.

The implementation should preserve these boundaries:

- ECS authority is unchanged because the helper consumes already extracted
  `MaterialQueueItem` report metadata and routed app resource items.
- Render extraction stays unchanged; the helper is diagnostic serialization
  over queued and routed render data.
- WebGPU ownership stays intact because the helper must emit only JSON-safe
  report fields and must not expose source assets, adapter objects, app objects,
  or raw GPU handles.
- Built-in compatibility remains valid because the built-in collector can keep
  translating missing app-family and material-mismatch route diagnostics into
  current `webGpuApp.*` codes before passing normalized diagnostics to the
  generic report helper.

The task should not broaden into source asset indexing, collector ownership, or
non-built-in material rendering. Those are separate follow-ups once generic
diagnostic/report helpers are no longer embedded in built-in collector code.

## Recommendation

Proceed with the selected implementation after tracker/backlog alignment:
extract the generic app route report diagnostic builder, route the built-in
collector through it, and add a non-built-in test fixture for JSON-safe report
serialization.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
