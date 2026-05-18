# Test-Only Non-Built-In Route Summary Fixture Audit

Date: 2026-05-18

## Scope

Audit the `task-1269` unit fixture for a test-only non-built-in material-family
route summary.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_ROUTE_SUMMARY_FIXTURE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`

## Findings

Pass. The fixture stays unit-level and route-summary-only.

The test constructs a `preview-custom` material family through existing prepare
route and frame-resource route shell helpers, then groups the summaries with the
generic route summary helper. It proves the grouped stage totals, prepared
statuses, diagnostic totals, and JSON-safe output work for a non-built-in family
without adding app-level routing behavior.

Boundary checks:

- no source asset, ECS component, or render snapshot contract changed;
- no WebGPU upload, bind group, pipeline, shader, or draw submission behavior
  changed;
- no public material-family API was added;
- grouped JSON remains free of raw facade/backend resource keys and GPU handles.

## Recommendation

Continue with tracker/backlog alignment next, then choose a small route-migration
or StandardMaterial/glTF fidelity slice. App-level non-built-in material routing
should remain deferred until the route/prepared-resource contract is explicit
enough to avoid implying unsupported shader or upload behavior.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts`
