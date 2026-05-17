# Prepared/App Resource Reuse Alignment Summary Plan

Date: 2026-05-17

Task: `task-1051`

## Goal

Decide whether prepared facade summary counts need a compact comparison against
WebGPU app resource reuse/backend counts now.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `packages/render/src/rendering/render-world-prepared-resource-summary.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-resource-lifetime-alignment-summary.ts`
- `test/webgpu/prepared-resource-lifetime-alignment-summary.test.ts`
- `examples/app-diagnostics.js`
- `docs/research/PREPARED_RESOURCE_LIFETIME_SUMMARY_CLEANUP_PLAN_2026_05_17.md`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Current Surfaces

The relevant surfaces are intentionally separate:

- `RenderWorldPreparedResourceSummary` reports render-package prepared facade
  entries, render-world bindings, draw readiness, and diagnostic severity
  counts.
- `WebGpuAppResourceReuseReport` reports app/backend reuse counters and already
  contains compact prepared mesh/material facade JSON from the WebGPU app.
- `PreparedResourceLifetimeAlignmentSummary` compares prepared facade counts
  with a backend `RenderResourceSummaryReport` for stale/missing/pending-destroy
  inspection.

The missing link is a compact helper for tests/examples that want to compare the
render-package prepared summary with the WebGPU app reuse report's prepared
facade counts and resource creation/reuse counters.

## Decision

Add an opt-in WebGPU helper for prepared/app reuse alignment.

Recommended helper shape:

```ts
createPreparedResourceAppReuseAlignmentSummary({
  facade,
  reuse,
});
```

Where:

- `facade` is a `RenderWorldPreparedResourceSummary` or compatible compact
  shape.
- `reuse` is a `WebGpuAppResourceReuseReport`.

The output should include:

- render facade prepared mesh/material counts and ready/blocked draw counts;
- app report prepared mesh/material facade entry counts;
- app resource creation/reuse counters for prepared mesh buffers, prepared
  material buffers, prepared material bind groups, texture resources, samplers,
  and dynamic buffer writes;
- warning diagnostics only when render facade counts differ from app prepared
  facade counts.

## Boundary Rules

- Keep the helper in `@aperture-engine/webgpu`; it consumes WebGPU app reuse
  report shapes.
- Do not add the summary to every successful app frame by default.
- Do not place the summary under `resourceReuse`.
- Do not move WebGPU cache maps or backend resource ownership into the render
  package.
- Do not expose prepared store entries, resource keys, raw cache maps, buffers,
  textures, samplers, bind groups, pipelines, or GPU handles.

## Follow-Up Task

Use `task-1052` to implement the helper with targeted tests. If example
integration is useful, keep it example-owned and opt-in, matching the existing
app diagnostics summary policy.
