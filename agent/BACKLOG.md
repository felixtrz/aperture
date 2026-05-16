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

Start with `task-0302`. Combined shared-sampler missing resource coverage is in place; the next useful slice is extraction-time coverage for one missing texture asset in a shared-sampler pair.

## Ready Tasks

### task-0302 — Add shared-sampler missing texture asset extraction coverage

Verify extraction diagnostics when one material in a shared-sampler textured pair references an unregistered texture asset.

Acceptance criteria:

- A browser scenario authors two shared-sampler textured materials and leaves one texture asset unregistered.
- Status reports the missing texture asset key and extraction diagnostic.
- Playwright verifies no resource creation or draw submission is attempted.

### task-0303 — Add texture diagnostics availability coverage for shared-sampler cases

Keep available-scenario reporting aligned with the new shared-sampler diagnostics scenarios.

Acceptance criteria:

- Unknown-scenario Playwright coverage asserts representative shared-sampler asset/resource diagnostics scenarios are advertised.
- Scenario availability assertions remain partial and stable.
- Existing unknown-scenario behavior is unchanged.

### task-0304 — Add texture diagnostic matrix coverage for shared-sampler rows

Ensure the texture/sampler diagnostics matrix includes all shared-sampler asset/resource cases.

Acceptance criteria:

- `docs/BROWSER_E2E_RENDERING.md` includes shared-sampler missing texture asset, missing sampler asset, missing texture resource, missing sampler resource, and combined resource rows.
- Each row lists the expected phase and primary diagnostic.
- No implementation behavior changes.

### task-0305 — Add multi-textured asset diagnostic assertion helper

Reduce repeated asset-key diagnostic assertions in multi-textured asset failure tests.

Acceptance criteria:

- A local helper maps status diagnostics to code/asset-key pairs.
- Multi-textured missing texture/sampler asset tests use the helper where practical.
- Existing Playwright typechecks continue to pass.

### task-0306 — Add combined shared-sampler availability coverage

Advertise the combined shared-sampler missing resource scenario through the unknown-scenario availability status.

Acceptance criteria:

- Unknown-scenario Playwright coverage asserts `shared-sampler-missing-texture-sampler-resources` is advertised.
- Scenario availability assertions remain partial and stable.
- Existing unknown-scenario behavior is unchanged.

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
