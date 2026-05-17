# App Diagnostics Dependency Summary Boundary Audit - 2026-05-17

## Scope

Audit the app diagnostics example change that adds aggregate dependency summary
data to failure scenario statuses.

This audit checks example ownership and report boundaries only. It does not
change app report wiring, resource reuse reports, dependency readiness
generation, or rendering behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/APP_DIAGNOSTICS_EXAMPLE_SUMMARY_USAGE_PLAN_2026_05_17.md`
- `examples/app-diagnostics.js`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `scripts/serve-examples.mjs`

## Findings

No corrective code changes are required.

The example now computes `dependencySummary` inside `scenarioStatus()` from
`webGpuAppRenderReportToJsonValue(report).materialDependencyReadiness ?? []`.
This is example-only derived output. It does not mutate the app, renderer,
render report, JSON report helper, or retained resource reuse report.

The aggregate `dependencySummary` remains handle-free because it is produced by
`createMaterialDependencyDiagnosticsSummary()`. It reports counts by material
kind, dependency kind, readiness status, and diagnostic code. It does not
include material keys, texture keys, sampler keys, dependency keys, source asset
objects, prepared resources, or WebGPU handles.

The example still includes detailed failure fields (`failedMaterialKey`,
`failedResourceKeys`, and the full report JSON). That is acceptable for this
diagnostics example because those fields predate the summary and intentionally
show handle-level failure detail. The new aggregate summary should not be
treated as a replacement for detailed debugging data.

## Boundary Notes

- Core `WebGpuAppRenderReport` and `WebGpuAppRenderReportJsonValue` shapes are
  unchanged.
- `WebGpuAppResourceReuseReport` remains cache/reuse-only and does not receive
  dependency readiness counts.
- The example reads public package exports through the existing dynamic import
  surface and does not reach into private app internals.
- This does not create hidden renderer state; it is a pure status view derived
  after rendering.

## Follow-Up

No backlog wording changes are needed. If a browser E2E task later validates
this example, assert `dependencySummary` exists and remains aggregate-only while
allowing the separate detailed failure fields to keep handle-level debug data.

## Validation

- `pnpm run check:examples`
- `pnpm run build`
