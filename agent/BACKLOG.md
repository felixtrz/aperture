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

Start with `task-0380`. The browser route smoke coverage now covers
successful primitive, camera, visibility/order/depth, and texture scenarios; the
next useful slice is adding the same lightweight route/status guard for
extraction-failure scenarios that currently only have detailed specs.

## Ready Tasks

### task-0380 — Add route smoke for extraction failure scenarios

Add lightweight route/status coverage for core extraction-failure scenarios.

Acceptance criteria:

- A focused Playwright loop loads layer mismatch, disabled renderable, missing
  mesh/material asset, and mesh/material asset status scenarios.
- The test asserts `phase: "extract"`, the expected scenario key, and no draw
  submission.
- It does not duplicate detailed diagnostic body assertions from existing specs.
- Targeted Playwright coverage continues to pass.

### task-0381 — Add route smoke for texture asset failure scenarios

Add lightweight route/status coverage for texture and sampler asset failure
scenarios that are not already covered by shared route guards.

Acceptance criteria:

- A focused Playwright loop loads missing/loading/failed texture and sampler
  dependency scenarios plus multi-textured missing texture/sampler asset routes.
- The test asserts `phase: "extract"`, the expected diagnostic code, and no draw
  submission.
- Shared-sampler/shared-texture route guards remain focused and passing.
- Targeted Playwright coverage continues to pass.

### task-0382 — Extract shared multi-entity route loader helper

Reduce route-spec duplication by centralizing multi-entity scenario URL loading
and status waiting.

Acceptance criteria:

- A shared test helper loads `/examples/multi-entity.html?scenario=...` and
  returns the published status.
- Existing route smoke specs use the helper where practical.
- Status attachments and WebGPU unsupported skips still behave as before.
- Targeted typecheck and Playwright route coverage pass.

### task-0383 — Add route smoke coverage table to docs

Add a concise browser e2e docs table that maps route smoke specs to scenario
families.

Acceptance criteria:

- `docs/BROWSER_E2E_RENDERING.md` includes a table for route guard specs and
  their scenario families.
- The table distinguishes route/status guards from detailed pixel/readback
  specs.
- No implementation behavior changes.

### task-0384 — Add route smoke status attachments

Ensure lightweight route smoke specs attach status JSON on assertion failures.

Acceptance criteria:

- Primitive, camera, visibility/order/depth, texture, resource-binding, and
  texture-upload route smoke specs attach their final status payload.
- Existing helper behavior is reused rather than duplicating attachment code.
- Targeted Playwright coverage confirms attachments do not affect passing
  routes.

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
