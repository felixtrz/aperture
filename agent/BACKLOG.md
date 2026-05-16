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

## Recommended Next Task

Start with `task-0540`. The monorepo split and first Bevy-style authoring pass
are in place, so the next bridge gap is a typed asset collection API over the
generic registry.

## Ready Tasks

### task-0540 — Add typed asset collection API over AssetRegistry

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

Make the current render-frame planning vocabulary match the Bevy-inspired stage
model without rewriting the renderer.

Acceptance criteria:

- Name and document extract, asset-change collection, prepare, queue, sort, and
  submit boundaries in render code or planning helpers.
- Existing unlit examples continue to render.
- Tests verify that the current draw packets can be queued and sorted through
  the named phase helpers.
- No PBR lighting math or shader activation is introduced.

### task-0543 — Add Bevy-aligned runtime API sketch and example target

Create a minimal API plan or vertical slice for declaring an ECS cube using
typed assets, mesh/material components, and a system that spins it.

Acceptance criteria:

- Target API shows headless simulation and WebGPU presentation can be selected
  separately.
- Example setup avoids direct WebGPU plumbing in user code.
- The plan or implementation references the mesh/material split and typed asset
  collections.
- Validation covers either the runnable example or the documented API contract.

### task-0534 — Add light shader WGSL data contract

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

Expose the WGSL light shader declaration contract through a JSON-safe inspection
helper.

Acceptance criteria:

- Helper serializes binding metadata and declaration text without shader modules
  or GPU handles.
- Tests cover deterministic JSON output and metadata/declaration consistency.
- Helper remains renderer-side inspection data only.

### task-0536 — Add unlit shader metadata variant with light bindings

Define a metadata-only shader variant that combines existing unlit draw bindings
with the future light bind group contract.

Acceptance criteria:

- Variant records required bind groups/bindings without changing shader
  execution.
- Tests validate the unlit bindings are preserved and light bindings are added
  at the expected group.
- No lighting math, shadows, skybox, IBL, or pipeline activation is introduced.

### task-0537 — Document light shader WGSL contract boundary

Document the light WGSL declaration and metadata-only shader variant.

Acceptance criteria:

- Docs explain the contract prepares shader integration but does not enable
  lighting.
- Docs name the JSON/debug surfaces and raw-handle omissions.
- Format check passes.

### task-0538 — Run consolidated light shader contract validation

Run broader validation after the WGSL contract and metadata-only shader variant
slices.

Acceptance criteria:

- `npm run check` passes.
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
- New tasks must have acceptance criteria.
- Prefer vertical slices that preserve the ECS/render-extraction boundary.
