# Route Summary Grouping Consumer Plan

Date: 2026-05-17

Task: `task-1054`

## Goal

Decide whether prepare-route and frame-resource-route summaries need a reusable
grouped diagnostics consumer.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/material-queue-route-report.test.ts`
- `test/webgpu/queued-material-frame-resource-route.test.ts`
- `docs/research/WEBGPU_MATERIAL_QUEUE_ROUTE_REPORT_SHELL_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_ROUTE_REPORT_SHELL_BOUNDARY_AUDIT_2026_05_17.md`

## Current Surfaces

- Material queue route reports summarize queue-item routing by family/phase and
  diagnostic code/severity.
- `QueuedMaterialPrepareRouteResult` records per-item prepare-route status,
  resource-key presence, pipeline key, source version, frame, and diagnostics.
- `QueuedMaterialFrameResourceRouteShellSummary` records per-item frame-resource
  status, resource-key presence booleans, pipeline key, source version, frame,
  and diagnostic code counts.

These surfaces are useful individually, but tests and explicit diagnostics
consumers will soon need one compact view of route health across prepare-route
and frame-resource-route stages.

## Decision

Add a WebGPU helper that groups route summaries without changing app reports.

Recommended implementation:

1. Add `createQueuedMaterialPrepareRouteSummary()` for
   `QueuedMaterialPrepareRouteResult`.
   - Include validity, status, family, resource-key presence booleans,
     pipeline key, source version, frame, and diagnostic code counts.
   - Omit material keys, facade resource keys, raw diagnostic messages, and
     resource keys.
2. Add `createQueuedMaterialRouteSummaryGroup()`.
   - Input: prepare-route summaries and frame-resource route shell summaries.
   - Output: compact totals by stage, validity/status counts, and merged
     diagnostic code totals.
   - Keep it allocating and explicit for tests/examples/diagnostics only.

## Non-Goals

- Do not add grouped route summaries to default successful app reports.
- Do not replace `webGpuApp.materialQueueRouteReport` or
  `webGpuApp.frameResourceRoute` failure diagnostics.
- Do not expose raw route keys, material keys, resource keys, raw diagnostics,
  frame resources, backend cache maps, or GPU handles.
- Do not move route orchestration out of `app.ts`.

## Follow-Up Task

Use `task-1055` to implement the prepare-route summary and grouped route summary
helper with targeted WebGPU tests and typecheck.
