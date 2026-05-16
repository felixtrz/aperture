# Backlog

This file contains immediate executable tasks.

Agents should work on one task at a time, but should continue into the next ready task when the current task finishes before the 45-minute run window has elapsed.

Do not stop merely because one task is complete. Stop only when the 45-minute work window has elapsed, no ready task remains, or a stop condition applies.

When tasks are completed, move them to `agent/COMPLETED.md` or mark them complete here and summarize in handoff.

## Execution Note

The MVP 3D concept coverage gate is complete. Ready tasks are now implementation slices derived from:

- `docs/MVP_3D_CONCEPTS.md`
- `docs/research/TRANSFORM_AND_SPATIAL_COVERAGE.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`
- `docs/research/CAMERA_VIEW_RENDER_TARGET_COVERAGE.md`
- `docs/research/LIGHTING_ENVIRONMENT_SHADOW_COVERAGE.md`
- `docs/research/ASSET_LOADER_SCENE_IMPORT_COVERAGE.md`
- `docs/research/ANIMATION_SKINNING_MORPH_COVERAGE.md`
- `docs/research/INTERACTION_PICKING_PHYSICS_BOUNDARY_COVERAGE.md`
- `docs/research/RENDER_EXTRACTION_WEBGPU_BOUNDARY_COVERAGE.md`

Keep implementation vertical, typed, and testable. Do not introduce a public mutable scene graph, renderer-owned ECS/game state, or WebGL fallback.

## Task Categories

Every ready task must declare one primary category:

- `simulation`: ECS, assets, math, diagnostics, transforms, headless systems.
- `render-bridge`: render authoring components, extraction, snapshots, render
  world contracts, prepared-asset contracts.
- `webgpu-render`: GPU resources, WGSL, pipelines, bind groups, render passes,
  command encoding, submission, GPU diagnostics.
- `runtime-orchestration`: app facades, frame loop policy, examples, headless vs
  WebGPU mode selection.
- `docs-tooling`: docs, scripts, tests, validation, agent workflow.
- `audit-refactor`: architecture drift checks and small corrective refactors.

Reference anchors:

- `simulation`, `render-bridge`, and `runtime-orchestration` work should inspect
  `/Users/felixz/Projects/aperture/references/bevy` for ECS, assets, extraction,
  render app, material, and render-asset preparation patterns before
  implementation.
- `webgpu-render` work should inspect both
  `/Users/felixz/Projects/aperture/references/engine` and
  `/Users/felixz/Projects/aperture/references/three.js`, compare common render
  pipeline patterns, and adapt the best Aperture-specific version without
  copying code.
- `audit-refactor` work should compare implementation against the North Star,
  Architecture, Decisions, package boundaries, and the relevant reference
  anchors for the audited area.

Every few implementation tasks, keep an `audit-refactor` task in the ready queue
to catch drift before it compounds.

## Recommended Next Task

Start with `task-0560`. The next automation runs should prioritize the
user-facing lit spinning cube proof point over general render-pipeline cleanup.

`task-0557` and the metadata-only light shader tasks remain useful, but they are
not the critical path unless an implementation task proves they are blocking the
proof point.

## Near-Term Proof Point Track

Target proof point:

- A browser example renders a spinning cube through a simple user-facing API.
- Authoring starts from ECS entities/components, not renderer scene nodes.
- Mesh and material assets are created through typed collections.
- The cube uses a `StandardMaterial` MVP with metallic/roughness/base color.
- Lighting is active in the shader from at least ambient plus one directional
  light.
- `createWebGpuApp` or equivalent hides backend setup and frame-loop plumbing.
- Playwright verifies rendered pixels and JSON-safe frame diagnostics.

Remaining automation priority order:

1. `task-0566` — reuse WebGPU app prepared resources across frames.
2. `task-0542` — split render frame planning into extract, prepare, queue,
   sort phases.
3. `task-0557` — add view-uniform pack scratch writer.
4. `task-0534` — add light shader WGSL data contract.
5. `task-0535` — add light shader declaration JSON helper.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Ready Tasks By Category

### Proof Point Critical Path

### Audit / Refactor

### task-0566 — Reuse WebGPU app prepared resources across frames

Category: `runtime-orchestration`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`, standard/unlit frame
resource helpers, targeted WebGPU app tests.
Reference anchor: `docs/ARCHITECTURE.md` frame hot path allocation discipline,
Bevy render asset preparation/cache patterns in
`/Users/felixz/Projects/aperture/references/bevy`, and the local app facade
tests.

Turn the lit proof-point app facade from a setup-oriented renderer into a
steady-state frame loop that reuses prepared renderer-owned resources where the
source asset handles and pipeline layouts have not changed.

Acceptance criteria:

- `createWebGpuApp.render()` does not recreate the render pipeline, mesh GPU
  buffers, material buffers, bind groups, or light bind group on every
  successful unchanged frame.
- The world-transform buffer is updated for animation without replacing all
  prepared resources.
- Tests prove the second lit cube frame submits a draw while avoiding duplicate
  pipeline/material/mesh preparation events.
- Existing unlit `createWebGpuApp` behavior remains covered and compatible.
- Any remaining per-frame allocation convenience paths are documented as
  examples-only or have a follow-up backlog item.

### Deferred Supporting Render Cleanup

Only select these before the proof-point track if an active implementation task
shows they are a direct blocker.

### task-0542 — Split render frame planning into extract, prepare, queue, sort phases

Category: `render-bridge`
Package/write-scope: `packages/render/src`, `packages/webgpu/src/webgpu` only if
needed for naming adapters, targeted render/WebGPU tests.
Reference anchor: Bevy render schedules and phase queue/sort concepts in
`/Users/felixz/Projects/aperture/references/bevy`.

Make the current render-frame planning vocabulary match the Bevy-inspired stage
model without rewriting the renderer.

Acceptance criteria:

- Name and document extract, asset-change collection, prepare, queue, sort, and
  submit boundaries in render code or planning helpers.
- Existing unlit examples continue to render.
- Tests verify that the current draw packets can be queued and sorted through
  the named phase helpers.
- No PBR lighting math or shader activation is introduced.

### task-0557 — Add view-uniform pack scratch writer

Category: `render-bridge`
Package/write-scope: `packages/render/src/rendering/view-pack.ts`, targeted
view-pack and WebGPU view-uniform tests.
Reference anchor: `docs/DECISIONS.md` decision 0009 and
`docs/research/FRAME_HOT_PATH_ALLOCATION_AUDIT.md`.

Make view-uniform packing usable from a steady-state frame loop without
allocating fresh sets, valid-view arrays, view records, diagnostics, and output
buffers on successful frames.

Acceptance criteria:

- Add a `PackedSnapshotViewUniformsScratch` or equivalent object with reusable
  duplicate-view tracking, view records, diagnostics, and `Float32Array`
  storage.
- Keep `packSnapshotViewUniforms` as the allocation-friendly convenience helper.
- Avoid intermediate valid-view arrays in the writer.
- Tests prove view record/result identity and backing buffer reuse across
  repeated successful writes.
- Existing WebGPU view-uniform tests continue to pass.

### Deferred WebGPU / Render Pipeline Follow-Ups

The following metadata-only tasks are useful after the proof-point path, or if a
standard-material implementation chooses to reuse them directly. Do not select
them ahead of `task-0540` through `task-0563` unless they are blocking.

### task-0534 — Add light shader WGSL data contract

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted WebGPU shader/tests.
Reference anchor: Compare light/uniform/storage binding and shader declaration
patterns in `/Users/felixz/Projects/aperture/references/engine` and
`/Users/felixz/Projects/aperture/references/three.js`.

Define the WGSL struct/declaration contract for packed light float and metadata
buffers.

Acceptance criteria:

- Contract names the float and metadata storage bindings from
  `LIGHT_SHADER_BINDING_METADATA`.
- WGSL struct/declaration text documents the existing packing strides and field
  ordering.
- Tests verify binding numbers, group index, buffer access mode, and deterministic
  WGSL text.
- No render pipeline consumes the WGSL contract yet.

### task-0535 — Add light shader declaration JSON helper

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted WebGPU JSON/tests.
Reference anchor: Compare shader metadata/debug inspection patterns in
`/Users/felixz/Projects/aperture/references/engine` and
`/Users/felixz/Projects/aperture/references/three.js`.

Expose the WGSL light shader declaration contract through a JSON-safe inspection
helper.

Acceptance criteria:

- Helper serializes binding metadata and declaration text without shader modules
  or GPU handles.
- Tests cover deterministic JSON output and metadata/declaration consistency.
- Helper remains renderer-side inspection data only.

### task-0536 — Add unlit shader metadata variant with light bindings

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted shader metadata
tests.
Reference anchor: Compare pipeline/material binding layouts in
`/Users/felixz/Projects/aperture/references/engine` and
`/Users/felixz/Projects/aperture/references/three.js`.

Define a metadata-only shader variant that combines existing unlit draw bindings
with the future light bind group contract.

Acceptance criteria:

- Variant records required bind groups/bindings without changing shader
  execution.
- Tests validate the unlit bindings are preserved and light bindings are added
  at the expected group.
- No lighting math, shadows, skybox, IBL, or pipeline activation is introduced.

### task-0537 — Document light shader WGSL contract boundary

Category: `docs-tooling`
Package/write-scope: docs and package-level references only.
Reference anchor: The WebGPU shader contract implemented in `packages/webgpu`
plus the engine/three.js patterns inspected by the preceding `webgpu-render`
tasks.

Document the light WGSL declaration and metadata-only shader variant.

Acceptance criteria:

- Docs explain the contract prepares shader integration but does not enable
  lighting.
- Docs name the JSON/debug surfaces and raw-handle omissions.
- Format check passes.

### task-0538 — Run consolidated light shader contract validation

Category: `webgpu-render`
Package/write-scope: validation and focused fixes in `packages/webgpu` only.
Reference anchor: Existing WebGPU shader/resource tests and the engine/three.js
patterns documented by `task-0534` through `task-0536`.

Run broader validation after the WGSL contract and metadata-only shader variant
slices.

Acceptance criteria:

- `pnpm run check` passes.
- Lighting route Playwright coverage passes.
- Any validation failure is either fixed or documented in handoff.

## Post-Unlit E2E Verification Targets

Do not start these until the unlit browser path above is working end-to-end and Playwright can verify real rendered pixels reliably. Once that foundation is stable, expand browser E2E coverage across the broader runtime surface:

- Geometry coverage: verify all built-in primitive meshes and mesh upload paths render correctly in browser.
- Material coverage: verify unlit variants first, then add matcap/standard/PBR material paths as they exist.
- Texture coverage: verify texture upload, sampling, UV correctness, and missing-texture diagnostics.
- Lighting coverage: verify directional, point, spot, ambient/environment lighting when those paths are implemented.
- Camera/render-target coverage: verify multiple cameras, viewport/scissor behavior, and offscreen/render-target flows.
- Visibility/sorting coverage: verify layers, hidden/disabled renderables, opaque ordering, and transparency ordering.
- Diagnostics coverage: verify Playwright failure output exposes enough frame status to explain blank canvases, missing resources, or unsupported WebGPU.

Each expansion should keep the same rule: ECS is authoritative, rendering is derived from snapshots/render-world state, and browser verification proves pixels plus JSON-safe frame diagnostics.

## Superseded / Rewritten Tasks

The following pre-gate tasks are superseded by the EliCS adoption and MVP synthesis, or rewritten into the ready tasks above:

- `task-0004 — Implement component registry and storage`: superseded by EliCS adoption; remaining Aperture-specific component work is in `task-0028` and `task-0033`.
- `task-0005 — Implement ECS query API`: superseded by EliCS adoption; query usage should be tested in component and extraction tasks.
- `task-0006 — Implement system schedule`: rewritten into targeted system tasks beginning with `task-0029` and `task-0035`.
- `task-0007 — Add command and event model`: deferred until after the transform/render extraction foundation or rewritten as an input/command task when interaction work begins.
- `task-0008 — Add transform component types`: rewritten as `task-0028`.
- `task-0009 — Implement transform resolution system`: rewritten as `task-0029`.
- `task-0010 — Add render authoring components`: rewritten as `task-0033`.
- `task-0011 — Define asset handle types`: rewritten as `task-0030`.
- `task-0012 — Define RenderPacket and RenderSnapshot`: rewritten as `task-0034`.
- `task-0013 — Implement RenderExtractSystem`: rewritten as `task-0035`.
- `task-0014 — Add architecture invariant tests or checks`: distributed into `task-0030`, `task-0034`, `task-0035`, and `task-0036`.
- `task-0015 — Add WebGPU support detection`: rewritten as `task-0036`.

## Backlog Maintenance Rules

At the end of a run:

- Mark completed task(s).
- Add new tasks if the backlog has fewer than five ready tasks.
- New tasks must align with roadmap and the MVP feature contract.
- New tasks after the lit spinning cube proof point must also align with
  `docs/MEDIUM_LONG_TERM_GOALS.md`.
- New tasks must include category, package/write-scope, reference anchor, and
  acceptance criteria.
- Prefer vertical slices that preserve the ECS/render-extraction boundary.
- Keep a focused `audit-refactor` task in the queue after every three to five
  implementation tasks or any major package/API/render-pipeline boundary change.
