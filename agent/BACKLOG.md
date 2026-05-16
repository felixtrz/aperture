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

Start with `task-0170`. It extends the verified one-draw browser path toward a tiny multi-entity scene.

## Ready Tasks

### task-0170 — Render multi-entity simple scene in browser

Extend browser rendering from one mesh entity to a tiny simple scene.

Acceptance criteria:

- Example renders at least two ECS mesh entities with distinct transforms and unlit colors/materials.
- Frame status reports two extracted draws, two ready bindings, two draw packages, and two draw calls.
- Render order remains deterministic through the existing snapshot/draw planning path.
- No mutable scene graph or renderer-owned gameplay state is introduced.

### task-0171 — Add Playwright multi-entity scene verification

Add browser E2E coverage for the simple multi-entity scene.

Acceptance criteria:

- Playwright verifies the multi-entity example reaches a successful frame status.
- Test asserts expected draw counts and command counts.
- Pixel/screenshot checks prove at least two non-background colored regions are present.
- Test artifacts or failure logs make blank canvas and resource binding failures easy to diagnose.

### task-0172 — Document browser E2E rendering workflow

Document the new browser rendering path and verification workflow.

Acceptance criteria:

- Add docs explaining how ECS authoring flows into snapshots, render-world resources, WebGPU submission, and Playwright verification.
- Document local commands for build, serve, and browser tests.
- Explain WebGPU browser support expectations and skipped/unsupported behavior.
- Keep architecture language explicit that ECS remains authoritative and rendering remains derived.

### task-0173 — Add multi-material unlit resource helper

Add a helper for the browser multi-entity path that uploads one shared mesh/view/transform set plus multiple unlit materials.

Acceptance criteria:

- Helper accepts packed view data, packed transform data, one mesh asset, and at least two unlit material assets.
- Helper creates one shared mesh resource, one shared view buffer, one shared world-transform buffer, and one material buffer plus group-2 bind group per material.
- Returned resource keys remain stable and compatible with render-world binding and draw-list planning.
- Tests cover two materials, missing material data, and deterministic bind group ordering.

### task-0174 — Add static example server tests

Add non-listening tests for the example server path and MIME behavior so harness regressions are caught without requiring a local TCP listener.

Acceptance criteria:

- Server path resolution can be tested without opening a port.
- Tests cover `/`, `/examples/triangle.html`, `/dist/index.js`, and denied traversal paths.
- Tests cover JavaScript, HTML, CSS, JSON/source-map, and fallback MIME types.
- The server remains Node-built-in only and does not gain framework dependencies.

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
