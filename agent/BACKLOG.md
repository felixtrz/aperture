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

Start with `task-0212`. Browser E2E can now verify clear, triangle, and multi-entity pixels through JSON-safe WebGPU current-texture readback in this environment, with screenshot fallback diagnostics retained. The next useful slice is to expand from custom example triangles into built-in primitive geometry coverage.

## Ready Tasks

### task-0212 — Add built-in primitive geometry browser readback coverage

Add a browser verification slice that renders at least one built-in primitive mesh through the ECS/render extraction/WebGPU path and verifies it with readback.

Acceptance criteria:

- The example uses primitive geometry from Aperture's mesh primitives rather than ad hoc inline vertex data.
- Browser status includes extraction, resource, draw, submission, and readback diagnostics.
- Playwright verifies at least one non-clear primitive pixel through readback.
- Renderer ownership boundaries remain unchanged: ECS authors handles/components; WebGPU resources stay outside ECS.

### task-0213 — Add unlit material variant browser readback coverage

Expand browser material verification beyond the current red/blue multi-entity sample.

Acceptance criteria:

- A browser example or existing example renders at least three distinct unlit material color variants.
- Status reports material/resource counts and readback samples for each visible color region.
- Playwright verifies each material color with readback tolerances.
- Tests still publish precise diagnostics when readback is unavailable.

### task-0214 — Add visibility and layer browser readback coverage

Add a browser verification slice for hidden or layer-filtered renderables.

Acceptance criteria:

- The scene includes at least one visible renderable and one hidden or layer-mismatched renderable.
- Status reports extraction/draw counts that explain why only the visible renderable submits draw calls.
- Readback verifies the hidden renderable's color is absent from sampled regions.
- Diagnostics remain JSON-safe and do not expose raw WebGPU handles.

### task-0215 — Add missing-resource browser diagnostic smoke

Add browser coverage for an ECS-authored renderable whose mesh or material resource is intentionally unavailable.

Acceptance criteria:

- The example/test creates a renderable with a missing mesh or material resource without mutating renderer-owned state into ECS.
- Status reports the failed phase and actionable resource-binding diagnostics.
- Playwright asserts no draw submission occurs for the missing resource.
- The failure payload remains JSON-safe.

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
