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

Start with `task-0557`. Transform packing now has a scratch writer. View-uniform
packing is the next compact allocation-heavy packer to bring under the same
discipline.

## Ready Tasks By Category

### Render Pipeline Follow-Ups

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

### Render Bridge / ECS Binding

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
prepared resources without adding new GPU behavior.

Acceptance criteria:

- Add a `RenderAssetAdapter` or equivalent interface for source asset type,
  prepared asset type, version/dependency state, prepare result, and unload.
- Define prepared asset stores for at least mesh and material resource families.
- Contract lives outside the WebGPU backend and exposes no raw GPU handles.
- Tests cover deterministic prepare/update/remove bookkeeping with mock assets.
- Docs map the contract to the Bevy `RenderAsset` pattern.

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

### Runtime / Orchestration

### task-0543 — Add Bevy-aligned runtime API sketch and example target

Category: `runtime-orchestration`
Package/write-scope: `packages/runtime/src`, examples, runtime/browser tests as
needed.
Reference anchor: Bevy app/world/render-app orchestration concepts in
`/Users/felixz/Projects/aperture/references/bevy`.

Create a minimal API plan or vertical slice for declaring an ECS cube using
typed assets, mesh/material components, and a system that spins it.

Acceptance criteria:

- Target API shows headless simulation and WebGPU presentation can be selected
  separately.
- Example setup avoids direct WebGPU plumbing in user code.
- The plan or implementation references the mesh/material split and typed asset
  collections.
- Validation covers either the runnable example or the documented API contract.

### Audit / Refactor

### task-0544 — Audit Bevy bridge and package-boundary drift

Category: `audit-refactor`
Package/write-scope: docs, package manifests, imports, tests; small corrective
code changes only if directly tied to the audit findings.
Reference anchor: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`, and relevant
Bevy files under `/Users/felixz/Projects/aperture/references/bevy`.

Run a focused audit after the typed assets / render asset preparation /
runtime-orchestration bridge work starts landing.

Acceptance criteria:

- Verify package dependency directions still match `docs/ARCHITECTURE.md`.
- Verify ECS remains authoritative and WebGPU does not import runtime or core.
- Verify new public APIs still use `Mesh`/`Material` components and stable asset
  handles rather than scene-node state.
- Verify docs, backlog categories, and handoff describe the actual architecture.
- Add concrete follow-up backlog items for any drift that is too large to fix
  inside the audit task.
- Run `pnpm run check`.

### WebGPU / Render Pipeline

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
- New tasks must include category, package/write-scope, reference anchor, and
  acceptance criteria.
- Prefer vertical slices that preserve the ECS/render-extraction boundary.
- Keep a focused `audit-refactor` task in the queue after every three to five
  implementation tasks or any major package/API/render-pipeline boundary change.
