# Next Route Summary Or glTF Fidelity After Mixed Aggregation Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1277` plan that selected a route summary diagnostic-code sorting
regression.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_SUMMARY_OR_GLTF_FIDELITY_AFTER_MIXED_AGGREGATION_PLAN_2026_05_18.md`
- `docs/research/MIXED_FAMILY_ROUTE_SUMMARY_AGGREGATION_REGRESSION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The selected follow-up is concrete, bounded, and stays on the JSON-safe
route-summary unit surface.

The sorting regression checks a useful public property for diagnostics:
agent-readable status should be deterministic even when diagnostics arrive in a
non-deterministic or adapter-specific order. The test can prove this at the
stage and group levels without changing app routes, source material behavior, or
WebGPU resource ownership.

Boundary checks:

- no ECS authoring, render extraction, or render snapshot contract changes are
  needed;
- no WebGPU upload, pipeline, shader, bind group, or draw submission changes are
  needed;
- no app-level non-built-in material route behavior is implied;
- no public material-family API is added.

## Recommendation

Implement `task-1279` next.

Keep deferred:

- app-level non-built-in material adapter routing;
- StandardMaterial/glTF browser fidelity diagnostics until after this small
  route-summary determinism slice;
- shader behavior, WebGPU upload changes, IBL, shadows, binary GLB loading, and
  GLB viewer behavior.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
