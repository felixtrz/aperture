# Mixed-Family Route Summary Aggregation Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1274` mixed-family route summary aggregation regression.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/NEXT_MATERIAL_ROUTE_OR_GLTF_FIDELITY_SLICE_PLAN_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The regression is unit-only route-summary coverage and does not add
app-level non-built-in material rendering behavior.

The new test combines:

- one prepared built-in `standard` route;
- one prepared test-only `preview-custom` route;
- one failed `debug-normal` route.

It then asserts deterministic aggregate totals, valid/invalid counts, prepared
and failed status counts, diagnostic code counts, and JSON-safe output without
raw facade/backend resource keys or GPU handles.

Boundary checks:

- no source asset, ECS component, or render snapshot contract changed;
- no WebGPU upload, pipeline, bind group, shader, or draw submission behavior
  changed;
- no public material-family API was added;
- failed-route diagnostics remain summarized by code instead of exposing raw
  resource handles.

## Recommendation

Run tracker/backlog alignment next, then plan the next slice. The next planning
task can either move one step closer to app-level route migration or return to a
StandardMaterial/glTF fidelity diagnostic.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts`
