# Route Summary Diagnostic-Code Sorting Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1279` route summary diagnostic-code sorting regression.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_ROUTE_SUMMARY_OR_GLTF_FIDELITY_AFTER_MIXED_AGGREGATION_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The regression is unit-only route-summary determinism coverage.

The test creates unsorted diagnostic codes in both prepare and frame-resource
stages, then asserts sorted stage-level and group-level `byCode` maps. It also
proves duplicate diagnostic codes merge across stages and that JSON-safe output
does not expose raw facade/backend resource keys or GPU handles.

Boundary checks:

- no source asset, ECS component, or render snapshot contract changed;
- no WebGPU upload, pipeline, bind group, shader, or draw submission behavior
  changed;
- no app-level non-built-in material route behavior is implied;
- no public material-family API was added.

## Recommendation

Run tracker/backlog alignment next. After that, the next planning task should
consider whether route-summary criteria are now sufficient to move closer to
app-level route migration or whether StandardMaterial/glTF fidelity diagnostics
should resume.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts`
