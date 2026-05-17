# Render Frame Queue Diagnostics Placement Plan - 2026-05-17

## Scope

Plan where queue-stage diagnostics should surface after adding material queue
phase summaries, draw package scratch summaries, and queued route collector
scratch reuse.

This is a planning slice only. It does not change app reports, frame planning
behavior, resource preparation, command encoding, or WebGPU submission.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_FRAME_READINESS.md`
- `docs/research/MATERIAL_QUEUE_PHASE_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/DRAW_PACKAGE_SCRATCH_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/QUEUED_MATERIAL_ROUTE_COLLECTOR_REUSE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/draw-package.ts`

## Current Surfaces

`WebGpuAppRenderReport.counts` exposes simple frame counts:

- views;
- mesh draws;
- draw packages;
- draw commands;
- draw calls;
- diagnostics.

`WebGpuAppResourceReuseReport` exposes renderer/backend resource behavior:

- pipeline hits/misses;
- mesh/material buffer creation and reuse;
- prepared mesh/material facade and backend cache summaries;
- texture/sampler cache summaries;
- bind group and light buffer reuse.

`RenderFramePlanSummary` already has a `queue` phase with counts for ready
draws, blocked draws, and produced packages. `RenderWorldDrawPackagePlan.summary`
now adds scratch/package reuse details and diagnostic code counts.

## Placement Recommendation

Do not add queue-stage diagnostics to `WebGpuAppResourceReuseReport`.

Queue diagnostics describe derived frame planning state:

- render-world draw readiness;
- draw package planning;
- draw package scratch/pool reuse;
- missing packed transforms;
- queue-stage diagnostic code counts.

They are not backend retained resource caches and are not proof that GPU
resources were created, reused, retained, or evicted.

## Proposed Helper Shape

Add a WebGPU-side helper near `render-frame-plan.ts` that summarizes queue-stage
planning data from an existing frame plan result:

```ts
export interface RenderFrameQueueDiagnosticsSummary {
  readonly ready: boolean;
  readonly readyDrawCount: number;
  readonly blockedDrawCount: number;
  readonly packageCount: number;
  readonly packagePoolSize: number;
  readonly packageSlotsReused: number;
  readonly packageSlotsCreated: number;
  readonly missingPackedTransformCount: number;
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}

export function createRenderFrameQueueDiagnosticsSummary(
  input: Pick<PlanRenderFrameFromSnapshotResult, "readiness" | "packages">,
): RenderFrameQueueDiagnosticsSummary;
```

The helper should combine:

- `readiness.ready.length`;
- `readiness.blocked.length`;
- `packages.summary.packageCount`;
- `packages.summary.packagePoolSize`;
- `packages.summary.packageSlotsReused`;
- `packages.summary.packageSlotsCreated`;
- `packages.summary.missingPackedTransformCount`;
- diagnostics from `readiness.diagnostics` and `packages.diagnostics`.

The result should be JSON-safe and summary-only. It must not include
`RenderWorldDrawPackage` records, draw packets, snapshots, ECS worlds, asset
entries, prepared resources, pipelines, bind groups, buffers, command objects,
or WebGPU handles.

## Material Queue Relationship

`MaterialQueuePhaseSummary` should remain a separate renderer-independent
summary because it describes material queue items before WebGPU app resource
preparation.

Do not merge material queue phase summaries into the render-frame queue helper
yet. The current `writeRenderFramePlanFromSnapshot()` path starts from applied
render-world resource bindings and draw readiness, not from a material queue.

If a future app-level report needs both material queue and render-frame queue
views, add a separate app diagnostics section that contains both summaries as
siblings.

## App Report Relationship

Keep app reports unchanged in the first implementation:

- `counts.drawPackages` remains the simple frame count.
- `resourceReuse` remains backend resource/cache behavior.
- successful frame route reports remain absent by default.

The first implementation should be a helper plus focused tests. App/frame report
wiring can come later only if a concrete diagnostics consumer needs it.

## Focused Validation

Add tests covering:

- empty frame planning queue state;
- ready queue with packages and reused package slots;
- blocked readiness diagnostics;
- missing packed transform package diagnostics;
- JSON stringification without package payloads, source assets, or GPU-like
  handles.

Suggested commands:

- `pnpm exec vitest run test/webgpu/render-frame-plan.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Non-Goals

- No `WebGpuAppResourceReuseReport` changes.
- No backend cache summary grouping.
- No app-level successful route report emission.
- No material queue sorting changes.
- No render-world package or command submission changes.
- No ECS, source asset, or WebGPU handle exposure.

## Recommended Implementation Slice

Proceed with `task-0934`:

- add `createRenderFrameQueueDiagnosticsSummary()` in the WebGPU render-frame
  planning area;
- derive only scalar counts and diagnostic code totals from existing planning
  data;
- add focused render-frame plan tests for empty, ready, blocked, and
  missing-transform queue states.
