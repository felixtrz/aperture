# Prepared/App Reuse Example Usage Plan

Date: 2026-05-17

Task: `task-1057`

## Goal

Decide whether `examples/app-diagnostics.js` should expose an example-owned
prepared/app reuse alignment summary now.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `packages/webgpu/src/webgpu/prepared-resource-app-reuse-alignment-summary.ts`
- `packages/webgpu/src/webgpu/prepared-resource-lifetime-alignment-summary.ts`
- `docs/research/PREPARED_APP_REUSE_ALIGNMENT_SUMMARY_PLAN_2026_05_17.md`

## Decision

Add the prepared/app reuse alignment summary to the diagnostics example's
successful mixed-material scenario.

This should be example-owned and opt-in, matching the current
`preparedResourceSummary` and `preparedLifetimeSummary` fields. The app report
shape should not change.

## Recommended Implementation

- Extend `createExamplePreparedResourceSummaries()` to derive
  `preparedAppReuseSummary` from:
  - the existing `preparedResourceSummary`;
  - `reportJson.resourceReuse` from `webGpuAppRenderReportToJsonValue(report)`.
- Include `preparedAppReuseSummary` beside `preparedResourceSummary` and
  `preparedLifetimeSummary` in the successful mixed-material scenario status.
- Add Playwright assertions for compact counts and handle/GPU omission.

## Non-Goals

- Do not add a default app-frame report field.
- Do not place the summary under `resourceReuse`.
- Do not expose prepared store entries, cache maps, raw resources, resource
  keys, buffers, textures, samplers, bind groups, pipelines, or GPU handles.
- Do not add route summaries to the diagnostics example in this slice.

## Follow-Up Task

Use `task-1058` to implement the example field and Playwright coverage.
