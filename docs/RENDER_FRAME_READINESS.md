# Render Frame Readiness Reports

The MVP renderer path uses small data-only reports to explain whether an extracted frame is ready to become WebGPU work. These reports are diagnostics and orchestration data. They are not ECS state, and they do not make the renderer authoritative for gameplay or transforms.

## Report Chain

Renderer assembly smoke report:

- Checks that extracted render snapshot inspection, snapshot cloneability, draw package inspection, renderer resource summaries, and frame reports are present and ready.
- Summarizes snapshot, package, resource, and frame counts without exposing renderer-owned GPU objects.

Render pass assembly smoke report:

- Checks draw-list planning, render-pass resource resolution, command planning, and command execution.
- Carries draw and command counts plus diagnostics for missing pipelines, bind groups, buffers, or pass encoder methods.

Frame submission smoke report:

- Checks render-pass attachment planning, pass begin, command execution, pass end, command encoder finish, and queue submit.
- Summaries use booleans, counts, and stable resource keys. Command encoders, pass encoders, command buffers, and queue handles stay outside the summary surface.

Frame boundary validation report:

- Combines frame-boundary smoke readiness, clear compatibility, and merged source diagnostics.
- Counts smoke diagnostics, compatibility diagnostics, source diagnostics, warnings, and errors.

MVP frame readiness report:

- Aggregates renderer assembly, render-pass assembly, frame submission, and frame-boundary validation.
- Reports overall readiness, per-section readiness, key diagnostic counts, diagnostics, and JSON-safe summaries.

Renderer frame summary report:

- Combines renderer assembly, render-pass assembly, frame submission, frame-boundary validation, MVP readiness, and command-submission metrics.
- Reports overall readiness, section presence/readiness, planned draw counts, executed command counts, submitted command-buffer counts, and a diagnostic summary.

## Architecture Boundary

These reports are derived from render extraction and renderer-owned WebGPU preparation. ECS remains the source of truth for entities, components, transforms, and render authoring data.

Renderer-owned GPU state remains on the renderer side:

- GPU devices, contexts, queues, command encoders, pass encoders, command buffers, buffers, textures, bind groups, and pipelines are not stored in ECS components.
- Report JSON helpers expose only serializable booleans, counts, section statuses, stable keys, and diagnostic summaries.
- Future worker simulation can publish snapshots and diagnostics without sharing arbitrary WebGPU objects or a mutable scene graph.
