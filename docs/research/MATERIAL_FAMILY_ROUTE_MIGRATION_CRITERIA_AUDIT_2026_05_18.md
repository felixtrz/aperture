# Material-Family Route Migration Criteria Audit

Date: 2026-05-18

## Scope

Audit the smallest observable criterion for moving beyond built-in-only app
resource routing toward material-family adapter routing.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `docs/research/GENERIC_ROUTE_SUMMARY_STALE_STATE_REGRESSION_AUDIT_2026_05_18.md`
- `docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DIAGNOSTICS_ROUTE_CLEANUP_AUDIT_2026_05_18.md`

## Findings

The app route is already partly generic: material adapters are registered by
family, prepare routes produce family/pipeline/resource keys, and frame-resource
set preparation accepts generic callbacks. The remaining app-facing constraint
is that built-in frame resources still terminate in built-in buckets
(`unlit`, `matcap`, `standard`) and the app facade expects those buckets.

The smallest observable migration criterion is not a new material family yet.
It is a diagnostics/test boundary that proves generic route summaries can
describe a clean route after a failed route without relying on built-in bucket
arrays. This keeps the next slice inside route-summary hygiene and avoids
pretending app-level non-built-in rendering is supported.

No source asset, ECS component, or render snapshot type needs to own WebGPU
resources for this migration. GPU resources remain backend-owned in prepared
frame resources and route shells. Source assets continue to provide stable
handles, material family names, and dependency metadata only.

## Recommended Next Criterion

Keep `task-1243` as the next implementation candidate: add route summary group
clean-after-failed coverage.

Acceptance should focus on:

- a failed prepare/frame-resource route summary group followed by a clean group;
- empty diagnostic-code buckets in the clean group;
- no failed statuses, stale unsupported-family text, or raw facade/backend
  resource keys in the clean JSON value.

This is concrete, fits one focused run, and strengthens the bridge before any
larger app-level non-built-in material adapter migration.

## Deferred Work

- Real app-level non-built-in material adapter route migration remains larger
  than a single cleanup test.
- New material-family implementation should wait until route summaries and app
  diagnostics can describe families without built-in-only assumptions.
- IBL, shadows, binary GLB loading, and GLB viewer behavior remain deferred.

## Validation

- Documentation-only audit; covered by touched-file Prettier, progress checks,
  and `git diff --check` in the current run.
