# Handoff

## Latest Run Update

Implemented the render pipeline reference follow-up sequence `task-0546`
through `task-0550`, completed `task-0551` for the first hot-path allocation
audit, added scratch-backed writers through `task-0554`, completed the
extraction/packing allocation audit in `task-0555`, and added the transform-pack
scratch writer in `task-0556`.

What changed:

- Added render-frame phase vocabulary and summary reports for apply, prepare,
  queue, resolve, command, and submit phases.
- Expanded WebGPU pipeline cache keys so they include shader family/variant,
  render targets, bind group layouts, vertex layout, primitive/depth/blend
  state, material variants, and batch compatibility fields.
- Added unlit bind group layout metadata and validation for required groups,
  duplicate bindings, missing required bindings, and resource-kind mismatches.
- Added view/pass-scoped render queue records in `@aperture-engine/render`,
  including a reusable scratch/record-pool writer for allocation-conscious
  frame-loop use.
- Added renderer resource inspection for live, missing, stale, and
  pending-destroy resources, and bridged inspection diagnostics into resource
  summaries.
- Added architecture and decision-log coverage for the new rule: no steady-state
  render hot-path allocation on successful per-frame paths.
- Added `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md` and a reusable
  draw-package writer/scratch API:
  `createRenderWorldDrawPackageScratch` and `writeRenderWorldDrawPackages`.
- Added `createRenderFramePlanScratch` / `writeRenderFramePlanFromSnapshot`,
  `createDrawCommandDescriptorScratch` / `writeDrawCommandDescriptors`, and
  `createRenderPassDrawListScratch` / `writeRenderPassDrawList`.
- Added `createResolveRenderPassResourcesScratch` /
  `writeResolveRenderPassResources` and `createRenderPassCommandScratch` /
  `writeRenderPassCommands`.
- Audited extraction, transform packing, view packing, snapshot resource
  binding plans, and `RenderWorld.applySnapshot` for remaining allocation risks.
- Added `createPackedSnapshotTransformsScratch` and
  `writePackedSnapshotTransforms`, with `floatCount` on packed transform results
  for scratch-backed buffers.

Validation completed so far:

- Focused render/WebGPU Vitest slice passed.
- `pnpm run typecheck` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check` passed.
- Focused Playwright render routes passed:
  spinning cube, primitive routing, mixed unlit pipelines, textured/multi-textured
  unlit, sampler routing, multi-entity, depth overlap, and disabled renderable
  coverage.

Recommended next task:

- `task-0557 — Add view-uniform pack scratch writer`.

## Current Status

The render pipeline reference audit, its first implementation follow-ups, and
the first hot-path allocation cleanup tasks are complete.

Recent architecture state:

- The pnpm monorepo/package-boundary refactor is implemented.
- Active packages are `@aperture-engine/simulation`,
  `@aperture-engine/render`, `@aperture-engine/webgpu`,
  `@aperture-engine/runtime`, and `@aperture-engine/core`.
- The active render authoring model uses separate `Mesh` and `Material`
  components rather than `MeshRenderer`.

Latest workflow update:

- `agent/WAKE.md` now requires categorizing selected tasks before
  implementation.
- Ready backlog tasks now include category, package/write-scope, and reference
  anchor metadata.
- Reference policy is explicit:
  - ECS binding, render bridge, assets, and orchestration should anchor on
    `/Users/felixz/Projects/aperture/references/bevy`.
  - WebGPU/render-pipeline work should compare
    `/Users/felixz/Projects/aperture/references/engine` and
    `/Users/felixz/Projects/aperture/references/three.js`, then adapt the common
    patterns to Aperture.
- The backlog now includes recurring `audit-refactor` tasks to catch
  architecture drift every few implementation tasks or after boundary changes.

Previous audit context:

- Added `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`.
- Confirmed `/Users/felixz/Projects/aperture/references/engine` is the
  PlayCanvas engine checkout and used it as the canonical PlayCanvas reference.
- Compared Aperture's current render pipeline against local Three.js and
  PlayCanvas renderer implementations.
- Documented the current Aperture pipeline:
  `RenderSnapshot -> RenderWorld.applySnapshot -> resource binding updates ->
draw readiness report -> RenderWorldDrawPackage plan -> DrawCommandDescriptor
plan -> RenderPassDrawList plan -> render pass resource resolution ->
RenderPassCommand plan -> command execution/frame report`.
- Added prioritized follow-up tasks `task-0546` through `task-0550` for render
  phases, pipeline cache keys, bind group layout metadata, view/pass queues, and
  resource lifetime/version inspection.

Reference files inspected for the audit:

- Three.js `src/renderers/common/RenderLists.js`
- Three.js `src/renderers/common/RenderList.js`
- Three.js `src/renderers/common/RenderObjects.js`
- Three.js `src/renderers/common/RenderObject.js`
- Three.js `src/renderers/common/Pipelines.js`
- Three.js `src/renderers/common/Bindings.js`
- Three.js `src/renderers/webgpu/WebGPUBackend.js`
- PlayCanvas `src/scene/frame-graph.js`
- PlayCanvas `src/scene/composition/render-action.js`
- PlayCanvas `src/scene/renderer/render-pass-forward.js`
- PlayCanvas `src/scene/renderer/forward-renderer.js`
- PlayCanvas `src/platform/graphics/bind-group-format.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-render-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-bind-group.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-draw-commands.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-graphics-device.js`

## Architecture Notes

- ECS remains authoritative.
- Rendering remains derived from extracted snapshots/render-world data.
- `@aperture-engine/simulation` imports no render/runtime/WebGPU packages.
- `@aperture-engine/render` imports simulation only.
- `@aperture-engine/runtime` imports simulation and render only.
- `@aperture-engine/core` does not import or export WebGPU.
- `@aperture-engine/webgpu` does not import runtime or core.
- WebGPU examples import `@aperture-engine/core` and
  `@aperture-engine/webgpu` explicitly.
- The renderer pipeline now has the first reference-audit follow-ups in place:
  explicit phases, expanded pipeline keys, bind group metadata, view/pass queue
  records, and resource inspection.
- Per decision 0009, future frame-loop work must distinguish hot-path writer
  APIs from allocating diagnostic/setup helpers.
- Draw package planning, view/pass queue planning, render-frame result/summary
  planning, draw command descriptors, and draw-list planning now have
  scratch-backed writer APIs. Resource resolution and command planning also now
  have scratch-backed writer APIs.
- Remaining allocation risk is earlier in the frame: snapshot extraction,
  binding-plan/update aggregation, and transform/view packing.
- Transform packing now has that scratch writer; view-uniform packing is the
  next compact packer to update.

## Files Touched

Primary implementation:

- `packages/render/src/rendering/render-queue.ts`
- `packages/render/src/rendering/draw-package.ts`
- `packages/render/src/rendering/transform-pack.ts`
- `packages/webgpu/src/webgpu/draw-command.ts`
- `packages/webgpu/src/webgpu/render-frame-phases.ts`
- `packages/webgpu/src/webgpu/render-frame-plan.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `packages/webgpu/src/webgpu/render-pass-resources.ts`
- `packages/webgpu/src/webgpu/render-pass-commands.ts`
- `packages/webgpu/src/webgpu/pipeline-cache.ts`
- `packages/webgpu/src/webgpu/unlit-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group-layout.ts`
- `packages/webgpu/src/webgpu/resource-lifecycle.ts`
- `packages/webgpu/src/webgpu/resource-summary.ts`

Docs/bookkeeping:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md`
- `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

- Focused render/WebGPU Vitest slice passed.
- `pnpm run typecheck` passed.
- `pnpm run typecheck:test` passed.
- `pnpm run check` passed.
- Focused Playwright render routes passed.

## Known Issues

- Typed asset collections are still not implemented; callers still use
  `AssetRegistry` directly.
- Render asset preparation is still spread across render/WebGPU helpers and
  examples rather than a formal renderer-independent adapter contract.
- Runtime does not yet provide a `createWebGpuApp` facade; WebGPU examples still
  contain backend setup code.
- PBR remains blocked on typed assets, material-family contracts, and render
  asset preparation.
- View packing and resource-binding planning still need scratch-backed writers
  before a real runtime frame loop or deeper PBR work. Snapshot creation remains
  the explicit copy boundary until a reusable builder or delta transport design
  is chosen.

## Recommended Next Task

Start with `task-0557 — Add view-uniform pack scratch writer`.
