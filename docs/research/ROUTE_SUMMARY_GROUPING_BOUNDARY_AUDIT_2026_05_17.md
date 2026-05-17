# Route Summary Grouping Boundary Audit

Date: 2026-05-17

Task: `task-1056`

## Scope

Audit `createQueuedMaterialPrepareRouteSummary()` and
`createQueuedMaterialRouteSummaryGroup()` from `task-1055`.

## Reference Anchors Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `docs/research/ROUTE_SUMMARY_GROUPING_CONSUMER_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-material-route-summary-group.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/webgpu/queued-material-route-summary-group.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `test/webgpu/material-queue-route-report.test.ts`

## Findings

### Opt-In Boundary

Pass. The new helpers are explicit WebGPU diagnostics helpers. They are not
wired into default successful app reports and do not replace existing
failure-only `webGpuApp.materialQueueRouteReport` or
`webGpuApp.frameResourceRoute` diagnostics.

### JSON Safety

Pass. The prepare-route summary keeps only validity, status, family,
resource-key presence booleans, pipeline/frame facts, and diagnostic code
counts. The grouped summary aggregates stage totals, status counts, and
diagnostic code totals.

Tests prove JSON output omits material keys, facade resource keys, backend
source keys, raw diagnostic messages, raw frame resources, backend cache maps,
and GPU-like strings.

### Ownership Separation

Pass. The helpers do not store ECS state, asset registries, source assets,
prepared resources, adapters, pipelines, bind groups, devices, command encoders,
or cache maps. They summarize route outcomes after route helpers have already
run.

### Allocation Discipline

Pass. The helpers allocate by design and are documented as explicit diagnostics
surfaces. They are not used in the frame-loop success path by default.

## Validation

- `pnpm exec vitest run test/webgpu/queued-material-route-summary-group.test.ts test/webgpu/queued-material-frame-resource-route.test.ts test/webgpu/material-queue-route-report.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

Result: passed.

## Follow-Up

Next concrete route/prepared diagnostics follow-up: plan whether
`examples/app-diagnostics.js` should expose the prepared/app reuse alignment
summary as example-owned opt-in output, matching the existing prepared/lifetime
summary pattern.
