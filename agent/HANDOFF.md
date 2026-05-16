# Handoff

## Latest Run Update

Completed the lit StandardMaterial proof-point sequence and the first resource
inspection follow-up:

- `task-0561` — direct-lit StandardMaterial WGSL and pipeline.
- `task-0562` — standard material render selection.
- `task-0563` — lit spinning cube app-facade example and Playwright E2E.
- `task-0564` — post-proof-point architecture audit.
- `task-0565` — standard material resource inspection records.

What changed:

- Added `STANDARD_MESH_WGSL` and StandardMaterial pipeline helpers for a narrow
  direct-lit metallic/roughness MVP:
  - consumes view/world transforms, StandardMaterial uniform data, normals, and
    packed light buffers.
  - supports ambient and directional lights.
  - documents texture sampling, normal maps, IBL, and shadows as deferred.
- Added material pipeline selection and draw-list routing so standard draws
  require group 3 light bind groups and never silently fall back to unlit.
- Added StandardMaterial group-2 bind group resource creation and standard frame
  GPU resources for the app facade.
- Extended `createWebGpuApp.render()` to render `standard` materials through the
  new standard pipeline/resource path while preserving the existing unlit path.
- Reworked `examples/spinning-cube.js` to use the user-facing app facade:
  typed asset collections, ECS entity spawning, camera, ambient/directional
  lights, `SpinSystem`, and `app.render()` instead of manual WebGPU setup.
- Updated the spinning-cube Playwright spec to verify a nonblank lit cube,
  animation/frame progress, and JSON-safe status.
- Completed the architecture audit:
  - `@aperture-engine/core` and `@aperture-engine/runtime` remain headless.
  - StandardMaterial source data stays renderer-independent.
  - WebGPU objects are still backend-owned.
  - No scene graph or WebGL fallback was introduced.
  - Main follow-up is app-facade hot-path allocation/resource reuse.
- Added `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md` with the
  audit findings and validation record.
- Added `task-0566` for steady-state reuse of prepared WebGPU app resources
  across frames.
- Added StandardMaterial-specific resource inspection adapters that produce the
  existing generic material inspection records for live, missing, stale, and
  pending-destroy material buffer resources without exposing raw GPU handles.

Validation:

- `pnpm exec vitest run test/webgpu/standard-shader.test.ts test/webgpu/standard-pipeline-descriptor.test.ts test/webgpu/standard-pipeline.test.ts`
- `pnpm exec vitest run test/webgpu/material-pipeline-selection.test.ts test/webgpu/render-pass-draw-list.test.ts test/webgpu/standard-bind-group.test.ts test/materials/standard-proof-point.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/examples/navigation.test.mjs`
- `pnpm exec vitest run test/webgpu/standard-material-resource-inspection.test.ts`
- `pnpm run build`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check` passed: 152 test files / 706 tests.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed.

Reference files/patterns inspected:

- PlayCanvas/engine lit material and shader organization:
  - `references/engine/src/scene/graphics/light-cube.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/pass-forward/litForwardBackend.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/pass-forward/litForwardDeclaration.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/metalnessModulate.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/lightFunctionLight.js`
  - `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting/lightDeclaration.js`
- Three.js material/shader/render routing:
  - `references/three.js/src/materials/MeshStandardMaterial.js`
  - `references/three.js/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js`
  - `references/three.js/src/renderers/shaders/ShaderChunk/lights_physical_fragment.glsl.js`
  - `references/three.js/src/renderers/common/RenderList.js`
  - `references/three.js/src/renderers/common/Pipelines.js`
- Bevy ECS/render/material bridge:
  - `references/bevy/crates/bevy_pbr/src/material.rs`
  - render phase/material queue patterns under `references/bevy/crates/bevy_render`
- Project docs:
  - `docs/NORTH_STAR.md`
  - `docs/ARCHITECTURE.md`
  - `docs/DECISIONS.md`
  - `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`
- Existing Aperture app facade, WebGPU frame planning, light resource, unlit
  bind group, and browser E2E patterns.

Recommended next task:

- `task-0566 — Reuse WebGPU app prepared resources across frames`.

Known issues:

- `createWebGpuApp.render()` now proves the standard path but still creates
  pipelines and GPU resources per rendered frame. This is acceptable for the
  proof-point example, but it does not satisfy the frame hot-path allocation
  discipline for a steady-state runtime loop.
- StandardMaterial remains an MVP: texture sampling, normal maps, IBL, and
  shadows are intentionally deferred.
- Standard material resource inspection records now exist for material-buffer
  inspection; broader app-facade resource reuse is still pending.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/research/LIT_STANDARD_PROOF_POINT_AUDIT_2026_05_16.md`
- `examples/spinning-cube.js`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/render-pass-draw-list.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-resource-inspection.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-pipeline.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/unlit-shader.ts`
- `test/e2e/spinning-cube.spec.ts`
- `test/examples/navigation.test.mjs`
- `test/materials/standard-proof-point.test.ts`
- `test/webgpu/material-pipeline-selection.test.ts`
- `test/webgpu/render-pass-draw-list.test.ts`
- `test/webgpu/standard-bind-group.test.ts`
- `test/webgpu/standard-material-resource-inspection.test.ts`
- `test/webgpu/standard-pipeline-descriptor.test.ts`
- `test/webgpu/standard-pipeline.test.ts`
- `test/webgpu/standard-shader.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Completed the next proof-point bridge sequence through the renderer-independent
StandardMaterial contract, then ran a focused package-boundary audit.

What changed:

- Added typed asset collections:
  - Generic `TypedAssetCollection` in `@aperture-engine/simulation`.
  - Render-facing `createRenderAssetCollections()` with `assets.meshes.add(...)`
    and `assets.materials.standard.add(...)`.
  - Material collections derive texture/sampler dependencies into
    `AssetRegistry`.
- Added renderer-independent render asset preparation:
  - `RenderAssetAdapter`.
  - `PreparedRenderAssetStore`.
  - mesh/material prepared metadata stores.
  - deterministic prepare/update/retry/remove bookkeeping.
  - docs in `docs/RENDER_ASSET_PREPARATION.md`.
- Added minimal runtime authoring helpers:
  - `app.spawn(...)` on simulation/extraction app facades.
  - `withTransform`, `withMesh`, `withMaterial`, `withCamera`, `withLight`,
    visibility/layer/metadata helpers.
  - `Spin` and `SpinSystem` for proof-point examples/tests.
- Added `createWebGpuApp` in `@aperture-engine/webgpu`:
  - Initializes WebGPU from a canvas.
  - Exposes world/assets/spawn/step/extract/render/stepAndRender.
  - Renders the existing unlit path from extracted snapshots/render-world data.
  - Does not import runtime/core.
- Added StandardMaterial proof-point contract:
  - Explicit supported/deferred feature scope.
  - Validation distinguishes deferred texture/IBL/shadow features from invalid
    scalar inputs.
  - Extraction test proves StandardMaterial produces a distinct standard
    pipeline key without raw WebGPU handles.
- Completed package-boundary audit and recorded it in
  `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`.

Validation:

- `pnpm run check` passed.
- Focused tests also passed during the run:
  - `test/assets/typed-collections.test.ts`
  - `test/assets/render-asset-preparation.test.ts`
  - `test/runtime/runtime.test.ts`
  - `test/webgpu/webgpu-app.test.ts`
  - `test/materials/standard-proof-point.test.ts`

Reference files/patterns inspected:

- Bevy `crates/bevy_asset/src/assets.rs`
- Bevy `crates/bevy_asset/src/render_asset.rs`
- Bevy `crates/bevy_render/src/render_asset.rs`
- Bevy `crates/bevy_mesh/src/components.rs`
- Existing Aperture triangle/spinning-cube WebGPU setup and frame execution
  helpers.

Recommended next task:

- `task-0560 — Prepare StandardMaterial GPU data and bind layout`.

Known issues:

- `createWebGpuApp` currently covers the existing unlit path only.
- StandardMaterial GPU buffers, bind groups, WGSL, and draw routing are still
  pending.
- The lit spinning cube example and Playwright E2E are still pending.

Files touched in this update:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/BEVY_BRIDGE_PACKAGE_AUDIT_2026_05_16.md`
- `packages/simulation/src/assets/collections.ts`
- `packages/simulation/src/assets/index.ts`
- `packages/simulation/src/ecs/index.ts`
- `packages/render/src/assets/collections.ts`
- `packages/render/src/assets/index.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/index.ts`
- `packages/render/src/materials/index.ts`
- `packages/render/src/materials/standard-proof-point.ts`
- `packages/runtime/src/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/assets/render-asset-preparation.test.ts`
- `test/assets/typed-collections.test.ts`
- `test/materials/standard-proof-point.test.ts`
- `test/runtime/runtime.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Previous Run Update

Added medium/long-term guidance for post-proof-point work and updated
automation so stop-hook checkpoints are pushed upstream.

What changed:

- Added `docs/MEDIUM_LONG_TERM_GOALS.md` as the post-proof-point guidance doc.
- Recorded the material-family direction: `UnlitMaterial`, `MatcapMaterial`,
  `StandardMaterial`, `DebugNormalMaterial`, and optional simple lit material
  later only if it proves useful.
- Recorded the 3D import direction: focus on glTF 2.0 / GLB only; other 3D
  import formats require a later decision.
- Updated the roadmap, North Star, architecture, MVP concept map, wake prompts,
  backlog maintenance rules, and stop-hook prompt to reference the new guidance.
- Removed the older duplicate `scripts/CODEX_WAKE_PROMPT.md` and repointed the
  example autonomous runner to `agent/WAKE.md`.
- Updated `scripts/codex-stop-hook.sh` so it commits all changes and then pushes
  the current branch to its configured upstream.
- Enabled local Codex hooks in `.codex/config.toml`.

Validation:

- `pnpm run format:check` passed.
- `bash -n scripts/codex-stop-hook.sh` passed.
- `agent/STATUS.json` parses as valid JSON.

Recommended next task:

- `task-0540 — Add typed asset collection API over AssetRegistry`.

Files touched in this latest update:

- `.codex/config.toml`
- `AGENTS.md`
- `agent/BACKLOG.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`
- `agent/WAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/MVP_3D_CONCEPTS.md`
- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `scripts/STOP_HOOK_PROMPT.md`
- `scripts/CODEX_WAKE_PROMPT.md` (removed)
- `scripts/codex-stop-hook.sh`
- `scripts/codex_next_task_sh.md`

## Previous Run Update

Retargeted the ready backlog toward the near-term proof point: a user-facing
WebGPU example that spawns ECS entities, uses typed mesh/material assets,
renders a spinning cube with a StandardMaterial MVP, and verifies the lit output
with Playwright.

What changed:

- Made `task-0540 — Add typed asset collection API over AssetRegistry` the
  recommended next task.
- Added a near-term proof-point track with explicit automation priority:
  typed assets, render asset preparation, user-facing spawn/component API,
  `createWebGpuApp` facade, StandardMaterial render contract, StandardMaterial
  WebGPU preparation, direct-lit standard shader/pipeline, render selection
  routing, lit spinning cube E2E, and post-proof-point audit.
- Rewrote `task-0543` from an API sketch into an implementation task for the
  minimal user-facing ECS spawn/component API.
- Added new tasks `task-0558` through `task-0564` for the proof-point vertical
  slice and follow-up audit.
- Moved `task-0557`, `task-0542`, and metadata-only light shader tasks behind
  the proof point unless they become direct blockers.

Recommended next task:

- `task-0540 — Add typed asset collection API over AssetRegistry`.

## Previous Run Update

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
- The immediate backlog priority is now the lit StandardMaterial spinning cube
  proof point through user-facing ECS APIs. General render-pipeline cleanup
  remains available but should not displace the proof-point path unless it is a
  direct blocker.

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

Start with `task-0540 — Add typed asset collection API over AssetRegistry`.
