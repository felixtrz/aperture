# App Diagnostics Dependency Summary Browser Boundary Audit - 2026-05-17

## Scope

Audit the Playwright assertions added for app diagnostics aggregate dependency
summaries.

This audit checks test ownership and report boundaries only. It does not change
example behavior, app report wiring, resource reuse reports, or rendering.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/APP_DIAGNOSTICS_DEPENDENCY_SUMMARY_BROWSER_VALIDATION_PLAN_2026_05_17.md`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `test/e2e/webgpu-status.ts`

## Findings

No corrective code changes are required.

The Playwright spec now verifies `dependencySummary` aggregate counts for the
mixed matcap, unlit dependency, and StandardMaterial dependency failure
scenarios. It checks material count, slot count, material-kind bucket,
dependency-kind buckets, status buckets, and diagnostic code totals.

The handle-safety assertions are scoped to
`JSON.stringify(scenario.dependencySummary)`. This is the correct boundary:
the full scenario still intentionally exposes detailed failure fields and the
full app report JSON, which include handle-level debug data.

The test did not introduce app report schema changes or resource reuse report
assertions. It validates the public example status after the example has
rendered, preserving the ECS/app-rendering boundary.

## Boundary Notes

- Browser validation remains example-facing and does not rely on private app
  internals.
- Detailed failure handles remain allowed outside the aggregate summary.
- The aggregate summary remains current-frame diagnostics data, not retained
  texture/sampler cache state.

## Follow-Up

No backlog wording changes are needed. A future README note can mention the
example's aggregate dependency summary without promising new core report fields.

## Validation

- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`
