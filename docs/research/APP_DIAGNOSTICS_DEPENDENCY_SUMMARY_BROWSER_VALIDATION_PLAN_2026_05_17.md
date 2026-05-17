# App Diagnostics Dependency Summary Browser Validation Plan - 2026-05-17

## Scope

Plan focused Playwright assertions for the aggregate dependency summaries now
published by `examples/app-diagnostics.js`.

This is a planning slice only. It does not change tests or examples.

## References Inspected

- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `test/e2e/webgpu-status.ts`
- `docs/research/APP_DIAGNOSTICS_DEPENDENCY_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`

## Current Browser Test

`test/e2e/app-diagnostics.spec.ts` already opens
`/examples/app-diagnostics.html`, waits for
`window.__APERTURE_EXAMPLE_STATUS__`, verifies scenario-level failure/success
status, checks detailed failed dependency fields, attaches JSON status, and
verifies visible pixels for the success scenario.

The test intentionally allows detailed handle-level fields such as
`failedMaterialKey`, `failedResourceKeys`, and full report JSON.

## Assertion Plan

Add a typed `dependencySummary` field to `AppDiagnosticScenarioStatus` with the
aggregate shape needed by the test:

- material counts;
- slot counts;
- `byMaterialKind`;
- `byDependencyKind`;
- `byStatus`;
- diagnostic code totals.

Add assertions for the three failure scenarios:

- mixed unlit/matcap dependency failure:
  - `materialCount: 1`;
  - `blockedMaterialCount: 1`;
  - two blocked slots;
  - `matcap` material-kind bucket;
  - one missing texture and one loading sampler.
- unlit material dependency failure:
  - `unlit` material-kind bucket;
  - two blocked slots;
  - one missing texture and one loading sampler.
- StandardMaterial dependency failure:
  - `standard` material-kind bucket;
  - two blocked slots;
  - one missing texture and one loading sampler.

Add handle-safety assertions against `JSON.stringify(scenario.dependencySummary)`
for known substrings:

- `diagnostic-missing-matcap`;
- `dependency-missing-texture`;
- `standard-missing-base-color`;
- `diagnostic-loading-matcap`;
- `dependency-loading-sampler`;
- `standard-loading-base-color`.

Do not assert that the whole scenario lacks handles because the detailed fields
and full report intentionally include them.

## Validation

Run:

- `pnpm exec playwright test test/e2e/app-diagnostics.spec.ts`

If browser WebGPU is unavailable in the environment, document the skip/failure
and keep `pnpm run check:examples` as syntax validation.

## Non-Goals

- No example status shape changes beyond already-added `dependencySummary`.
- No core app report schema changes.
- No `WebGpuAppResourceReuseReport` assertions.
- No removal of detailed failure fields.

## Recommended Implementation Slice

Proceed with `task-0950`:

- extend the Playwright status type with a narrow dependency summary interface;
- add aggregate count and handle-safety assertions for each failure scenario;
- run the targeted app diagnostics Playwright spec.
