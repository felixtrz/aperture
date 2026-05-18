# Next Material Route Or glTF Fidelity Slice Plan Audit

Date: 2026-05-18

## Scope

Audit the `task-1272` plan that selected a mixed-family route summary
aggregation regression.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_GLTF_FIDELITY_SLICE_PLAN_2026_05_18.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_ROUTE_SUMMARY_FIXTURE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The selected follow-up is concrete enough for one focused run and stays
within route-summary unit coverage.

The planned regression exercises a useful boundary: built-in prepared routes,
test-only non-built-in prepared routes, and failed routes should aggregate
deterministically without exposing raw resource keys or GPU handles. That
strengthens generic material-route diagnostics without adding app-level
non-built-in rendering behavior.

Boundary checks:

- no ECS authoring component or source asset contract is needed;
- no render snapshot shape or worker boundary changes are needed;
- no WebGPU upload, pipeline, shader, bind group, or draw submission changes are
  needed;
- JSON-safe diagnostics remain the observable surface.

## Recommendation

Implement `task-1274` next.

Keep deferred:

- app-level non-built-in material adapter rendering;
- shader behavior and WebGPU upload changes;
- IBL and shadows;
- binary GLB loading and GLB viewer behavior;
- public material-family API changes.

## Validation

Documentation-only audit. Validate with touched-file formatting and final
`git diff --check`.
