# Route diagnostics report field naming plan audit - 2026-05-18

## Scope

Audit the selected `task-1556` route diagnostics field naming follow-up.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md` decision 0010
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_UNKNOWN_ROUTE_REGRESSION_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`

## Audit

The selected follow-up is concrete enough for one focused run. It should answer
one narrow question: whether nested route diagnostics consistently expose the
route report as `report`, whether tests lock that shape, and whether a
compatibility helper is needed before more route diagnostics are added.

Architecture fit:

- The task is diagnostic/API-shape clarification only.
- It does not add custom material authoring or non-built-in app rendering.
- It preserves JSON-safe route reporting and WebGPU-only resource ownership.

## Recommendation

Proceed with `task-1556` after tracker alignment.

## Validation

Documentation-only audit; covered by final formatting/check validation.
