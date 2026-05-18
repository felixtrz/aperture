# Generic Route Summary Stale-State Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1238` reusable route report shell stale-state regression.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_OR_FIDELITY_AFTER_SCRATCH_RESET_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/webgpu/material-queue-route-report.test.ts`

## Findings

Pass. The regression is generic route diagnostics hygiene and does not add
StandardMaterial-specific product behavior.

The test reuses one `WebGpuAppMaterialQueueRouteReportShell` across:

- a failed route report with unsupported `debug-normal` and unsupported
  transparent blend diagnostics;
- a clean valid StandardMaterial route report that should serialize as a fresh
  report.

The clean report is asserted to contain one routed StandardMaterial item, no
skipped items, empty diagnostic summaries, no diagnostics, no stale
`debug-normal` family, no stale unsupported-route diagnostic code, and no stale
`additive` blend preset. This covers the mutable shell reset path used by the
built-in app resource collector without changing app route behavior.

The change is test-only. It does not change source assets, ECS components,
render snapshots, WebGPU resources, app route structure, material families,
IBL, shadows, binary GLB loading, GLB viewer behavior, or shader behavior.

## Validation

- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/queued-material-route-summary-group.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run build`
- `pnpm run lint`
- `pnpm test`

## Recommendation

Proceed to `task-1240` soon to plan the next StandardMaterial/glTF fidelity
diagnostic. Keep `task-1243` available as a small follow-up only if route
summary group stale-state coverage still looks useful after the StandardMaterial
planning pass.
