# Render-World Prepared Summary Consumer Plan

Date: 2026-05-17

Task: `task-1048`

## Goal

Decide whether `createRenderWorldPreparedResourceSummary()` needs a reusable
consumer helper or should remain directly composed by examples/tests.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DIAGNOSTICS_SUMMARIES.md`
- `packages/render/src/rendering/render-world-prepared-resource-summary.ts`
- `packages/render/src/rendering/render-world-prepared-resources.ts`
- `test/rendering/render-world-prepared-resource-summary.test.ts`
- `examples/app-diagnostics.js`
- `test/e2e/app-diagnostics.spec.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Proven Pattern

Bevy keeps source assets, extracted assets, and render-world prepared assets in
separate stages. Preparation reports are useful as render-world readiness data,
but GPU resources and backend caches stay in the render/backend side rather
than moving into app-facing source asset state.

Aperture's current equivalent is:

```text
source asset registry
  -> prepared mesh/material facade stores
  -> render-world resource-key bindings
  -> draw-readiness report
  -> optional diagnostics summary
```

`createRenderWorldPreparedResourceSummary()` already preserves this boundary by
summarizing prepared facade counts, binding counts, draw-readiness counts, and
diagnostic severity totals without WebGPU cache state.

## Decision

Add a small reusable render-package consumer helper for the standard
`prepareAndBindSnapshotPreparedResourcesToRenderWorld()` report shape.

The helper should:

- accept the prepared mesh/material stores;
- accept the prepare-and-bind report;
- optionally accept a draw-readiness report and extra diagnostics;
- delegate to `createRenderWorldPreparedResourceSummary()`;
- avoid double-counting binding/readiness diagnostics;
- stay in `@aperture-engine/render`, not `@aperture-engine/webgpu`;
- return the same compact `RenderWorldPreparedResourceSummary` shape.

This is narrower than an app report field. It standardizes the repeated
consumer wiring while keeping prepared facade summaries separate from WebGPU
backend cache summaries.

## Non-Goals

- Do not add prepared summary data to every successful app report by default.
- Do not merge prepared facade counts into `resourceReuse`.
- Do not expose prepared store entry arrays, asset handles, resource keys,
  backend cache maps, or GPU handles.
- Do not move WebGPU resource lifetime or cache inspection into the render
  package.

## Follow-Up Task

Use `task-1049` to implement the helper and targeted render-package coverage.
The test should prove that diagnostics from apply/preparation, binding, draw
readiness, and explicit caller diagnostics are counted once and that the JSON
summary remains free of backend/cache details.
