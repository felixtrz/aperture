# Test-Only Non-Built-In Route Summary Fixture Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1267` plan for a test-only non-built-in material-family route
summary fixture.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_ROUTE_SUMMARY_FIXTURE_PLAN_2026_05_18.md`
- `docs/research/MATERIAL_ROUTE_MIGRATION_READINESS_AFTER_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The selected fixture is concrete enough for one focused run and does not
require app-level non-built-in rendering.

The plan stays at the route-summary level. It can construct test-only prepare
and frame-resource route shell summaries for a non-built-in family, group them
with the existing generic summary helper, and verify JSON-safe aggregate output.
That proves another route migration criterion without changing app route
behavior or adding a public material family.

Boundary checks:

- ECS and source assets remain unchanged.
- Render extraction and snapshots remain unchanged.
- WebGPU resources remain backend-owned and are not created by the fixture.
- Raw facade/backend resource keys and GPU handles should be absent from grouped
  JSON.

## Recommendation

Implement `task-1269` next.

Keep deferred:

- app-level non-built-in material-family rendering;
- shader behavior;
- WebGPU upload changes;
- IBL and shadows;
- binary GLB loading and GLB viewer behavior;
- public material-family API changes.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
