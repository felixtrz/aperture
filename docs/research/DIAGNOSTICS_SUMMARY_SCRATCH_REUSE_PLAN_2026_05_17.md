# Diagnostics Summary Scratch Reuse Plan - 2026-05-17

## Scope

Assess whether the new diagnostics summary helpers need caller-owned scratch
before any app report wiring.

This is a planning slice only. It does not add scratch APIs, alter summary
helpers, change app reports, or change rendering behavior.

## References Inspected

- `docs/DECISIONS.md` decision 0009, no steady-state render hot-path
  allocations
- `packages/render/src/rendering/draw-package.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/reusable-route-collector.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/material-dependency-diagnostics-summary.ts`
- `examples/app-diagnostics.js`

## Current Classification

These helpers are inspection/setup/test surfaces today and may allocate:

- `createMaterialQueuePhaseSummary()`;
- `createRenderFrameQueueDiagnosticsSummary()`;
- `createQueuedBuiltInResourceSetSummary()`;
- `createWebGpuAppDiagnosticsSummary()`;
- `createMaterialDependencyDiagnosticsSummary()`.

That is acceptable under decision 0009 because they are not wired into the
steady-state successful frame loop as required report output.

These current frame-loop pieces already use scratch or stable shells:

- `writeMaterialQueueFromSnapshot()` writes into `MaterialQueueScratch`;
- `writeRenderWorldDrawPackages()` writes into `RenderWorldDrawPackageScratch`
  and updates `RenderWorldDrawPackageScratchSummary`;
- `writeRenderFramePlanFromSnapshot()` writes into `RenderFramePlanScratch`;
- queued built-in routing uses `ReusableRouteCollector` for stable item,
  diagnostic, and resource-set arrays.

## Recommendation

Do not add scratch APIs for the diagnostics summary helpers yet.

The current helpers should remain clear one-shot inspection helpers until a
concrete app-report or browser diagnostics consumer requires per-frame emission
on successful frames.

If app report wiring is added later, introduce scratch only for helpers that run
on the steady-state success path:

- material queue phase summary: add caller-owned arrays/maps or fold summary
  buckets into `MaterialQueueScratch`;
- queued built-in resource-set summary: add a summary shell under
  `QueuedBuiltInAppRouteScratch`;
- render-frame queue diagnostics summary: add a summary shell under
  `RenderFramePlanSummaryScratch` or a sibling frame diagnostics scratch;
- app diagnostics grouping: use a stable result shell if it is emitted every
  frame;
- material dependency diagnostics summary: keep allocating if it is only derived
  from failure diagnostics; add scratch only if emitted for every frame or every
  material.

## Non-Goals

- No broad allocation audit.
- No rewrite of existing summary helpers.
- No app report schema changes.
- No benchmark harness.
- No source asset or WebGPU handle exposure.

## Follow-Up Decision

No immediate implementation follow-up is needed. The next task that proposes
core app-report wiring for these summaries must first specify whether the
summary is emitted:

- every frame;
- only on failures;
- only in examples/tests;
- only behind an explicit diagnostic option.

That decision should determine whether scratch is required.

## Validation

No code validation was required for this planning task. Existing relevant
validation from this run:

- `pnpm run build`
- `pnpm run check:examples`
- targeted tests for each helper
