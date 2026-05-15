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

Start with `task-0158`. It adds phase diagnostics for the snapshot injected render frame runner.

## Ready Tasks

### task-0158 — Add injected render frame snapshot diagnostics helper

Create diagnostics grouping for the snapshot injected render frame runner.

Acceptance criteria:

- Group diagnostics by snapshot apply, binding, transform packing, draw readiness, and downstream render-world package phases.
- Reuse `summarizeInjectedRenderFrameRenderWorldPackageDiagnosticsByPhase` for downstream phases.
- Keep output JSON-safe and free of raw renderer or injected handles.
- Tests cover apply, binding, transform, readiness, and downstream failures.

### task-0159 — Add snapshot injected render frame fixture

Add a test fixture that starts from a render snapshot and runs the snapshot injected render frame helper.

Acceptance criteria:

- Fixture supports ready multi-draw output, duplicate render ids, missing resource bindings, missing transforms, and submit failure.
- Tests assert apply, binding, transform, readiness, package, descriptor, draw-list, frame execution, and summary counts.
- No production code imports test fixtures.

### task-0160 — Update render frame readiness docs for snapshot runner

Document the snapshot injected render frame runner and its relationship to render worlds, snapshots, bindings, and packed transforms.

Acceptance criteria:

- Explain when to use snapshots versus render-world readiness, draw packages, draw-command descriptors, and draw-list records.
- Clarify that the helper applies snapshots to render-world state but still does not query ECS directly or make rendering authoritative.
- Link the new helper from `docs/RENDER_FRAME_READINESS.md`.
- Keep the note linked from the architecture documentation.

### task-0161 — Add snapshot resource binding planner

Add a production helper that derives render-world resource binding updates from a render snapshot and resolver functions for mesh and material resource keys.

Acceptance criteria:

- Consume a `RenderSnapshot` and typed mesh/material resource key resolvers.
- Produce ordered binding updates suitable for `runInjectedRenderFrameFromSnapshot` without mutating `RenderWorld`.
- Report missing mesh resources, missing material resources, and duplicate render ids with diagnostics.
- Tests cover ready multi-draw output, missing mesh resources, missing material resources, duplicate render ids, and stable output order.

### task-0162 — Add ECS-extracted snapshot render frame fixture

Add a test fixture that builds a small ECS world, extracts a render snapshot, plans bindings, and runs the snapshot injected render frame helper.

Acceptance criteria:

- Fixture builds camera and renderable mesh entities through ECS components, then calls `extractRenderSnapshot`.
- Fixture uses the snapshot resource binding planner and `runInjectedRenderFrameFromSnapshot`.
- Tests assert extraction, apply, binding, transform, readiness, package, descriptor, draw-list, frame execution, and summary counts.
- Tests cover a skipped/invalid renderable diagnostic and submit failure.
- No production WebGPU code queries ECS directly.

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
