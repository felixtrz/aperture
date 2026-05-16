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

Start with `task-0228`. Browser E2E now verifies plane and box primitive rendering, orthographic camera rendering, unlit material variants, hidden and disabled renderable skipping, layer mismatch, render-order overlap, missing renderer resource bindings, missing/failed/loading mesh and material assets, and unknown scenario diagnostics through JSON-safe status payloads. The next useful slice is to lock render sort order preservation through the draw planning stages.

## Ready Tasks

### task-0228 — Preserve render sort order through draw planning

Add focused unit coverage, and a fix if needed, so render-world package sort order is preserved through draw command descriptors, draw-list records, and render pass command planning.

Acceptance criteria:

- Tests cover a case where render sort order differs from render id order.
- Draw command descriptors, draw-list records, and render pass commands preserve the intended render order or intentionally document a different ordering decision.
- Existing diagnostics still report missing resources with stable render ids.
- Browser render-order overlap coverage remains passing.

### task-0229 — Refactor browser diagnostic scenario status builders

Reduce duplication across zero-submission browser diagnostic scenarios without changing published payload shapes.

Acceptance criteria:

- Shared helpers build extraction-failure and resource-binding-failure status payloads.
- Existing e2e diagnostics for missing resources, layer mismatch, asset states, and unknown scenarios still pass.
- The helpers do not serialize raw WebGPU handles.
- The example module remains easy to inspect for future scenarios.

### task-0230 — Add perspective camera FOV browser readback coverage

Add browser coverage for a primitive renderable viewed through a non-default perspective FOV.

Acceptance criteria:

- The scenario authors a perspective `Camera` with a non-default `fovYRadians`.
- Status reports projection type, FOV, extraction counts, draw counts, and readback samples.
- Playwright verifies a non-clear pixel through readback.
- The renderer still consumes extracted view packets and does not query ECS directly.

### task-0231 — Add mesh asset failed-diagnostic payload coverage

Expand failed asset browser diagnostics to verify asset registry diagnostic payloads remain inspectable.

Acceptance criteria:

- Failed mesh and material asset scenarios include safe asset diagnostic details from the registry.
- Playwright asserts the diagnostic code/message are present and JSON-safe.
- Extraction and submission counts remain unchanged.
- No raw asset objects or WebGPU handles are serialized.

### task-0233 — Add render layer positive/negative browser scenario

Add browser coverage where one renderable matches the camera layer and another renderable is skipped for a layer mismatch in the same scene.

Acceptance criteria:

- The scene authors two renderables with different layer masks and a camera layer mask that matches only one.
- Status reports one extracted draw, one `render.layerMismatch` diagnostic, resource/draw/submission counts for the visible renderable, and JSON-safe skipped-layer diagnostics.
- Readback verifies the visible color and absence of the skipped color.
- Renderer ownership boundaries remain unchanged.

### task-0234 — Add disabled renderable with visible peer browser coverage

Add browser coverage where one enabled renderable draws while a disabled peer is skipped.

Acceptance criteria:

- The scene authors one enabled renderable and one `Enabled.value = false` renderable.
- Status reports one extracted draw, one `render.disabled` diagnostic, and draw/submission counts for the enabled renderable.
- Readback verifies the enabled color and absence of the disabled color.
- The failure/diagnostic payload remains JSON-safe.

### task-0235 — Add sphere primitive mesh builder

Add a built-in `createSphereMeshAsset` primitive builder that follows the existing mesh asset schema and primitive vertex layout.

Acceptance criteria:

- `createSphereMeshAsset` emits interleaved `POSITION`, `NORMAL`, and `TEXCOORD_0` data.
- The mesh uses `triangle-list` topology, an index buffer, one default submesh, one material slot, local AABB, and local bounding sphere.
- Options cover at least radius, segment counts, label, and optional material handle.
- Unit tests validate vertex/index counts, representative positions/normals/UVs, bounds, and `validateMeshAsset` success.
- Existing plane and box primitive behavior remains unchanged.

### task-0236 — Add cylinder and cone primitive mesh builders

Add built-in cylinder and cone primitive builders using a shared implementation where practical.

Acceptance criteria:

- `createCylinderMeshAsset` and `createConeMeshAsset` emit interleaved `POSITION`, `NORMAL`, and `TEXCOORD_0` data.
- Both builders produce indexed `triangle-list` meshes with caps, one default submesh, one material slot, local AABB, and local bounding sphere.
- Options cover radius/radii, height, radial segments, height segments where useful, label, and optional material handle.
- Unit tests validate representative vertices, index ranges, bounds, and `validateMeshAsset` success.
- Degenerate or invalid segment/radius options are clamped or diagnosed consistently with existing primitive style.

### task-0237 — Add capsule and torus primitive mesh builders

Add the remaining MVP curved primitive builders after sphere/cylinder/cone coverage is in place.

Acceptance criteria:

- `createCapsuleMeshAsset` and `createTorusMeshAsset` emit interleaved `POSITION`, `NORMAL`, and `TEXCOORD_0` data.
- Both builders produce indexed `triangle-list` meshes with one default submesh, one material slot, local AABB, and local bounding sphere.
- Options cover dimensions, segment counts, label, and optional material handle.
- Unit tests validate representative vertices, index ranges, bounds, and `validateMeshAsset` success.
- The implementation does not add renderer-owned state or a scene graph convenience layer.

### task-0238 — Add browser primitive readback coverage for curved primitives

Render at least one newly added curved primitive through the existing ECS-to-WebGPU browser path.

Acceptance criteria:

- A multi-entity browser scenario renders a new built-in curved primitive, starting with `createSphereMeshAsset`.
- Status reports primitive metadata, extraction counts, resource counts, draw counts, and readback samples.
- Playwright verifies a non-clear pixel through GPU readback.
- The example still authors ECS components and feeds WebGPU through extracted snapshots/render-world state.

### task-0239 — Add depth-tested 3D overlap browser coverage

Add a browser scenario that proves true 3D depth behavior rather than only 2D screen-space overlap/order behavior.

Acceptance criteria:

- The scenario renders at least two overlapping 3D mesh entities at different depths.
- The render pass includes a depth attachment and an unlit pipeline descriptor with depth state.
- Readback verifies the nearer object wins when render order would otherwise not guarantee that result.
- Status reports depth format, draw counts, command counts, and JSON-safe diagnostics.
- Existing render-order overlap coverage remains passing.

### task-0240 — Add a narrow render-frame orchestration helper

Create a small helper that packages the currently manual example path from snapshot/render-world inputs through draw planning.

Acceptance criteria:

- The helper accepts an extracted `RenderSnapshot`, a caller-owned `RenderWorld`, packed transforms, resource binding resolvers, mesh resources, pipelines, and bind groups.
- The helper returns JSON-safe phase counts and diagnostics plus the render pass command plan.
- It does not create or own ECS state, WebGPU device/context, or hidden scene graph state.
- Unit tests cover success and missing-resource diagnostics.
- At least one browser example uses the helper without changing its published status payload shape.

### task-0241 — Add initial texture-backed unlit material design task

Define the smallest texture-backed unlit rendering slice before implementing texture upload and sampling.

Acceptance criteria:

- Document the proposed ECS/asset/render-world boundary for texture and sampler handles in the unlit material path.
- Identify the minimal WebGPU resources, bind group layout changes, diagnostics, and browser scenario needed.
- Confirm how missing/loading/failed texture assets should appear in extraction or resource-binding diagnostics.
- Add follow-up implementation tasks if the design is accepted.

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
