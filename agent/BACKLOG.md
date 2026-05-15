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

Start with `task-0121`. It gives frame execution reports the same by-section diagnostic inspection surface as renderer frame summaries.

## Ready Tasks

### task-0121 — Add frame execution diagnostics grouping helper

Create an agent-friendly helper that groups frame execution diagnostics by top-level section.

Acceptance criteria:

- Group diagnostics by boundary smoke, clear compatibility, diagnostic summary, boundary validation, submission smoke, and command submission metrics.
- Include counts by severity and diagnostic code for each section.
- Keep output JSON-safe and free of GPU handles.
- Tests cover missing command-metric inputs, source diagnostics, and stable repeated output.

### task-0122 — Add command submission metrics JSON helper

Create JSON-safe output for command submission metrics reports.

Acceptance criteria:

- Convert `CommandSubmissionMetricsReport` into a JSON-safe value.
- Include readiness, command counts, draw-call counts, command-buffer counts, submission counts, and diagnostics.
- Provide stable `commandSubmissionMetricsReportToJsonValue` and `commandSubmissionMetricsReportToJson` helpers.
- Tests cover ready reports, failed execution/finish/submit reports, and stable repeated JSON output.

### task-0123 — Add render frame readiness docs update

Update the render frame readiness docs for frame execution aggregates and summary-builder helpers.

Acceptance criteria:

- Document `FrameExecutionReport`, its JSON helper, and renderer frame summary builder relationship.
- Explain which helpers derive reports from frame-boundary assembly and which helpers remain summary-only.
- Reiterate that JSON helpers omit WebGPU handles and detailed injected objects.
- Link any new note from `docs/RENDER_FRAME_READINESS.md` if a separate file is added.

### task-0124 — Add injected frame execution runner helper

Add a small helper that assembles a frame boundary from injected context/device/queue/commands and immediately derives a frame execution report.

Acceptance criteria:

- Consume the same injected inputs as `assembleFrameBoundary`.
- Return both the boundary assembly report and derived frame execution report.
- Do not query ECS or store GPU handles in derived report surfaces.
- Tests cover ready execution plus texture, execution, finish, and submit failures.

### task-0125 — Add injected renderer frame summary runner helper

Add a helper that combines renderer/render-pass readiness reports with injected frame execution runner output into a renderer frame summary.

Acceptance criteria:

- Consume renderer assembly, render-pass assembly, and injected frame execution runner inputs.
- Return boundary assembly, frame execution report, renderer frame summary, and JSON summary value.
- Preserve renderer-owned GPU state outside ECS and outside JSON output.
- Tests cover all-ready input plus renderer, render-pass, texture, execution, and submit failures.

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
