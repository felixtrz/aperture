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

Start with `task-0540`. The next automation runs should prioritize the
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

Automation priority order:

1. `task-0540` — typed asset collections.
2. `task-0541` — renderer-independent render asset preparation contract.
3. `task-0543` — minimal user-facing ECS spawn/component API.
4. `task-0558` — WebGPU app facade over the existing unlit path.
5. `task-0559` — StandardMaterial proof-point render contract.
6. `task-0560` — StandardMaterial GPU preparation and bind layout.
7. `task-0561` — direct-lit StandardMaterial WGSL and pipeline.
8. `task-0562` — route standard materials through extraction/render-world draw
   selection.
9. `task-0563` — user-facing lit spinning cube example and Playwright E2E.
10. `task-0564` — proof-point architecture audit.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Ready Tasks By Category

### Proof Point Critical Path

### task-0540 — Add typed asset collection API over AssetRegistry

Category: `render-bridge`
Package/write-scope: `packages/simulation/src/assets`, `packages/render/src`,
targeted asset/render tests.
Reference anchor: Bevy typed `Assets<T>` resources and asset handles in
`/Users/felixz/Projects/aperture/references/bevy`.

Add a small typed asset collection layer that returns stable handles without
requiring callers to manually assemble kind/id pairs.

Acceptance criteria:

- Provide typed collections for meshes and materials first.
- Common authoring supports `assets.meshes.add(createBoxMeshAsset(...))` and
  `assets.materials.standard.add(createStandardMaterialAsset(...))` or a
  similarly concise API.
- Adding an asset registers it in the underlying `AssetRegistry`.
- Updating asset readiness/status keeps existing registry diagnostics behavior.
- Tests cover handle stability, duplicate detection, status transitions, and
  dependency reporting through the underlying registry.
- API remains usable in headless Node/worker contexts.

### task-0541 — Define renderer-independent render asset preparation contract

Category: `render-bridge`
Package/write-scope: `packages/render/src`, docs, targeted render tests.
Reference anchor: Bevy `RenderAsset` / prepared render asset pattern in
`/Users/felixz/Projects/aperture/references/bevy`.

Define the TypeScript contract for converting source assets into renderer-owned
prepared resources without adding broad new GPU behavior.

Acceptance criteria:

- Add a `RenderAssetAdapter` or equivalent interface for source asset type,
  prepared asset type, version/dependency state, prepare result, and unload.
- Define prepared asset stores for at least mesh and material resource families.
- The contract is sufficient for the StandardMaterial proof point: source
  material data, dependency readiness, prepared material metadata, and removal.
- Contract lives outside the WebGPU backend and exposes no raw GPU handles.
- Tests cover deterministic prepare/update/remove bookkeeping with mock assets.
- Docs map the contract to the Bevy `RenderAsset` pattern.

### task-0543 — Implement minimal user-facing ECS spawn/component API

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src`, `packages/core/src`, runtime tests,
and focused docs/examples only if needed.
Reference anchor: Bevy app/world/render-app orchestration concepts in
`/Users/felixz/Projects/aperture/references/bevy`.

Implement the smallest user-facing layer that makes ECS authoring feel like the
intended end state while still returning/using real EliCS entities.

Acceptance criteria:

- Provide a `spawn` helper on the app or world facade that creates an entity and
  attaches typed component initializers.
- Provide concise component initializer helpers for transform, `Mesh`,
  `Material`, camera, light, visibility/layer, and simple per-frame spin data
  if needed for the proof-point example.
- Preserve headless mode: the API works in `createSimulationApp` /
  `createExtractionApp` without WebGPU or browser globals.
- The returned entity remains inspectable and compatible with existing EliCS
  component APIs.
- Tests cover spawn, component attachment, a simple spin system, and extraction
  from the authored entity.

### task-0558 — Add WebGPU app facade over existing unlit render path

Category: `runtime-orchestration`
Package/write-scope: `packages/webgpu/src`, `packages/runtime/src` only if the
facade needs shared types, examples, and Playwright/runtime tests.
Reference anchor: Bevy app/render-app separation in
`/Users/felixz/Projects/aperture/references/bevy`, plus WebGPU setup and frame
execution patterns in `/Users/felixz/Projects/aperture/references/engine` and
`/Users/felixz/Projects/aperture/references/three.js`.

Create the first `createWebGpuApp`-style facade that hides device/context
initialization and the current unlit render-frame plumbing.

Acceptance criteria:

- User code can create an app with a canvas, add systems/assets/entities, and
  call `step`, `render`, or `run` without manually wiring WebGPU buffers,
  pipelines, bind groups, or command encoders.
- The facade consumes extracted snapshots/render-world data; it does not query
  gameplay ECS directly from the backend.
- Headless `createSimulationApp` / `createExtractionApp` remains usable without
  importing or initializing WebGPU.
- Existing unlit spinning cube behavior can be expressed through this facade or
  an adapter route.
- Playwright or browser tests verify the facade can render a nonblank unlit
  cube/frame before PBR is added.

### task-0559 — Add StandardMaterial proof-point render contract

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials`,
`packages/render/src/rendering`, targeted material/render tests, and docs if the
contract shape changes.
Reference anchor: Bevy material asset/render contract patterns in
`/Users/felixz/Projects/aperture/references/bevy`.

Define the renderer-independent contract for the MVP StandardMaterial path used
by the proof point.

Acceptance criteria:

- The proof-point StandardMaterial scope is explicit: base color factor,
  metallic factor, roughness factor, emissive factor if already present,
  alpha/depth/cull state, ambient plus direct lights; no IBL, shadows, normal
  maps, texture sampling, or transmission.
- Material validation distinguishes unsupported deferred features from invalid
  proof-point inputs.
- Pipeline/material key inputs include enough information to choose standard vs
  unlit rendering deterministically.
- Tests cover StandardMaterial validation, pipeline key generation, and
  extraction/render packet metadata needed to select the standard path.
- No raw WebGPU handles are introduced in render package material data.

### task-0560 — Prepare StandardMaterial GPU data and bind layout

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted WebGPU material,
bind group, buffer, and resource-summary tests.
Reference anchor: Compare material uniform/bind group preparation in
`/Users/felixz/Projects/aperture/references/engine` and
`/Users/felixz/Projects/aperture/references/three.js`.

Prepare the MVP StandardMaterial data for WebGPU without activating the lit
pipeline yet.

Acceptance criteria:

- Add a packed material uniform/storage layout for base color, metallic,
  roughness, emissive, and feature flags needed by the proof point.
- Add WebGPU bind group layout metadata and validation for the standard material
  group.
- Preparation consumes renderer-independent StandardMaterial data and produces
  renderer-owned buffer/bind group resource descriptors.
- Existing resource summary/inspection helpers can report standard material
  readiness without raw GPU handles.
- Tests cover packing layout, bind group metadata, missing resource diagnostics,
  and stable cache/resource keys.

### task-0561 — Add direct-lit StandardMaterial WGSL and pipeline

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, WGSL/shader metadata,
pipeline descriptors/cache tests, and focused browser rendering tests if
available.
Reference anchor: Compare direct lighting/PBR material shader organization in
`/Users/felixz/Projects/aperture/references/engine` and
`/Users/felixz/Projects/aperture/references/three.js`.

Add the first lit standard-material shader path. This should be a narrow,
PBR-shaped MVP rather than full production PBR.

Acceptance criteria:

- The standard shader consumes world/view transforms, vertex normals, packed
  StandardMaterial data, and existing extracted light data.
- Lighting supports ambient plus at least one directional light from ECS
  authoring/extraction.
- The BRDF is documented as an MVP direct-light metallic/roughness model; IBL,
  shadows, normal maps, and texture sampling remain explicitly deferred.
- Pipeline descriptors and cache keys distinguish unlit and standard variants.
- Tests verify deterministic WGSL/metadata, pipeline key differences, and basic
  light/material binding requirements.

### task-0562 — Route standard materials through render selection

Category: `render-bridge`
Package/write-scope: `packages/render/src/rendering`,
`packages/webgpu/src/webgpu`, targeted render/WebGPU tests.
Reference anchor: Bevy queue/material specialization concepts in
`/Users/felixz/Projects/aperture/references/bevy`, plus render queue patterns in
the local Three.js and PlayCanvas references.

Wire StandardMaterial draw selection end to end through extraction, render-world
state, draw package planning, and WebGPU pipeline/bind-group selection.

Acceptance criteria:

- Draw planning can choose unlit or standard rendering from the material handle
  / material asset kind without renderer-owned scene state.
- Mixed unlit and standard materials produce deterministic draw ordering and
  separate pipeline keys where needed.
- Missing or unprepared standard material resources produce actionable
  diagnostics instead of falling back silently.
- Existing unlit routes continue to pass.
- Targeted tests cover standard material draw selection and mixed-material
  frames.

### task-0563 — Add user-facing lit spinning cube example and Playwright E2E

Category: `runtime-orchestration`
Package/write-scope: `examples`, `test/playwright` or existing browser test
fixtures, package exports only if needed.
Reference anchor: Bevy-style ECS authoring from
`/Users/felixz/Projects/aperture/references/bevy`; browser rendering validation
patterns from existing Aperture Playwright routes.

Build the near-term proof point: a spinning cube rendered with a StandardMaterial
through the simple user-facing API.

Acceptance criteria:

- Example code creates a WebGPU app, registers a box mesh asset and standard
  material asset through typed collections, spawns ECS entities for cube,
  camera, ambient light, and directional light, adds a spin system, and runs the
  frame loop.
- Example code avoids manual backend setup, raw GPU resource wiring, and direct
  render-pipeline calls.
- Playwright verifies a nonblank lit cube, animation/frame progress, and
  JSON-safe diagnostics/status for the route.
- The route fails loudly if WebGPU is unavailable, extraction emits no drawable
  mesh, or standard material resources are not ready.
- Existing unlit examples and Playwright coverage continue to pass.

### Audit / Refactor

### task-0544 — Audit Bevy bridge and package-boundary drift

Category: `audit-refactor`
Package/write-scope: docs, package manifests, imports, tests; small corrective
code changes only if directly tied to the audit findings.
Reference anchor: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`, and relevant
Bevy files under `/Users/felixz/Projects/aperture/references/bevy`.

Run a focused audit after the typed assets / render asset preparation /
runtime-orchestration bridge work starts landing. If the proof-point track is in
progress, prefer running this after `task-0563` unless a boundary concern blocks
implementation earlier.

Acceptance criteria:

- Verify package dependency directions still match `docs/ARCHITECTURE.md`.
- Verify ECS remains authoritative and WebGPU does not import runtime or core.
- Verify new public APIs still use `Mesh`/`Material` components and stable asset
  handles rather than scene-node state.
- Verify docs, backlog categories, and handoff describe the actual architecture.
- Add concrete follow-up backlog items for any drift that is too large to fix
  inside the audit task.
- Run `pnpm run check`.

### task-0564 — Audit lit proof point against architecture and references

Category: `audit-refactor`
Package/write-scope: docs, package manifests/imports, examples, tests; small
corrective code changes only if directly tied to audit findings.
Reference anchor: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`, local Bevy
material/extraction files, and the Three.js/PlayCanvas shader/render pipeline
files relevant to the implemented standard path.

Run the first post-proof-point architecture audit.

Acceptance criteria:

- Verify the lit cube example uses ECS entities/components and typed assets
  rather than renderer-owned scene objects.
- Verify headless simulation/extraction still works without importing WebGPU.
- Verify StandardMaterial source data remains renderer-independent and GPU
  resources remain WebGPU-owned.
- Verify the direct-lit MVP is documented clearly as not full PBR/IBL/shadows.
- Add follow-up backlog tasks for any drift or missing cleanup, including
  hot-path allocation work if the new frame facade introduced per-frame
  allocation risk.
- Run `pnpm run check` and the lit cube Playwright route.

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
