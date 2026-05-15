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

Start with `task-0163`. It adds reusable resource-key resolver maps for snapshot binding plans.

## Ready Tasks

### task-0163 — Add snapshot resource resolver map helper

Add a production helper that creates typed snapshot resource-key resolvers from mesh and material handle-to-resource-key maps.

Acceptance criteria:

- Helper consumes readonly mesh/material resource-key lookup data without mutating it.
- Helper returns resolver functions compatible with `planInjectedRenderFrameSnapshotResourceBindings`.
- Missing mesh or material handles resolve to `null` so the planner emits its existing diagnostics.
- Tests cover ready lookups, missing mesh resources, missing material resources, duplicate handles, and stable lookup behavior.

### task-0164 — Add snapshot resource binding plan JSON helper

Add JSON-safe helpers for snapshot resource binding plans.

Acceptance criteria:

- JSON value includes binding count, render ids, mesh/material key presence, and diagnostic summary.
- String helper returns stable JSON from the value helper.
- Output omits raw renderer handles and injected objects.
- Tests cover ready plans, missing mesh/material resources, duplicate render ids, stable JSON, and raw-handle omission.

### task-0165 — Add snapshot resource binding plan diagnostics helper

Add diagnostic grouping for snapshot resource binding plans.

Acceptance criteria:

- Group planner diagnostics by duplicate render ids, missing mesh resources, and missing material resources.
- Include an aggregate diagnostic summary and ready boolean.
- Keep output JSON-safe and free of raw renderer or injected handles.
- Tests cover each diagnostic group and clean ready plans.

### task-0166 — Use resolver map helper in ECS snapshot fixture

Refactor the ECS-extracted snapshot render frame fixture to use the resolver map helper.

Acceptance criteria:

- Fixture still builds camera and renderable mesh entities through ECS components and calls `extractRenderSnapshot`.
- Fixture uses resolver maps plus `planInjectedRenderFrameSnapshotResourceBindings`.
- Tests still assert extraction, apply, binding, transform, readiness, package, descriptor, draw-list, frame execution, and summary counts.
- No production WebGPU code queries ECS directly.

### task-0167 — Document snapshot binding planner usage

Document the snapshot resource binding planner and resolver map helper.

Acceptance criteria:

- Explain how callers map extracted mesh/material handles to renderer-owned resource keys.
- Clarify that planning bindings does not mutate `RenderWorld` and does not query ECS.
- Link planner usage from `docs/RENDER_FRAME_READINESS.md`.
- Keep architecture text consistent with the snapshot/render-world boundary.

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
