# Render-World Prepared Resource Summary Alignment Plan

Date: 2026-05-17

Task: `task-1002`

## Context

Aperture now has two adjacent summary surfaces:

- Renderer-independent prepared facade state in `@aperture-engine/render`:
  `PreparedMeshStore`, `PreparedMaterialStore`,
  `prepareAndBindSnapshotPreparedResourcesToRenderWorld()`, and render-world
  resource-key binding reports.
- WebGPU backend resource state in `@aperture-engine/webgpu`:
  `createRenderResourceSummaryReport()`, prepared GPU mesh/material caches,
  texture/sampler resources, shader modules, pipeline cache hits/misses, and
  resource lifecycle inspection.

These surfaces should become easier to compare without merging ownership. The
render package can summarize prepared facade readiness and render-world binding
state, but it must not count raw GPU buffers, bind groups, textures, samplers,
pipelines, or retained backend cache entries.

## Reference Anchors Inspected

- Aperture:
  - `packages/render/src/rendering/render-world-prepared-resources.ts`
  - `packages/render/src/rendering/render-world-prepared-meshes.ts`
  - `packages/render/src/rendering/render-world-prepared-materials.ts`
  - `packages/render/src/assets/preparation.ts`
  - `packages/webgpu/src/webgpu/resource-summary.ts`
  - `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
  - `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`
- Bevy:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/crates/bevy_render/src/render_resource/bind_group.rs`
  - `references/bevy/crates/bevy_pbr/src/material_bind_groups.rs`
  - `references/bevy/crates/bevy_pbr/src/render/mesh.rs`

Common pattern: source assets are prepared into render-owned resources, then
later queue/submit stages consume prepared keys or handles. Aperture should keep
its worker-friendly `RenderSnapshot` and JSON-safe facade summaries while
leaving GPU handles and retained cache details in the WebGPU backend.

## Smallest Alignment Slice

Add a render-package helper that produces a JSON-safe
`RenderWorldPreparedResourceSummary` from:

- `PreparedMeshStore`
- `PreparedMaterialStore`
- optional mesh/material binding reports
- optional `RenderWorld` draw-readiness counts

The helper should report facade-level fields that line up conceptually with
WebGPU app resource summaries:

- `preparedMeshes.totalEntries`
- `preparedMaterials.totalEntries`
- `preparedMaterials.families`
- `bindings.meshes.updated`
- `bindings.meshes.missing`
- `bindings.materials.updated`
- `bindings.materials.missing`
- `drawReadiness.ready`
- `drawReadiness.blocked`
- `diagnostics.warnings`
- `diagnostics.errors`

It should also expose a JSON conversion helper. The JSON value must avoid
including prepared store `entries` arrays by default, because the alignment
target is a compact status/counter surface rather than a detailed asset listing.
Detailed existing store JSON helpers should remain available for inspection.

## Explicit Non-Goals

- Do not move WebGPU cache counting into `@aperture-engine/render`.
- Do not expose `GPUBuffer`, `GPUBindGroup`, `GPUTexture`, or cache `Map`s.
- Do not merge retained backend cache summaries with facade summaries.
- Do not change frame-resource route behavior or successful-frame report shape.
- Do not change resource preparation or binding behavior.

## Implementation Follow-Up

Proceed with `task-1003`:

- Add the compact summary helper in `packages/render/src/rendering`.
- Export it through the render barrel.
- Add focused tests proving:
  - prepared mesh/material counts align with existing store summaries;
  - material family counts include unlit, matcap, standard, and debug-normal;
  - binding and readiness counts are optional but included when provided;
  - diagnostics are counted by severity;
  - JSON output is handle-safe and does not include backend cache data.

Expected validation:

- `pnpm exec vitest run test/rendering/render-world-prepared-resource-summary.test.ts`
- `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
