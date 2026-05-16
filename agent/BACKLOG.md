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

## Task Categories

Every ready task must declare one primary category:

- `simulation`: ECS, assets, math, diagnostics, transforms, headless systems.
- `render-bridge`: render authoring components, extraction, snapshots, render
  world contracts, prepared-asset contracts.
- `webgpu-render`: GPU resources, WGSL, pipelines, bind groups, render passes,
  command encoding, submission, GPU diagnostics.
- `runtime-orchestration`: app facades, frame loop policy, examples, headless vs
  WebGPU mode selection.
- `docs-tooling`: docs, scripts, tests, validation, agent workflow.
- `audit-refactor`: architecture drift checks and small corrective refactors.

Reference anchors:

- `simulation`, `render-bridge`, and `runtime-orchestration` work should inspect
  `/Users/felixz/Projects/aperture/references/bevy` for ECS, assets, extraction,
  render app, material, and render-asset preparation patterns before
  implementation.
- `webgpu-render` work should inspect both
  `/Users/felixz/Projects/aperture/references/engine` and
  `/Users/felixz/Projects/aperture/references/three.js`, compare common render
  pipeline patterns, and adapt the best Aperture-specific version without
  copying code.
- `audit-refactor` work should compare implementation against the North Star,
  Architecture, Decisions, package boundaries, and the relevant reference
  anchors for the audited area.

Every few implementation tasks, keep an `audit-refactor` task in the ready queue
to catch drift before it compounds.

## Recommended Next Task

Start with `task-0574`. The lit StandardMaterial proof point, resource reuse,
scratch-backed app frame planning, MatcapMaterial source contract, app reuse
diagnostics, material asset dependency readiness report, and follow-up boundary
audit are complete. The next run should surface material dependency readiness
through app render failures.

## Near-Term Proof Point Track

Target proof point:

- A browser example renders a spinning cube through a simple user-facing API.
- Authoring starts from ECS entities/components, not renderer scene nodes.
- Mesh and material assets are created through typed collections.
- The cube uses a `StandardMaterial` MVP with metallic/roughness/base color.
- Lighting is active in the shader from at least ambient plus one directional
  light.
- `createWebGpuApp` or equivalent hides backend setup and frame-loop plumbing.
- Playwright verifies rendered pixels and JSON-safe frame diagnostics.

Remaining automation priority order:

1. `task-0574` — surface material asset dependency readiness in app render
   failures.
2. `task-0575` — add MatcapMaterial render-preparation metadata plan.
3. `task-0576` — diagnose the app facade's current single-draw resource
   limitation.
4. `task-0577` — add texture/sampler resource reuse diagnostics for app
   reports.
5. `task-0578` — add material readiness report JSON serialization helper.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Ready Tasks By Category

### Proof Point Critical Path

### Audit / Refactor

### Runtime / Diagnostics

### task-0574 — Surface material asset dependency readiness in app render failures

Category: `runtime-orchestration`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts` and targeted app
tests, no new WebGPU resource types.
Reference anchor: `docs/ARCHITECTURE.md` diagnostics requirements and Bevy
material dependency readiness patterns.

Use the renderer-independent material asset dependency readiness report when
the app facade fails or blocks on texture/sampler source dependencies.

Acceptance criteria:

- `WebGpuAppRenderReport` can include JSON-safe material dependency readiness
  when a material references missing/loading/failed texture or sampler handles.
- Missing dependency diagnostics identify the material field and dependency
  handle key.
- Existing successful untextured unlit and standard app paths stay unchanged.
- No raw WebGPU handles are included in dependency readiness JSON.

### task-0575 — Add MatcapMaterial render-preparation metadata plan

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials` or
`packages/render/src/assets`, tests only; no WebGPU shader activation.
Reference anchor: Bevy material prepare contracts and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Add renderer-independent preparation metadata for MatcapMaterial so later WebGPU
work has a typed dependency/render-state contract to consume.

Acceptance criteria:

- Define a MatcapMaterial prepare-plan data shape with material key, dependency
  handles, render state, and pipeline-key input.
- Plan reports missing texture/sampler source dependencies using existing
  material dependency readiness data.
- Tests cover ready and blocked MatcapMaterial prepare plans.
- No WGSL, WebGPU buffers, bind groups, pipelines, or active rendering are
  introduced.

### task-0576 — Diagnose app facade single-draw resource limitation

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts` and app tests.
Reference anchor: render-world readiness diagnostics and the North Star's
agent-readable diagnostics requirement.

Make the current `createWebGpuApp.render()` first-draw resource limitation
explicit instead of silently binding only the first draw's resources.

Acceptance criteria:

- Multi-draw snapshots whose draws reference unsupported additional source
  mesh/material handles produce a JSON-safe diagnostic.
- Single-draw and same-resource multi-draw snapshots keep passing.
- The diagnostic explains that a broader render-world resource cache is future
  work.
- No attempt is made to implement full multi-asset caching in this task.

### task-0577 — Add texture/sampler resource reuse diagnostics for app reports

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/texture-resources.ts` if needed, and targeted tests.
Reference anchor: WebGPU resource summary helpers and Bevy prepared asset cache
reporting patterns.

Extend app resource reuse reporting to texture and sampler GPU resources once
textured app paths are active.

Acceptance criteria:

- Reuse reports distinguish created/reused texture resources and sampler
  resources.
- Reports use stable resource keys and counts only, not raw GPU handles.
- Tests cover first-frame creation and second-frame reuse on a textured unlit
  app path.
- If texture/sampler GPU resource reuse is not active yet, document the blocker
  and add the narrower enabling task.

### task-0578 — Add material readiness report JSON serialization helper

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials` and targeted material
tests.
Reference anchor: Existing JSON-safe light shader metadata helpers and
`docs/ARCHITECTURE.md` diagnostics requirements.

Add an explicit JSON value helper for material dependency readiness reports so
app-facing diagnostics can depend on a stable serialized contract.

Acceptance criteria:

- Define a `MaterialAssetDependencyReadinessReportJsonValue` shape.
- Add a serializer for material dependency readiness reports that preserves
  material key/status/kind, dependency slot statuses, and diagnostics.
- Serialized values use handle keys and strings only, not raw asset or GPU
  objects.
- Tests cover ready unlit and blocked standard material reports.

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
- New tasks after the lit spinning cube proof point must also align with
  `docs/MEDIUM_LONG_TERM_GOALS.md`.
- New tasks must include category, package/write-scope, reference anchor, and
  acceptance criteria.
- Prefer vertical slices that preserve the ECS/render-extraction boundary.
- Keep a focused `audit-refactor` task in the queue after every three to five
  implementation tasks or any major package/API/render-pipeline boundary change.
