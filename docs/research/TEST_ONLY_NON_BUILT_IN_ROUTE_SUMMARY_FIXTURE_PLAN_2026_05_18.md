# Test-Only Non-Built-In Route Summary Fixture Plan

Date: 2026-05-18

## Scope

Plan the smallest non-built-in material-family route summary fixture after route
summary hygiene and glTF diagnostic coverage.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/MATERIAL_ROUTE_MIGRATION_READINESS_AFTER_DIAGNOSTICS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Candidates Compared

### Unit-only route summary fixture

Create test-only prepare and frame-resource route shell summaries for a
non-built-in family such as `preview-custom`, then group them with the generic
route summary helper.

Why this is preferred:

- It exercises generic route summary shape without claiming app-level
  non-built-in rendering support.
- It can assert family/status/diagnostic grouping and raw-resource-key omission.
- It stays in unit tests and avoids shader, WebGPU upload, app route, or public
  material-family changes.

### App-status diagnostic fixture

Surface a non-built-in family route summary through browser/app status.

Why this is deferred:

- The app facade still terminates in built-in frame-resource buckets.
- Browser status would imply a broader app route shape than the next slice
  should introduce.

### Broad app-level non-built-in route migration

Allow a non-built-in material family to flow through app collection and render
submission.

Why this is deferred:

- It would require app route behavior, prepared-resource contracts, and likely
  shader/pipeline decisions together.
- That is larger than a 30-60 minute safety slice and needs another audit after
  the unit-level criterion is proven.

## Selected Follow-Up

Select the unit-only route summary fixture:
`task-1269 — Add test-only non-built-in route summary fixture`.

The slice should:

- create a test-only non-built-in family route summary from prepare and
  frame-resource route shells;
- assert generic grouping by family/status/diagnostics;
- assert JSON output omits raw facade/backend resource keys and GPU handles;
- avoid app-level non-built-in draw submission, shader behavior, WebGPU upload,
  IBL, shadows, binary GLB loading, GLB viewer behavior, and public material
  family changes.

## Validation

Plan-only task. Validate with touched-file formatting and final
`git diff --check`.
