# Frame-Resource Route Summary Consumer Boundary Audit

Date: 2026-05-17

Task: `task-1047`

## Scope

Audit the `task-1046` decision to keep
`createQueuedMaterialFrameResourceRouteShellSummary()` helper-only for now.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SUMMARY_CONSUMER_PLAN_2026_05_17.md`
- `docs/research/FRAME_RESOURCE_ROUTE_SHELL_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `examples/app-diagnostics.js`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### Opt-In Boundary

Pass. The route shell summary remains an explicit helper. It is not added to
default successful app-frame reports, `resourceReuse`, or the diagnostics
example output.

The app continues to expose route shell details only through
`webGpuApp.frameResourceRoute` failure diagnostics. That failure path is already
the point where facade/backend key alignment and frame-resource diagnostics are
actionable.

### JSON Safety

Pass. Existing route-summary tests prove the compact summary omits facade
resource keys, backend resource keys, raw diagnostic messages, diagnostic
resource keys, raw frame resources, and GPU handles. Keeping the helper
unconsumed by default preserves that boundary and avoids creating a second app
surface for the same failed route.

### Ownership Separation

Pass. No source asset ownership, prepared facade ownership, or backend cache
ownership changes. The summary helper remains derived inspection data from an
already-created route shell. The app does not retain successful route shells as
hidden renderer state.

### Allocation Discipline

Pass. Avoiding a successful-frame consumer avoids allocating compact route
summary objects in the normal rendering path. If future debugging needs
successful route summaries, the next design should be optional and covered by
report-shape/allocation tests.

## Result

The deferral is aligned with the North Star and Architecture docs. No app
diagnostics consumer is needed now.

## Follow-Up

Proceed to `task-1048`: plan whether render-world prepared summaries need a
reusable consumer helper or should remain directly composed by examples/tests.
