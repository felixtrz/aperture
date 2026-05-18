# Route Summary Group Clean-After-Failed Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1243` route summary group clean-after-failed regression.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/MATERIAL_FAMILY_ROUTE_MIGRATION_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_ROUTE_SUMMARY_STALE_STATE_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The regression strengthens generic route-summary hygiene without changing
runtime behavior.

The test builds a failed prepare/frame-resource group for an unsupported
`debug-normal` route, then builds a clean `standard` group in the same test. The
clean JSON value is asserted to have:

- prepared and frame-resource totals with one valid route each;
- no invalid route counts;
- no failed statuses;
- empty diagnostic-code buckets at each stage and at group level;
- no stale unsupported-family text;
- no raw facade or backend resource keys.

This is intentionally test-only. It does not change source assets, ECS
components, render snapshots, app route structure, prepared-resource ownership,
WebGPU resource creation, IBL, shadows, binary GLB loading, GLB viewer behavior,
or shader behavior.

The inspected reference patterns still point in the same direction:
renderer-side route/resource summaries should describe derived render state
without making source material data or GPU handles authoritative.

## Recommendation

Return to StandardMaterial/glTF fidelity and implement `task-1251` next. The
route-summary hygiene path is covered well enough for the current built-in app
route.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts test/webgpu/material-queue-route-report.test.ts`
- `pnpm exec prettier --check test/webgpu/queued-material-route-summary-group.test.ts`
