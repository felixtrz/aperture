# Diagnostics Summaries Index Plan - 2026-05-17

## Scope

Plan a short docs page that lists current public diagnostics summary helpers and
their ownership boundaries.

This is a planning slice only. It does not add the docs page yet.

## References Inspected

- `README.md`
- `docs/ARCHITECTURE.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/draw-package.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`
- `docs/research/DIAGNOSTICS_SUMMARY_SCRATCH_REUSE_PLAN_2026_05_17.md`

## Recommendation

Add `docs/DIAGNOSTICS_SUMMARIES.md`.

The page should help humans and coding agents choose the correct summary helper
without mixing current-frame diagnostics, retained backend cache summaries, and
detailed failure diagnostics.

## Proposed Structure

1. Purpose and boundary:
   - summaries are JSON-safe inspection surfaces;
   - ECS and snapshots remain authoritative;
   - WebGPU handles and source asset objects stay out of summary helpers.
2. Helper inventory:
   - `createMaterialQueuePhaseSummary()`;
   - `RenderWorldDrawPackageScratchSummary`;
   - `createRenderFrameQueueDiagnosticsSummary()`;
   - `createQueuedBuiltInResourceSetSummary()`;
   - `createWebGpuAppDiagnosticsSummary()`;
   - `createMaterialDependencyDiagnosticsSummary()`.
3. Ownership matrix:
   - package;
   - describes;
   - does not own/expose;
   - allocation/scratch status.
4. App diagnostics example:
   - explain `dependencySummary` is example status output derived from public
     report JSON;
   - detailed failure handles remain separate.
5. Future app report wiring:
   - requires a concrete consumer;
   - every-frame emission needs scratch or stable shells;
   - diagnostics summaries should remain siblings of resource reuse reports.

## Validation

Run:

- `pnpm exec prettier --check docs/DIAGNOSTICS_SUMMARIES.md`

## Non-Goals

- No full API reference.
- No generated docs.
- No new public API.
- No app report schema promise.

## Recommended Implementation Slice

Proceed with `task-0956`:

- add `docs/DIAGNOSTICS_SUMMARIES.md`;
- include a compact helper inventory/matrix;
- keep language aligned with North Star and package boundaries;
- run Markdown formatting validation.
