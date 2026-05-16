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

Start with `task-0254`. Mixed factor-only/textured unlit pipeline planning now has browser coverage; the next useful slice is proving texture UV orientation across all four quadrants.

## Ready Tasks

### task-0254 — Add quadrant texture UV browser readback coverage

Expand the texture-backed unlit browser fixture to prove both U and V sampling orientation with four distinct 2x2 texture quadrants.

Acceptance criteria:

- A browser scenario renders a 2x2 texture with four distinct quadrant colors.
- Readback samples cover left/right and upper/lower UV-separated pixels.
- Status reports expected quadrant colors and sample ids without raw GPU handles.
- Playwright verifies all four sampled pixels match their expected quadrant within tolerance.

### task-0255 — Add multi-pipeline render-frame planning unit coverage

Add unit coverage for a render frame containing two unlit pipeline keys and pipeline-scoped shared bind groups.

Acceptance criteria:

- `planRenderFrameFromSnapshot` resolves two pipeline resources in one frame.
- Shared group 0/1 bind groups remain associated with the matching pipeline key.
- Material group 2 bind groups remain associated with the matching material key.
- Tests cover a missing pipeline-scoped shared bind group diagnostic.

### task-0256 — Add sampler filter and address browser readback coverage

Render a texture-backed unlit browser scenario that proves sampler settings affect sampled pixels.

Acceptance criteria:

- Add a browser scenario using a texture plus non-default sampler settings.
- Status reports sampler key, filter/address settings, and expected sample ids.
- Playwright verifies sampled pixels reflect the configured sampler behavior when readback is available.
- Texture/sampler GPU resources remain renderer-owned and JSON-safe.

### task-0257 — Add texture upload row-stride diagnostics coverage

Add focused tests for texture upload descriptors with invalid or unsupported row-stride data.

Acceptance criteria:

- Texture GPU resource creation diagnoses invalid `bytesPerRow` and `rowsPerImage` inputs.
- Diagnostics include resource keys and avoid raw GPU handles.
- Valid tightly packed and padded uploads remain accepted.
- Existing textured browser scenarios continue to pass.

### task-0258 — Add textured unlit tint browser coverage

Render a texture-backed unlit material with a non-white `baseColorFactor` to prove texture color is multiplied by material tint.

Acceptance criteria:

- Add a browser scenario with a texture-backed unlit material and non-white tint.
- Status reports texture color, tint factor, and expected multiplied sample color.
- Playwright verifies the tinted texture pixel through readback when available.
- Existing texture-backed unlit scenarios continue to pass.

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
