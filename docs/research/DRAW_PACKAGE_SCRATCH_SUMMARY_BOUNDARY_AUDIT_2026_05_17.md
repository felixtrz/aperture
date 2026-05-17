# Draw Package Scratch Summary Boundary Audit - 2026-05-17

## Scope

Audit `RenderWorldDrawPackageScratchSummary` after adding summary data to the
render-world draw package writer.

The goal is to verify that the summary describes derived package scratch reuse,
not backend GPU cache behavior, and that it does not expose draw packet payloads,
ECS state, source assets, or WebGPU handles.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/DECISIONS.md`
- `docs/research/QUEUED_DRAW_PACKAGE_CACHE_DIAGNOSTICS_PLAN_2026_05_17.md`
- `docs/research/RETAINED_BACKEND_CACHE_SUMMARY_GROUPING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/rendering/draw-package.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/rendering/draw-package.test.ts`
- `test/webgpu/frame-readiness.test.ts`

## Findings

### Summary describes scratch/package reuse only

`writeRenderWorldDrawPackages()` now updates a caller-owned
`RenderWorldDrawPackageScratchSummary` through the existing
`RenderWorldDrawPackageScratch`.

The summary reports:

- ready and blocked draw counts from the draw readiness report;
- produced draw package count;
- package pool size before and after the write;
- reused and newly created package slots;
- missing packed transform count;
- diagnostic totals by code.

These fields describe derived JavaScript package record reuse. They do not
describe renderer-owned GPU buffers, materials, textures, samplers, pipelines,
bind groups, command encoders, or submission state.

### Hot-path ownership remains caller-owned

The reusable writer keeps the summary object stable across writes. Tests assert
that `result.summary` is the same object as `scratch.summary`, and that reused
scratch capacity reports zero newly created package slots.

`planRenderWorldDrawPackages()` may still allocate its scratch as a convenience
helper, matching its previous behavior. The hot-path surface remains
`writeRenderWorldDrawPackages()` with caller-owned scratch.

### Packet and GPU payloads remain out of the summary

`RenderWorldDrawPackage` records still contain the derived `packet` reference as
before, but `RenderWorldDrawPackageScratchSummary` does not. It contains only
counts and diagnostic codes.

Focused tests stringify the summary and verify it does not include packet or
GPU markers. The summary does not read ECS worlds, source asset registries,
render-world resources, WebGPU devices, buffers, textures, bind groups, command
encoders, or browser objects.

### Backend cache reports remain separate

No `WebGpuAppResourceReuseReport` fields were added or renamed. The app-level
`counts.drawPackages` value still reports only the number of packages submitted
for the frame. Retained backend cache summaries remain scoped to prepared
mesh/material and texture/sampler resource caches.

This keeps the report distinction clear:

- draw package summary: derived package scratch reuse;
- app counts: frame draw package/command/call totals;
- backend cache summaries: retained renderer-owned GPU resources;
- facade summaries: renderer-independent prepared asset readiness.

## Result

No ownership or report-shape drift found.

The next ready implementation task can move to queued material route collector
array reuse. If draw package scratch summaries are later surfaced in app/frame
reports, that work should keep them outside `WebGpuAppResourceReuseReport`
unless a compatibility-focused report shape task says otherwise.
