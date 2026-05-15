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

Start with `task-0111`. It gives the MVP frame readiness aggregate the same stable JSON-safe surface as the lower-level reports.

## Ready Tasks

### task-0111 — Add MVP frame readiness JSON helper

Create JSON-safe summaries for MVP frame readiness reports.

Acceptance criteria:

- Convert `MvpFrameReadinessReport` into a JSON-safe value.
- Include overall readiness, section readiness, key counts, and diagnostics.
- Provide a stable `mvpFrameReadinessReportToJson` helper.
- Tests cover ready reports, blocked reports, diagnostics, and stable repeated JSON output.

### task-0112 — Add renderer frame summary aggregate

Combine renderer assembly, render-pass assembly, submission, frame-boundary, MVP readiness, and command-submission metrics into one data-only frame summary.

Acceptance criteria:

- Consume existing report objects without touching GPU handles.
- Report overall readiness and top-level draw/command/submission counts.
- Preserve source diagnostics with stable section labels.
- Tests cover all-ready input, missing sections, and mixed diagnostics.

### task-0113 — Add renderer frame summary JSON helper

Create JSON-safe output for the renderer frame summary aggregate.

Acceptance criteria:

- Convert the renderer frame summary into a JSON-safe value.
- Omit injected handles and command encoder/pass encoder objects.
- Include section readiness, counts, and diagnostic summary.
- Tests cover stable repeated JSON output and no handle leakage.

### task-0114 — Add frame execution smoke fixture

Add a test-only fixture factory that builds a ready injected frame execution path across clear/frame-boundary/render-pass helpers.

Acceptance criteria:

- Fixture produces ready texture view, encoder, pass, finish, and submit reports.
- Fixture can inject failures at texture, begin, execute, finish, and submit boundaries.
- Existing frame-boundary and submission smoke tests can use it where practical.
- Tests cover fixture defaults and at least two injected failure points.

### task-0115 — Add render frame readiness docs

Document the current MVP frame readiness pipeline and report relationships.

Acceptance criteria:

- Add a concise architecture note describing renderer assembly, render-pass assembly, frame submission, frame-boundary validation, and MVP readiness.
- Explain that reports are data-only and renderer-owned GPU state remains outside ECS.
- Link the note from the relevant docs or handoff.
- No architecture invariant changes are introduced.

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
