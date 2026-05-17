# Queued Draw Package Cache Diagnostics Plan - 2026-05-17

## Scope

Plan JSON-safe diagnostics for render-world draw package scratch reuse.

This is a planning slice only. It does not change runtime report fields, draw
package sorting, resource preparation, command encoding, GPU submission, or the
public app API.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_FRAME_READINESS.md`
- `docs/research/GENERIC_QUEUED_PREPARED_RESOURCE_REPORT_PLAN_2026_05_17.md`
- `docs/research/RETAINED_BACKEND_CACHE_SUMMARY_GROUPING_PLAN_2026_05_17.md`
- `packages/render/src/rendering/draw-package.ts`
- `packages/render/src/rendering/package-inspection.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `test/rendering/draw-package.test.ts`
- `test/webgpu/render-frame-plan.test.ts`

## Current State

`writeRenderWorldDrawPackages()` already supports the frame hot path through
caller-owned `RenderWorldDrawPackageScratch`:

- `packages` is cleared and reused each write.
- `diagnostics` is cleared and reused each write.
- `packagePool` retains mutable package records and grows only when the frame
  needs more package slots than the prior capacity.
- `plan` is stable and points at the reused arrays.

App-level `WebGpuAppRenderReport.counts.drawPackages` reports how many draw
packages reached the current frame. `WebGpuAppResourceReuseReport` separately
reports GPU/backend cache behavior such as prepared mesh/material caches,
texture/sampler caches, pipelines, bind groups, buffers, and light buffers.

Those report surfaces answer different questions:

- draw package count: "how many derived draw package records were queued this
  frame?"
- draw package scratch/cache diagnostics: "did the queue writer reuse package
  records or grow its caller-owned package pool?"
- backend resource cache summaries: "which renderer-owned GPU resource caches
  are retained or reused?"

## Proposed Diagnostic Shape

Add a renderer-side diagnostic helper for draw package scratch behavior instead
of adding draw package counters to `WebGpuAppResourceReuseReport`.

Suggested shape:

```ts
export interface RenderWorldDrawPackageScratchSummary {
  readonly readyDrawCount: number;
  readonly blockedDrawCount: number;
  readonly packageCount: number;
  readonly packagePoolSize: number;
  readonly packagePoolSizeBeforeWrite: number;
  readonly packageSlotsReused: number;
  readonly packageSlotsCreated: number;
  readonly missingPackedTransformCount: number;
  readonly diagnostics: {
    readonly total: number;
    readonly byCode: Record<string, number>;
  };
}
```

The helper should describe reusable JS package records, not GPU resources. It
must not include `packet` objects, source assets, WebGPU handles, command
encoders, bind groups, buffers, textures, devices, or ECS world references.

## Writer Placement

Keep the hot-path writer allocation-conscious:

1. Extend `RenderWorldDrawPackageScratch` with a mutable summary object, or add
   a sibling `RenderWorldDrawPackageScratchSummaryScratch`.
2. Capture `packagePool.length` before package planning.
3. After writing packages, derive:
   - `packageCount` from `packages.length`;
   - `packagePoolSize` from `packagePool.length`;
   - `packageSlotsReused` as `min(packageCount, packagePoolSizeBeforeWrite)`;
   - `packageSlotsCreated` as
     `max(0, packagePoolSize - packagePoolSizeBeforeWrite)`;
   - `missingPackedTransformCount` from draw package diagnostics;
   - `diagnostics.total` and `diagnostics.byCode` from the reused diagnostics
     array.
4. Return the same summary object on each write when using caller-owned scratch.

The convenience `planRenderWorldDrawPackages()` may allocate its scratch, as it
already does today. The reusable `writeRenderWorldDrawPackages()` path should be
the implementation surface for hot-path behavior.

## App Report Placement

Do not add this under `WebGpuAppResourceReuseReport`.

Near-term options, in order:

1. Keep the helper in `@aperture-engine/render` with focused tests only.
2. Thread the summary into `RenderFramePlanSummary.phases.queue.counts` if frame
   plan diagnostics need it.
3. Add an app-level frame planning diagnostics section only if users need to
   inspect scratch growth from `createWebGpuApp`.

`WebGpuAppRenderReport.counts.drawPackages` should remain the simple frame
count. Retained backend cache summaries should stay scoped to renderer-owned GPU
resources.

## Validation Plan

Focused implementation tests should cover:

- empty draw package writes produce zero packages and a reusable summary object;
- a second write with the same capacity reports reused package slots and no
  created slots;
- a later write that exceeds the prior pool reports only the newly created
  slots;
- blocked draws and missing packed transforms are counted without exposing draw
  packets;
- JSON projection stringifies without `packet`, `gpu`, `device`, `buffer`,
  `texture`, or `bindGroup` fields.

Suggested commands:

- `pnpm exec vitest run test/rendering/draw-package.test.ts`
- `pnpm exec vitest run test/webgpu/render-frame-plan.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Non-Goals

- No GPU resource cache grouping.
- No changes to draw package ordering.
- No command descriptor, draw-list, or render-pass changes.
- No app-level report field rename.
- No ECS, source asset, or WebGPU handle exposure.

## Recommended Follow-Up

Add a focused `render-bridge` task for `RenderWorldDrawPackageScratchSummary`
after the current material queue phase summary slice. Keep it in
`packages/render/src/rendering/draw-package.ts` and targeted draw-package tests
first; only wire it into app reports later if a concrete debugging need appears.
