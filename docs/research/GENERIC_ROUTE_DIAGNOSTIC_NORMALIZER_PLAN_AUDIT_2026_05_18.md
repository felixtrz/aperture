# Generic Route Diagnostic Normalizer Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Findings

The selected follow-up is concrete enough for one focused implementation run.
It has a narrow target: move the generic `unknown` diagnostic normalization
logic out of the built-in collector while keeping built-in app-family policy in
place.

The implementation should preserve these boundaries:

- Built-in compatibility translation remains in
  `queued-built-in-app-resource-set.ts`.
- The generic normalizer accepts unknown diagnostic values and returns only
  JSON-safe `WebGpuAppMaterialQueueRouteDiagnostic` data.
- Raw source assets, adapter objects, app objects, callbacks, and GPU handles
  remain outside the route report diagnostic surface.
- No render behavior changes; the helper affects failure-report serialization
  only.

The task should add focused tests around the helper itself instead of relying
only on the built-in collector failure path.

## Recommendation

Proceed with the selected implementation: extract the generic route diagnostic
normalizer into `material-queue-route-report.ts`, route the built-in collector
through it, and add targeted diagnostics tests.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
