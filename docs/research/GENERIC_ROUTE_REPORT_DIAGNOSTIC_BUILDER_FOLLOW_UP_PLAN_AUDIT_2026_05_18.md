# Generic Route Report Diagnostic Builder Follow-Up Plan Audit - 2026-05-18

## Scope

Audit the selected follow-up from
`NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`.

Reference anchors inspected:

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/DECISIONS.md`
- `docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`
- `docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`

## Findings

The selected implementation is concrete enough for one focused run. It has a
small write scope and a clear before/after:

- Before: `queued-built-in-app-resource-set.ts` owns a route report diagnostic
  builder that serializes otherwise generic queue and routed item metadata.
- After: a generic helper builds the same JSON-safe diagnostic from
  `MaterialQueueItem` and `QueuedMaterialAppResourceItem`, while the built-in
  collector keeps compatibility-only diagnostic translation.

The plan preserves the required architecture:

- ECS remains authoritative; the helper sees only extracted queue/report
  metadata.
- Rendering remains a derived view; no direct ECS or source asset lookup moves
  into the helper.
- WebGPU resources stay backend-owned; the helper must serialize report metadata
  and normalized diagnostics only.
- The helper does not create app-level non-built-in rendering, WebGL fallback,
  scene graph state, or a new material system.

## Recommendation

Implement the selected extraction next. Keep validation focused on the generic
helper test, the built-in collector test, type checking for tests, and broader
build/test/lint if the run reaches final validation.

## Validation

Documentation-only audit; covered by final formatting and progress checks.
