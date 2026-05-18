# Backlog

This file contains immediate executable tasks.

Agents should work on one task at a time, but should continue into the next ready task when the current task finishes before the 55-minute run window has elapsed.

Do not stop merely because one task is complete. Stop only when the 55-minute work window has elapsed, no ready task remains, or a stop condition applies.

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

Start with `task-1529`. `task-1421` through `task-1528` completed GLB
metallic-roughness transformed-UV1 coverage, combined StandardMaterial browser
coverage for base-color/metallic-roughness, base-color/metallic-roughness/normal,
base-color/occlusion/emissive, and base-color/alpha-mask/emissive, built-in app
adapter validation diagnostics, generic app diagnostics/resource item/set route
contract cleanup, audits, tracker alignment, alpha texture assertion helper
cleanup, follow-up planning, generic routed-item report serialization, and the
remaining route collector diagnostics surface audit. This run selected,
implemented, and audited occlusion strength and normal texture scale
StandardMaterial/glTF browser mapping coverage. The next ready task is a focused
visual normal-scale proof audit because the mapping fixture reports the scale
correctly but the current single-plane lighting setup does not produce a
deterministic readback delta between scale values. The follow-up audit selected
a Standard texture control-style scalar-vs-normal comparison inside the glTF
fixture as the next implementation slice.

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

1. `task-1529` — implement deterministic visual normal-scale browser proof.
2. `task-1530` — audit tracker/backlog alignment after visual normal-scale
   proof.
3. `task-1531` — plan next route or StandardMaterial follow-up after normal
   scale visual proof.
4. `task-1532` — audit selected follow-up plan after normal-scale planning.
5. `task-1533` — audit tracker/backlog alignment after normal-scale follow-up
   plan audit.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Strategic Focus

The next focus area is the renderer/material architecture spine:

```text
source material asset
  -> readiness diagnostics
  -> render queue item
  -> prepared WebGPU resources
  -> pipeline and bind groups
  -> draw submission
```

Do not prioritize IBL, shadows, a GLB viewer, or broader feature work until this
spine is generic enough that new material families do not require another
family-specific app route. The current renderer can already prove the ECS-to-
WebGPU path with lit StandardMaterial content; the main risk now is letting the
specialized proof path become permanent architecture.

Preferred refill order after the current ready queue:

1. Finish generic material-family queue and preparation contracts inside the
   existing WebGPU app/render-world path.
2. Tighten StandardMaterial glTF metallic-roughness fidelity: texture
   dependency diagnostics, sampler/color-space/UV behavior, alpha modes,
   double-sided/cull behavior, and compatibility audits.
3. Mature render-world/prepared-asset lifetime, cache reports, resource
   invalidation, and hot-path allocation discipline for the material queue.
4. Add IBL/environment lighting for StandardMaterial once source material and
   prepared-resource contracts are stable.
5. Add shadow-map passes and StandardMaterial shadow sampling after IBL or when
   a focused proof point requires shadows.
6. Bring GLB material mapping and viewer work forward only when it can target
   real `StandardMaterial` and `UnlitMaterial` behavior without pretending
   unsupported PBR features are rendered.

Estimated remaining runway to a credible lit glTF render pipeline:

- About 14-20 focused automation tasks for a production-shaped pipeline that can
  load/map simple GLB materials and render lit metallic-roughness content with
  honest diagnostics, assuming no major redesign is found.
- About 10-14 of those tasks are renderer/material architecture work: generic
  queue adapters, render-world prepared resources, phase sorting, resource
  lifetime/cache reporting, warning guards, and audits.
- About 5-7 tasks are StandardMaterial/glTF fidelity work: final dependency
  diagnostics, sampler/color-space/UV/alpha/double-sided behavior, and browser
  verification.
- About 3-5 tasks are minimal GLB material mapping/viewer integration once the
  above contracts are stable.
- IBL and shadows can add another 6-10 tasks if "complete" means physically
  plausible environment-lit and shadowed PBR rather than direct-lit glTF
  metallic-roughness rendering.

Keep GLB work narrow until StandardMaterial PBR is ready enough to map glTF
materials honestly. GLB container parsing and diagnostics are fine, but GLB
viewer/material mapping should not outrun the material and queue architecture.

## Ready Tasks By Category

### Proof Point Critical Path

### task-1366 — Plan next route or glTF fidelity slice after alpha-blend double-sided coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the latest alpha-blend route/glTF fidelity audits.

Acceptance criteria:

- Compare one route/prepared-resource candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1367 — Audit selected pipeline-layout-missing frame-resource plan

Status: completed 2026-05-18. See
`docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and recent
route/glTF diagnostic audits.

Acceptance criteria:

- Confirm the selected pipeline-layout-missing follow-up is concrete enough for
  one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1368 — Add pipeline-layout-missing frame-resource regression

Status: completed 2026-05-18. See
`test/webgpu/queued-material-frame-resource-set.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_GLTF_FIDELITY_AFTER_ALPHA_BLEND_DOUBLE_SIDED_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a generic frame-resource-set regression where `getPipelineView()` returns
  a valid pipeline resource whose `pipeline` lacks `getBindGroupLayout`.
- Assert the result is invalid, reports `webGpuApp.missingPipelineLayouts`,
  appends no frame resources, creates no mesh/material resource-key mappings,
  and exposes no raw GPU handles in JSON.
- Keep app-level non-built-in rendering, binary GLB loading, IBL, shadows, and
  GLB viewer behavior deferred.

### task-1369 — Audit selected route or glTF fidelity follow-up

Status: completed 2026-05-18. See
`docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1368`, the plan/audit from `task-1366` and
`task-1367`, `docs/ARCHITECTURE.md`, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1370 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_PIPELINE_LAYOUT_GUARD_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1368`/`task-1369` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest implemented slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1371 — Plan next route/prepared-resource slice after pipeline-layout guard

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/PIPELINE_LAYOUT_MISSING_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`,
and recent route/prepared-resource audits.

Acceptance criteria:

- Compare one generic route/prepared-resource candidate, one DebugNormalMaterial
  route-readiness candidate, and one StandardMaterial/glTF fidelity candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1372 — Audit invalid pipeline-view frame-resource plan

Status: completed 2026-05-18. See
`docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and recent
route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected invalid pipeline-view follow-up is concrete enough for
  one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1373 — Add invalid pipeline-view frame-resource regression

Status: completed 2026-05-18. See
`test/webgpu/queued-material-frame-resource-set.test.ts`.

Category: `webgpu-render`
Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`;
implementation files only if the regression exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_PIPELINE_LAYOUT_GUARD_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`test/webgpu/queued-material-frame-resource-set.test.ts`,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a generic frame-resource-set regression where `getPipelineView()` returns
  `valid: false` with a diagnostic.
- Assert the result is invalid, preserves the pipeline-view diagnostic, creates
  no pipeline plans, no frame resources, no mesh/material resource-key mappings,
  and exposes no raw GPU handles in JSON.
- Keep app-level non-built-in rendering, binary GLB loading, IBL, shadows, and
  GLB viewer behavior deferred.

### task-1374 — Audit selected route/prepared-resource follow-up

Status: completed 2026-05-18. See
`docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1373`, the plan/audit from `task-1371` and
`task-1372`, `docs/ARCHITECTURE.md`, and `docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1375 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_INVALID_PIPELINE_VIEW_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1373`/`task-1374` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest implemented slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1376 — Plan next route/prepared-resource slice after invalid pipeline-view coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `docs/research/INVALID_PIPELINE_VIEW_FRAME_RESOURCE_REGRESSION_AUDIT_2026_05_18.md`,
and recent route/prepared-resource audits.

Acceptance criteria:

- Compare one remaining generic route diagnostic candidate, one
  DebugNormalMaterial route-readiness candidate, and one StandardMaterial/glTF
  fidelity candidate.
- Select exactly one follow-up task with category, package/write-scope,
  reference anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1377 — Audit DebugNormalMaterial route-readiness plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_ROUTE_READINESS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and recent
route/prepared-resource audits.

Acceptance criteria:

- Confirm the selected DebugNormalMaterial readiness map is concrete enough for
  one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1378 — Add DebugNormalMaterial route-readiness map

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research`.
Reference anchor:
`docs/research/NEXT_ROUTE_PREPARED_AFTER_INVALID_PIPELINE_VIEW_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`packages/render/src/materials/debug-normal-preparation.ts`,
`packages/webgpu/src/webgpu/debug-normal-pipeline-descriptor.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`,
`test/webgpu/built-in-material-queue-family.test.ts`, and
`test/webgpu/built-in-material-queue-adapter.test.ts`.

Acceptance criteria:

- Document which DebugNormalMaterial pieces are already present: source asset
  type/factory, preparation plan, shader metadata, and pipeline descriptor plan.
- Document why it is not active in app-level built-in routing yet.
- Define the smallest safe activation sequence and tests needed before browser
  rendering can be enabled.
- Keep app-level DebugNormalMaterial rendering, binary GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

### task-1379 — Audit DebugNormalMaterial route-readiness map

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_ROUTE_READINESS_MAP_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`, the
plan/audit from `task-1376` and `task-1377`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1380 — Audit tracker/backlog alignment after selected follow-up

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_READINESS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1378`/`task-1379` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest implemented slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1381 — Add debug-normal material buffer resource helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`, and
`test/webgpu/debug-normal-material-buffer.test.ts`.

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, `test/webgpu`, and exports
only if needed.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/unlit-material-buffer.ts`,
`packages/webgpu/src/webgpu/unlit-material-buffer-resource.ts`,
`packages/webgpu/src/webgpu/matcap-material-buffer.ts`,
`packages/webgpu/src/webgpu/standard-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`, and
`references/three.js/src/renderers/common/Bindings.js`.

Acceptance criteria:

- Add a renderer-owned debug-normal material uniform data/buffer resource helper
  for the current shader contract.
- Expose JSON-safe inspection or report helpers that omit raw GPU handles.
- Add targeted tests for buffer contents/descriptor shape and JSON safety.
- Do not add debug-normal app route activation, bind groups, frame resources,
  browser rendering, IBL, shadows, or GLB viewer behavior.

### task-1382 — Audit debug-normal material buffer resource helper

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_MATERIAL_BUFFER_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1381`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous material buffer helpers.

Acceptance criteria:

- Confirm the helper is renderer-owned and JSON-safe.
- Confirm it matches the debug-normal shader binding contract.
- Confirm app route activation remains deferred.

### task-1383 — Audit tracker/backlog alignment after debug-normal material buffer

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BUFFER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1381`/`task-1382` results.

Acceptance criteria:

- Confirm the public tracker reflects the debug-normal material buffer slice.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1384 — Plan next DebugNormalMaterial route activation slice

Status: completed 2026-05-18. See
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
the `task-1381`/`task-1382` results, `docs/ARCHITECTURE.md`, and analogous
built-in material bind group/frame-resource helpers.

Acceptance criteria:

- Compare debug-normal bind group resources, debug-normal frame resources, and
  route adapter activation candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep app-level rendering deferred unless the selected prerequisite is fully
  testable in one focused run.

### task-1385 — Audit DebugNormalMaterial bind group plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BIND_GROUP_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in material resource helpers.

Acceptance criteria:

- Confirm the selected bind group resource follow-up is concrete enough for one
  focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1386 — Add DebugNormalMaterial bind group resources

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`, and
`test/webgpu/debug-normal-bind-group.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`,
`test/webgpu/debug-normal-bind-group.test.ts`, and exports only if needed.
Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_PLAN_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`,
`packages/webgpu/src/webgpu/matcap-bind-group-layout.ts`,
`packages/webgpu/src/webgpu/matcap-bind-group.ts`, and analogous built-in
material resource helpers.

Acceptance criteria:

- Add DebugNormalMaterial group-2 bind group layout metadata/plan for binding 0
  material uniform buffer.
- Add descriptor/resource helpers that consume a material buffer resource key
  and renderer-owned buffer resource.
- Add JSON-safe inspection for successful bind group resources that omits raw
  bind group handles.
- Add targeted tests for descriptor planning, resource creation, JSON safety,
  and missing material/layout/device diagnostics.
- Do not activate app-level DebugNormalMaterial routing, frame resources,
  browser rendering, binary GLB loading, IBL, shadows, or GLB viewer behavior.

### task-1387 — Audit selected DebugNormalMaterial route activation prerequisite

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BIND_GROUP_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1386`, the plan/audit from `task-1384` and
`task-1385`, `docs/ARCHITECTURE.md`, and
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1388 — Audit tracker/backlog alignment after selected DebugNormal prerequisite

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BIND_GROUP_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1386`/`task-1387` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal prerequisite.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1389 — Plan next DebugNormalMaterial route activation slice

Status: completed 2026-05-18. See
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
the `task-1386`/`task-1387` results, `docs/ARCHITECTURE.md`, and analogous
built-in material resource helpers.

Acceptance criteria:

- Compare the next DebugNormalMaterial prerequisite candidates after the
  selected `task-1386` work lands.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep app-level rendering deferred unless the selected prerequisite is fully
  testable in one focused run.

### task-1390 — Audit next DebugNormalMaterial route activation plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1389`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in material resource helpers.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1391 — Add DebugNormalMaterial frame resources

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts` and
`test/webgpu/debug-normal-frame-resources.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`,
`test/webgpu/debug-normal-frame-resources.test.ts`, and exports only if needed.
Reference anchor:
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_BIND_GROUP_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/matcap-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-frame-resources.ts`,
`packages/webgpu/src/webgpu/debug-normal-bind-group.ts`,
`packages/webgpu/src/webgpu/debug-normal-material-buffer-resource.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a DebugNormalMaterial frame-resource assembly helper that can upload mesh,
  view uniforms, world transforms, material buffer, shared bind groups, and the
  debug-normal group-2 bind group.
- Support prepared mesh and prepared material resources as inputs so app/cache
  integration can reuse renderer-owned resources later.
- Return JSON-safe diagnostics and no resources when required inputs are
  missing.
- Add targeted tests for successful resource assembly and missing required
  input diagnostics.
- Do not activate app-level routing, browser rendering, binary GLB loading, IBL,
  shadows, or GLB viewer behavior.

### task-1392 — Audit selected DebugNormalMaterial frame-resource prerequisite

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1391`, the plan/audit from `task-1389` and
`task-1390`, `docs/ARCHITECTURE.md`, and analogous built-in material frame
resource helpers.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm it preserves ECS authority, render extraction boundaries, JSON-safe
  diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1393 — Audit tracker/backlog alignment after DebugNormal frame resources

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1391`/`task-1392` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal prerequisite.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1394 — Plan next DebugNormalMaterial route activation slice after frame resources

Status: completed 2026-05-18. See
`docs/research/NEXT_DEBUG_NORMAL_ROUTE_ACTIVATION_AFTER_FRAME_RESOURCES_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in app frame-resource helpers.

Acceptance criteria:

- Compare app frame-resource cache/reuse integration, direct app route
  activation, and route diagnostics coverage as next candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep browser rendering deferred unless the selected slice includes all needed
  app resources and diagnostics in one focused run.

### task-1395 — Audit next DebugNormalMaterial route activation plan after frame resources

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1394`,
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in app frame-resource helpers.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1396 — Add DebugNormalMaterial app frame-resource cache/reuse helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts` and
`test/webgpu/debug-normal-app-frame-resources.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
targeted tests, and exports only if needed.
Reference anchor:
`docs/research/DEBUG_NORMAL_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`,
`packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`, and
`references/engine/src/scene/frame-graph.js`.

Acceptance criteria:

- Add a DebugNormalMaterial app frame-resource helper that wraps
  `createDebugNormalFrameGpuResources()`.
- Cache/reuse mesh, material buffer, bind groups, and dynamic view/transform
  buffer writes using the established app helper pattern.
- Track reuse counters consistently with existing built-in material app
  frame-resource reports.
- Add targeted tests for first-frame creation and same-key dynamic-buffer reuse.
- Do not add active app routing or browser rendering.

### task-1397 — Audit selected DebugNormalMaterial app frame-resource helper

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1396`, the plan/audit from `task-1394` and
`task-1395`, `docs/ARCHITECTURE.md`, and analogous built-in app frame-resource
helpers.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm app cache/reuse does not make the renderer own ECS/game state.
- Confirm route activation remains deferred until diagnostics and app adapter
  wiring are explicitly selected.

### task-1398 — Audit tracker/backlog alignment after DebugNormal app frame resources

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1396`/`task-1397` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal app frame-resource
  prerequisite.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1399 — Plan active DebugNormalMaterial route integration after app frame resources

Status: completed 2026-05-18. See
`docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/research/DEBUG_NORMAL_MATERIAL_ROUTE_READINESS_2026_05_18.md`,
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
analogous Unlit/Matcap app route paths.

Acceptance criteria:

- Compare app route resource integration, route-summary diagnostics, and browser
  pixel coverage as next candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep browser rendering deferred unless the selected slice includes route
  wiring, summaries, and reliable targeted verification in one focused run.

### task-1400 — Audit active DebugNormalMaterial route integration plan

Status: completed 2026-05-18. See
`docs/research/ACTIVE_DEBUG_NORMAL_ROUTE_INTEGRATION_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1399`,
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and analogous built-in app route resource paths.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1401 — Add DebugNormalMaterial app route resource integration

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/app.ts` and
`docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
targeted tests, and exports only if needed.
Reference anchor:
`docs/research/DEBUG_NORMAL_APP_FRAME_RESOURCE_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`, and analogous app
route resource wiring.

Acceptance criteria:

- Wire DebugNormalMaterial into the app route resource path using the
  app-frame-resource helper and existing generic route summaries.
- Report JSON-safe routed resource summaries and diagnostics for debug-normal
  family routes.
- Add targeted tests for app resource creation and route-summary shape.
- Keep browser pixel coverage, binary GLB loading, IBL, shadows, and GLB viewer
  behavior deferred.

### task-1402 — Audit selected DebugNormalMaterial app route resource integration

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_APP_ROUTE_INTEGRATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1401`, the plan/audit from `task-1399` and
`task-1400`, `docs/ARCHITECTURE.md`, and analogous built-in app route resource
paths.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm route integration preserves ECS authority, render extraction
  boundaries, and JSON-safe diagnostics.
- Recommend the next tracker/backlog or browser verification follow-up.

### task-1403 — Audit tracker/backlog alignment after DebugNormal route integration

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_ROUTE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1401`/`task-1402` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal route integration.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1404 — Plan DebugNormalMaterial browser pixel coverage

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1401`/`task-1402` route integration results,
`docs/ARCHITECTURE.md`, and existing material browser fixtures.

Acceptance criteria:

- Compare browser pixel coverage, route diagnostics coverage, and prepared
  material cache coverage as next candidates.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected browser slice narrow enough for one focused Playwright run
  if browser coverage is selected.

### task-1405 — Audit DebugNormalMaterial browser pixel coverage plan

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1404`, the `task-1401`/`task-1402` route integration
results, `docs/ARCHITECTURE.md`, and existing material browser fixtures.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1406 — Add DebugNormalMaterial browser pixel coverage

Status: completed 2026-05-18. See `examples/debug-normal-app.js` and
`test/e2e/debug-normal-app.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/debug-normal-app.html`, `examples/debug-normal-app.js`,
`test/e2e/debug-normal-app.spec.ts`, and tracker updates if the rendered browser
slice lands.
Reference anchor:
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_2026_05_18.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`packages/webgpu/src/webgpu/debug-normal-shader.ts`, and the active
DebugNormal route integration from `task-1401`.

Acceptance criteria:

- A browser example creates a `createWebGpuApp` scene with one camera, one mesh,
  and one `DebugNormalMaterial` authored through ECS components and typed
  assets.
- The example publishes JSON-safe status with `debug-normal` material queue and
  routed resource summaries, pipeline key, draw count, and no raw GPU handles.
- Playwright verifies the rendered pixel/readback sample is not clear and is
  consistent with the expected normal-encoded color for the sampled cube face.
- Keep prepared DebugNormal material cross-slot caching, GLB loading, IBL,
  shadows, and GLB viewer behavior deferred.

### task-1407 — Audit DebugNormalMaterial browser pixel coverage

Status: completed 2026-05-18. See
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1406`,
`docs/research/DEBUG_NORMAL_BROWSER_PIXEL_COVERAGE_PLAN_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and existing browser material fixtures.

Acceptance criteria:

- Confirm the browser example and Playwright regression satisfy the selected
  acceptance criteria.
- Confirm the browser slice preserves ECS authority, render extraction
  boundaries, JSON-safe diagnostics, and WebGPU-only backend ownership.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1408 — Audit tracker/backlog alignment after DebugNormal browser coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_DEBUG_NORMAL_BROWSER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html`.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1406`/`task-1407` results.

Acceptance criteria:

- Confirm the public tracker reflects the latest DebugNormal browser pixel
  coverage.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1409 — Plan next material route or DebugNormal follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1406`/`task-1408` results.

Acceptance criteria:

- Compare one material route architecture candidate, one DebugNormal cleanup or
  cache candidate, and one StandardMaterial/glTF fidelity candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1410 — Audit selected next material route or DebugNormal follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1409`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1411 — Implement prepared DebugNormal material cache parity

Status: completed 2026-05-18. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/prepared-debug-normal-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`,
`packages/webgpu/src/webgpu/prepared-app-material-resource.ts`,
`packages/webgpu/src/webgpu/debug-normal-app-frame-resources.ts`,
`packages/webgpu/src/webgpu/app.ts`, targeted tests, and exports if needed.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_2026_05_18.md`,
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`,
`packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`, and
`packages/webgpu/src/webgpu/debug-normal-frame-resources.ts`.

Acceptance criteria:

- Add a renderer-owned prepared DebugNormal material cache keyed by source
  material handle/version and pipeline key where applicable.
- Integrate the cache into DebugNormal app frame resources so material buffer
  and material bind group resources can be reused across frame-resource cache
  misses.
- Extend prepared app material cache summaries to report `debug-normal`
  entries.
- Add targeted tests covering first creation, reuse after mesh-only frame
  resource misses, JSON-safe summaries, and no raw GPU handles.
- Keep non-built-in custom material rendering, GLB loading, IBL, shadows, and
  broader route renames deferred.

### task-1412 — Audit prepared DebugNormal material cache parity

Status: completed 2026-05-18. See
`docs/research/PREPARED_DEBUG_NORMAL_MATERIAL_CACHE_PARITY_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1411`,
`docs/research/NEXT_MATERIAL_ROUTE_OR_DEBUG_NORMAL_AFTER_BROWSER_PLAN_AUDIT_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and relevant prepared material cache references.

Acceptance criteria:

- Confirm the implementation satisfies the selected acceptance criteria.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1413 — Audit tracker/backlog alignment after prepared DebugNormal cache parity

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_PREPARED_DEBUG_NORMAL_CACHE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if the selected follow-up changes
public status.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1411`/`task-1412` results.

Acceptance criteria:

- Confirm public tracker pages reflect the selected follow-up when status
  changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1414 — Plan next material route or StandardMaterial follow-up

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1411`/`task-1413` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1415 — Audit selected next material route or StandardMaterial follow-up plan

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1414`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.

### task-1416 — Add generic built-in app resource adapter registry smoke coverage

Status: completed 2026-05-18. See `agent/COMPLETED.md`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/app.ts`, targeted tests, and docs/research only if
the audit finds a boundary concern.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_DEBUG_NORMAL_CACHE_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`, and
`docs/ARCHITECTURE.md`.

Acceptance criteria:

- Add or expose a typed built-in app resource adapter registry shape that covers
  Unlit, Matcap, Standard, and DebugNormal without adding new material family
  behavior.
- Add tests proving all active built-in families are present, uniquely keyed,
  and route through the shared registry metadata.
- Preserve existing app resource creation behavior and JSON-safe route reports.
- Keep non-built-in custom material rendering, route renames, GLB loading, IBL,
  shadows, and batching deferred.

### task-1417 — Audit generic built-in app resource adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/GENERIC_BUILT_IN_APP_RESOURCE_ADAPTER_REGISTRY_SMOKE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1416`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant route adapter files.

Acceptance criteria:

- Confirm the adapter registry coverage did not broaden into a route rewrite.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1418 — Audit tracker/backlog alignment after adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_REGISTRY_SMOKE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1416`/`task-1417` results.

Acceptance criteria:

- Confirm public tracker pages reflect adapter registry smoke coverage if
  status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1419 — Plan next material route or StandardMaterial follow-up after adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1416`/`task-1418` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1420 — Audit selected follow-up plan after adapter registry smoke coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1419`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1421 — Add GLB metallic-roughness UV1 transform browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples`, `test/e2e`, targeted StandardMaterial/glTF mapping code only if the
fixture reveals a bug.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_REGISTRY_PLAN_2026_05_18.md`,
existing StandardMaterial GLB texture-transform browser fixtures,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, and
`docs/DECISIONS.md`.

Acceptance criteria:

- Add a GLB-derived StandardMaterial browser fixture that samples a
  metallic-roughness texture through `TEXCOORD_1` with a transform.
- Verify JSON-safe status includes the expected texture-info/transform/UV set
  mapping.
- Verify a readback or screenshot pixel proves the transformed `TEXCOORD_1`
  sample affects rendered output.
- Keep GLB viewer work, IBL, shadows, broad PBR completeness, route renames,
  and non-built-in material rendering deferred.

### task-1422 — Audit GLB metallic-roughness UV1 transform browser coverage

Status: completed 2026-05-18. See
`docs/research/GLB_METALLIC_ROUGHNESS_UV1_TRANSFORM_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1421`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant StandardMaterial GLB texture-transform
fixtures.

Acceptance criteria:

- Confirm the fixture proves the intended `TEXCOORD_1` metallic-roughness
  transform behavior.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1423 — Audit tracker/backlog alignment after GLB metallic-roughness UV1 transform coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GLB_METALLIC_ROUGHNESS_UV1_TRANSFORM_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1421`/`task-1422` results.

Acceptance criteria:

- Confirm public tracker pages reflect the coverage if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1424 — Plan next material route or StandardMaterial follow-up after GLB metallic-roughness UV1 transform coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1421`/`task-1423` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1425 — Audit selected follow-up plan after GLB metallic-roughness UV1 transform coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1424`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1426 — Add GLB combined base-color metallic-roughness browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`;
targeted StandardMaterial/glTF mapping code only if the fixture exposes a bug.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_MR_UV1_PLAN_2026_05_18.md`,
existing StandardMaterial GLB texture fixtures,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, `references/bevy/crates/bevy_pbr/src/gltf.rs`,
`references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-derived StandardMaterial browser fixture with both
  `baseColorTexture` and `metallicRoughnessTexture` resolved.
- Verify JSON-safe status includes both texture/sampler mappings, material
  readiness for both slots, expected resource counts, and the combined
  `standard|baseColorTexture|metallicRoughnessTexture|...` pipeline key.
- Verify a screenshot or readback pixel proves the combined textured material
  affects rendered output.
- Keep binary GLB loading, GLB viewer work, IBL, shadows, route renames, broad
  PBR completeness, and non-built-in material rendering deferred.

### task-1427 — Audit GLB combined base-color metallic-roughness browser coverage

Status: completed 2026-05-18. See
`docs/research/GLB_COMBINED_BASE_COLOR_METALLIC_ROUGHNESS_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1426`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant StandardMaterial GLB combined-texture
fixtures.

Acceptance criteria:

- Confirm the fixture proves the intended combined base-color plus
  metallic-roughness StandardMaterial browser behavior.
- Confirm ECS authority, render extraction boundaries, JSON-safe diagnostics,
  and WebGPU-only ownership remain intact.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1428 — Audit tracker/backlog alignment after GLB combined texture coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GLB_COMBINED_TEXTURE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1426`/`task-1427` results.

Acceptance criteria:

- Confirm public tracker pages reflect the coverage if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1429 — Plan next material route or StandardMaterial follow-up after GLB combined texture coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1426`/`task-1428` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1430 — Audit selected follow-up plan after GLB combined texture coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1429`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1431 — Add built-in app adapter registration diagnostics

Status: completed 2026-05-18. See
`test/webgpu/built-in-material-app-resource-adapter.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts` and
`test/webgpu/built-in-material-app-resource-adapter.test.ts`.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_TEXTURE_PLAN_2026_05_18.md`,
`docs/DECISIONS.md` decision 0010, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, existing built-in app adapter registry tests,
`references/three.js/src/renderers/common/Pipeline.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Duplicate built-in app adapter family registrations produce deterministic
  diagnostics without changing the active default registry behavior.
- Missing built-in family registrations produce deterministic diagnostics or a
  validation report suitable for JSON-safe app diagnostics.
- Existing default built-in adapter registration remains valid for Unlit,
  Matcap, Standard, and DebugNormal.
- Keep app-level non-built-in material rendering, route renames, GLB viewer
  work, IBL, shadows, and broad PBR work deferred.

### task-1432 — Audit built-in app adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/BUILT_IN_APP_ADAPTER_REGISTRATION_DIAGNOSTICS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1431`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant material-route adapter tests.

Acceptance criteria:

- Confirm duplicate and missing registration diagnostics are deterministic and
  JSON-safe.
- Confirm default built-in app adapter registration remains valid for active
  built-in families.
- Confirm ECS authority, render extraction boundaries, and WebGPU-only resource
  ownership remain intact.

### task-1433 — Audit tracker/backlog alignment after adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_APP_ADAPTER_REGISTRATION_DIAGNOSTICS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1431`/`task-1432` results.

Acceptance criteria:

- Confirm public tracker pages reflect the diagnostics if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1434 — Plan next material route or StandardMaterial follow-up after adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1431`/`task-1433` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1435 — Audit selected follow-up plan after adapter registration diagnostics

Status: completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1434`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1436 — Surface built-in app adapter validation in app diagnostics

Status: Completed 2026-05-18.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`, and
targeted WebGPU app/adapter tests.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_DIAGNOSTICS_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`packages/webgpu/src/webgpu/app.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- The default WebGPU app route/resource adapter registry reports valid
  built-in family registration without adding noisy diagnostics.
- A test-only invalid built-in app adapter registry can surface duplicate and
  missing-family diagnostics in JSON-safe app diagnostics or an app report.
- The report omits adapter callbacks, app objects, source asset payloads, and raw
  GPU handles.
- Keep app-level non-built-in material rendering, route renames, GLB viewer
  work, IBL, shadows, and broad PBR work deferred.

### task-1437 — Audit built-in app adapter validation app diagnostics

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1436`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant WebGPU app diagnostics tests.

Acceptance criteria:

- Confirm default app diagnostics stay quiet for valid built-in registration.
- Confirm test-only invalid registration surfaces duplicate/missing diagnostics
  through JSON-safe app diagnostics or reports.
- Confirm ECS authority, render extraction boundaries, and WebGPU-only resource
  ownership remain intact.

### task-1438 — Audit tracker/backlog alignment after app adapter validation diagnostics

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1436`/`task-1437` results.

Acceptance criteria:

- Confirm public tracker pages reflect the diagnostics if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1439 — Plan next material route or StandardMaterial follow-up after app adapter validation diagnostics

Status: Completed 2026-05-18.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1436`/`task-1438` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1440 — Audit selected follow-up plan after app adapter validation diagnostics

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1439`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1441 — Add combined base-color metallic-roughness normal GLB browser coverage

Status: Completed 2026-05-18.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if public status
changes.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_APP_ADAPTER_VALIDATION_DIAGNOSTICS_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser fixture material with base-color,
  metallic-roughness, and normal textures active together.
- Verify JSON-safe material status reports all three texture/sampler mappings
  and readiness slots without raw GPU handles or source asset payloads.
- Verify the WebGPU app report creates/reuses the expected texture/sampler and
  material resources while preserving the combined StandardMaterial pipeline key.
- Verify rendered/readback pixels are non-clear and materially different from a
  base-color-only or untextured control.
- Keep app-level non-built-in material rendering, IBL, shadows, binary GLB
  loading, and broad PBR expansion deferred.

### task-1444 — Add combined base-color occlusion emissive GLB browser coverage

Status: Completed 2026-05-18.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and targeted docs if public status
changes.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BMR_NORMAL_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` decision 0010,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped browser fixture material with base-color, occlusion, and
  emissive textures active together.
- Verify JSON-safe status reports all texture/sampler mappings and readiness
  slots without raw GPU handles or source asset payloads.
- Verify the WebGPU app report creates/reuses the expected texture/sampler and
  material resources while preserving the combined StandardMaterial pipeline key.
- Verify rendered/readback pixels are non-clear and reflect the combined
  StandardMaterial texture route.
- Keep app-level non-built-in material rendering, IBL, shadows, binary GLB
  loading, and broad PBR expansion deferred.

### task-1445 — Audit combined base-color occlusion emissive GLB browser coverage

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1444`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and relevant StandardMaterial browser tests.

Acceptance criteria:

- Confirm the fixture uses the existing ECS-authored app path and built-in
  StandardMaterial route.
- Confirm status/readback assertions remain JSON-safe and WebGPU-only.
- Confirm no broad PBR, IBL, GLB viewer, or app-level generic adapter work
  slipped into the slice.

### task-1446 — Audit tracker/backlog alignment after combined base-color occlusion emissive coverage

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1444`/`task-1445` results.

Acceptance criteria:

- Confirm public tracker pages reflect the browser coverage if status changed.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1447 — Plan next material route or StandardMaterial follow-up after combined base-color occlusion emissive coverage

Status: Completed 2026-05-18.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1444`/`task-1446` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1448 — Audit selected follow-up plan after combined base-color occlusion emissive coverage

Status: Completed 2026-05-18.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1447`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1449 — Extract multi-texture StandardMaterial browser assertion helper

Status: Completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `docs-tooling`
Package/write-scope: `test/e2e/standard-gltf-texture.spec.ts` only.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_GLB_COMBINED_BASE_COLOR_OCCLUSION_EMISSIVE_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and the existing combined StandardMaterial browser
tests.

Acceptance criteria:

- Extract a small helper for asserting multi-texture glTF asset mapping,
  readiness slots, resource counts, and pipeline keys.
- Refactor the combined base-color plus metallic-roughness, combined
  base-color/metallic-roughness/normal, and combined
  base-color/occlusion/emissive tests to use it.
- Keep screenshot/readback assertions scenario-specific.
- Run the full `standard-gltf-texture.spec.ts` Playwright file.

### task-1450 — Audit multi-texture StandardMaterial browser assertion helper

Status: Completed 2026-05-18. See
`docs/research/MULTI_TEXTURE_STANDARD_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1449`, `docs/ARCHITECTURE.md`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Confirm helper extraction does not weaken scenario-specific pixel/readback
  assertions.
- Confirm JSON-safe status coverage and pipeline/resource assertions remain
  intact.
- Confirm no runtime code was changed for a test-only cleanup.

### task-1451 — Audit tracker/backlog alignment after multi-texture assertion helper

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_MULTI_TEXTURE_STANDARD_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1449`/`task-1450` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for test-only cleanup.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1452 — Plan next material route or StandardMaterial follow-up after multi-texture assertion helper

Status: Completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1449`/`task-1451` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1453 — Audit selected follow-up plan after multi-texture assertion helper

Status: Completed 2026-05-18. See
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the plan from `task-1452`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and relevant material route or StandardMaterial
references.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only backend ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1454 — Route app diagnostics through generic material summary

Status: Completed 2026-05-18. See `packages/webgpu/src/webgpu/app.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`test/webgpu/webgpu-app.test.ts`, and targeted summary tests if needed.
Reference anchor:
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`,
`packages/webgpu/src/webgpu/app.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- `createQueuedBuiltInAppDiagnosticsSummary()` builds `routedResourceSet`
  through `createQueuedMaterialFrameResourceSetSummary()` or an equivalent
  generic material-family summary path.
- Existing public `routedResourceSet` JSON shape and built-in compatibility
  arrays remain unchanged.
- Built-in wrapper exports are either kept as explicit compatibility aliases or
  removed only if no public exports/tests/docs rely on them.
- Tests cover at least one app diagnostics summary route and any touched summary
  wrapper behavior.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.

### task-1455 — Audit generic material summary app diagnostics routing

Status: Completed 2026-05-18. See
`docs/research/GENERIC_MATERIAL_SUMMARY_APP_DIAGNOSTICS_ROUTING_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1454`,
`docs/research/NEXT_MATERIAL_ROUTE_OR_STANDARD_FOLLOW_UP_AFTER_MULTI_TEXTURE_HELPER_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and
`packages/webgpu/src/webgpu/app.ts`.

Acceptance criteria:

- Confirm the app diagnostics route uses the generic summary helper without
  changing the public `routedResourceSet` JSON shape.
- Confirm built-in compatibility exports remain stable.
- Confirm no app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes were introduced.

### task-1456 — Audit tracker/backlog alignment after generic summary routing

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_SUMMARY_ROUTING_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1454`/`task-1455` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the generic summary
  route cleanup.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1457 — Plan next route or StandardMaterial follow-up after generic summary routing

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1454`/`task-1456` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1458 — Add generic queued material app resource set contract

Status: Completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`test/webgpu/queued-material-app-resource-item.test.ts`, and targeted built-in
resource-set tests if needed.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`,
`docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic `QueuedMaterialAppResourceSet` type or interface that carries
  generic queued material app resource items.
- Make `QueuedBuiltInAppResourceSet` use or alias that generic set shape while
  preserving its built-in item type.
- Add or update tests proving a fake non-built-in item can be grouped in the
  generic set without adding family-specific diagnostics fields or built-in
  compatibility arrays.
- Existing built-in app resource set and WebGPU app diagnostics tests continue
  to pass.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.

### task-1459 — Audit generic queued material app resource set contract

Status: Completed 2026-05-18. See
`docs/research/GENERIC_QUEUED_MATERIAL_APP_RESOURCE_SET_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1458`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_SUMMARY_ROUTING_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`.

Acceptance criteria:

- Confirm the generic app resource set remains a typed derived render-route
  contract, not renderer-owned ECS/game state.
- Confirm built-in compatibility behavior and diagnostics fields remain stable.
- Recommend whether to continue route cleanup or return to StandardMaterial/glTF
  fidelity.

### task-1460 — Audit tracker/backlog alignment after generic app resource set contract

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_APP_RESOURCE_SET_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1458`/`task-1459` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the generic app resource
  set contract.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1461 — Plan next route or StandardMaterial follow-up after generic app resource set contract

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1458`/`task-1460` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1462 — Make built-in app resource item extend generic route item

Status: Completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`test/webgpu/queued-material-app-resource-item.test.ts`, and targeted built-in
resource-set tests if needed.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- `QueuedBuiltInAppResourceItem` extends or aliases
  `QueuedMaterialAppResourceItem<BuiltInMaterialAsset, QueuedBuiltInMaterialAdapter>`.
- Existing built-in resource set collection behavior and diagnostics JSON shape
  remain unchanged.
- Tests cover the generic item contract and the built-in collector path.
- Do not add app-level non-built-in material rendering, route renames, GLB
  loading, IBL, shadows, or shader changes.

### task-1463 — Audit built-in app resource item generic contract

Status: Completed 2026-05-18. See
`docs/research/BUILT_IN_APP_RESOURCE_ITEM_GENERIC_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1462`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_APP_RESOURCE_SET_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, and
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

Acceptance criteria:

- Confirm the built-in item type is a compatibility specialization of the
  generic app resource item contract.
- Confirm no public diagnostics shape or rendering behavior changed.
- Recommend whether to continue route cleanup or return to StandardMaterial/glTF
  fidelity.

### task-1464 — Audit tracker/backlog alignment after built-in item generic contract

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1462`/`task-1463` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the built-in item
  generic contract.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1465 — Plan next route or StandardMaterial follow-up after built-in item generic contract

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1462`/`task-1464` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1466 — Add combined alpha-mask emissive StandardMaterial browser coverage

Status: Completed 2026-05-18. See
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and targeted docs only if the fixture changes public status.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`,
`examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a GLB-shaped StandardMaterial browser scenario with base-color,
  alpha-mask, and emissive textures.
- Assert glTF texture/sampler mappings, readiness slots, resource counts,
  alpha-mask render-state status, and the combined pipeline key.
- Keep screenshot/readback assertions scenario-specific and verify masked versus
  visible pixels where practical.
- Keep app-level non-built-in material rendering, binary GLB loading, IBL,
  shadows, route renames, and broad PBR work deferred.
- Run targeted Playwright coverage for the new scenario and the full
  `standard-gltf-texture.spec.ts` file.

### task-1467 — Audit combined alpha-mask emissive StandardMaterial browser coverage

Status: Completed 2026-05-18. See
`docs/research/GLB_COMBINED_BASE_COLOR_ALPHA_MASK_EMISSIVE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1466`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_BUILT_IN_ITEM_GENERIC_CONTRACT_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Confirm combined texture assertions and scenario-specific pixel/readback
  checks cover the new fixture.
- Confirm alpha-mask render-state expectations remain honest and JSON-safe.
- Confirm no app-level non-built-in rendering, binary GLB loading, IBL, shadows,
  route renames, or broad PBR work was added.

### task-1468 — Audit tracker/backlog alignment after alpha-mask emissive coverage

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_MASK_EMISSIVE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1466`/`task-1467` results.

Acceptance criteria:

- Confirm public tracker pages reflect the new combined alpha-mask emissive
  browser coverage if it lands.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1469 — Plan next route or StandardMaterial follow-up after alpha-mask emissive coverage

Status: Completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1466`/`task-1468` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1470 — Extract alpha texture browser pixel assertion helper

Status: Completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `docs-tooling`
Package/write-scope: `test/e2e/standard-gltf-texture.spec.ts` only.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`,
`test/e2e/standard-gltf-texture.spec.ts`, and existing alpha-mask/alpha-blend
browser tests.

Acceptance criteria:

- Extract a helper for screenshot/readback comparisons shared by alpha-mask
  texture and combined alpha-mask emissive tests.
- Keep alpha-blend translucent comparisons scenario-specific unless the helper
  can support them without weakening assertions.
- Preserve render-state, mapping, readiness, resource, and pipeline assertions.
- Run the full `standard-gltf-texture.spec.ts` Playwright file.

### task-1471 — Audit alpha texture browser pixel assertion helper

Status: Completed 2026-05-18. See
`docs/research/ALPHA_TEXTURE_BROWSER_PIXEL_ASSERTION_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the implementation from `task-1470`,
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_MASK_EMISSIVE_PLAN_2026_05_18.md`,
and `test/e2e/standard-gltf-texture.spec.ts`.

Acceptance criteria:

- Confirm the helper does not weaken alpha-mask or combined alpha-mask emissive
  pixel/readback assertions.
- Confirm render-state, pipeline, resource, and JSON-safe status assertions
  remain scenario-specific.
- Confirm no runtime files changed for the test-only helper.

### task-1472 — Audit tracker/backlog alignment after alpha texture helper

Status: Completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_ALPHA_TEXTURE_HELPER_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, `docs/index.html`,
and `docs/render-pipeline-comparison.html` only if public status changed.
Reference anchor:
`docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`docs/ARCHITECTURE.md`, and the `task-1470`/`task-1471` results.

Acceptance criteria:

- Confirm whether public tracker pages need changes for the test-only helper.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1473 — Plan next route or StandardMaterial follow-up after alpha texture helper

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_TEXTURE_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1470`/`task-1472` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1474 — Generalize app route report routed-item serialization

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a family-agnostic helper that serializes a `QueuedMaterialAppResourceItem`
  into the JSON-safe routed-item shape used by app material queue route reports.
- Use the helper from the built-in app resource set route failure diagnostic.
- Add or update tests with a test-only non-built-in item to prove the helper
  does not require built-in material fields or GPU handles.
- Preserve existing built-in route diagnostic JSON shape and app behavior.

### task-1475 — Audit generic app route report routed-item serialization

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ROUTE_REPORT_ROUTED_ITEM_SERIALIZATION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_ALPHA_TEXTURE_HELPER_PLAN_2026_05_18.md`,
the implementation from `task-1474`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Confirm the helper is family-agnostic and JSON-safe.
- Confirm built-in app route failure diagnostics preserve their public JSON
  shape.
- Confirm the change does not add custom material rendering, WebGL fallback, or
  renderer-owned ECS state.

### task-1476 — Audit tracker/backlog alignment after generic routed-item report helper

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`, and the
`task-1474`/`task-1475` results.

Acceptance criteria:

- Update public tracker pages if the helper materially changes route-contract
  status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1477 — Plan next route or StandardMaterial follow-up after generic routed-item report helper

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, and the `task-1474`/`task-1476` results.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1478 — Audit selected follow-up plan after generic routed-item report helper

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTED_ITEM_REPORT_HELPER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1477`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1479 — Audit remaining built-in-specific app route collector diagnostics surfaces

Status: completed 2026-05-18. See
`docs/research/BUILT_IN_APP_ROUTE_COLLECTOR_DIAGNOSTICS_SURFACE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/ARCHITECTURE.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and recent
generic route-contract audits.

Acceptance criteria:

- Identify remaining built-in-specific app route collector diagnostics or
  serialization helpers.
- Separate acceptable built-in compatibility wrappers from surfaces that block
  future non-built-in material-family routing.
- Recommend one small follow-up, or state that no immediate cleanup is needed.

### task-1480 — Plan next collector genericization slice after route surface audit

Status: completed 2026-05-18. See
`docs/research/NEXT_COLLECTOR_GENERICIZATION_AFTER_ROUTE_SURFACE_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1479` audit, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract implementation
tasks.

Acceptance criteria:

- Compare one collector genericization candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1481 — Audit selected collector genericization plan

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1480`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1482 — Audit tracker/backlog alignment after collector genericization plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1480`/`task-1481` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected collector genericization plan
  materially changes the recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1483 — Plan next route or StandardMaterial follow-up after collector genericization plan audit

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1480`/`task-1482` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1484 — Audit selected follow-up plan after collector-genericization follow-up planning

Status: completed 2026-05-18. See
`docs/research/GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_FOLLOW_UP_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1483`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1485 — Extract generic app route report diagnostic builder

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts` and
`test/webgpu/queued-material-app-resource-item.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_2026_05_18.md`,
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_PLAN_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic helper that builds the
  `webGpuApp.materialQueueRouteReport` diagnostic from `MaterialQueueItem[]`,
  `QueuedMaterialAppResourceItem[]`, normalized route diagnostics, and a reusable
  route report shell.
- Route `collectQueuedBuiltInAppResourceSet()` through the helper without
  changing its public diagnostic JSON shape.
- Add a test-only non-built-in material family fixture proving queue-item and
  routed-item serialization stays JSON-safe and excludes source assets,
  adapters, app objects, and raw GPU handles.
- Keep built-in missing-family diagnostic translation in the built-in collector
  and do not add app-level non-built-in rendering.

### task-1486 — Audit generic app route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1485` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the extraction preserves the built-in route failure diagnostic JSON
  shape.
- Confirm the generic helper does not expose source assets, adapters, app
  objects, or raw GPU handles.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1487 — Audit tracker/backlog alignment after generic route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1485`/`task-1486` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for the generic route-report diagnostic builder
  extraction.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1488 — Plan next route or StandardMaterial follow-up after generic route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1485`/`task-1487` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1489 — Audit selected follow-up plan after generic route report diagnostic builder extraction

Status: completed 2026-05-18. See
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1488`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1490 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: superseded 2026-05-18 by `task-1495`, which aligned tracker/backlog
after the selected normalizer follow-up was implemented and audited.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1488`/`task-1489` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1491 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1496`, the refreshed planning task after
the implemented normalizer extraction.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1488`/`task-1490` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1492 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1497`, the refreshed audit task after
the implemented normalizer extraction.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1491`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1493 — Extract generic route diagnostic normalizer

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/material-queue-route-report.ts` and
`test/webgpu/material-queue-route-report-diagnostics.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_PLAN_2026_05_18.md`,
`docs/research/GENERIC_APP_ROUTE_REPORT_DIAGNOSTIC_BUILDER_EXTRACTION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a generic exported helper that converts unknown diagnostics into zero or
  one `WebGpuAppMaterialQueueRouteDiagnostic` values using the current JSON-safe
  field allowlist.
- Route `collectQueuedBuiltInAppResourceSet()` through the generic normalizer
  after its built-in compatibility diagnostic translation.
- Add targeted coverage proving non-object diagnostics are skipped, JSON-safe
  fields are preserved, invalid entity fields are omitted, and raw GPU/source
  fields do not leak.
- Keep built-in missing-family and material-mismatch diagnostic translation in
  the built-in collector, and do not add app-level non-built-in rendering.

### task-1494 — Audit generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1493` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the normalizer preserves current JSON-safe route diagnostic fields.
- Confirm built-in compatibility policy remains in the built-in collector.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1495 — Audit tracker/backlog alignment after generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1493`/`task-1494` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for the generic route diagnostic normalizer
  extraction.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1496 — Plan next route or StandardMaterial follow-up after generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1493`/`task-1495` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1497 — Audit selected follow-up plan after generic route diagnostic normalizer extraction

Status: completed 2026-05-18. See
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1496`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1498 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_REMAINING_COLLECTOR_RESPONSIBILITIES_PLAN_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1496`/`task-1497` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1499 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1503`, the refreshed planning task after
the remaining collector responsibilities audit.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1496`/`task-1498` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1500 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1504`, the refreshed audit task after
the remaining collector responsibilities audit.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1499`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1501 — Audit remaining built-in collector responsibilities after route diagnostic helper extraction

Status: completed 2026-05-18. See
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_PLAN_2026_05_18.md`,
`docs/research/GENERIC_ROUTE_DIAGNOSTIC_NORMALIZER_EXTRACTION_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`,
`packages/webgpu/src/webgpu/material-queue-route-report.ts`, and recent
route-contract audits.

Acceptance criteria:

- Identify remaining built-in collector responsibilities and classify each as
  built-in compatibility, generic extraction candidate, or deferred until
  non-built-in app rendering exists.
- Recommend exactly one next implementation or documentation follow-up, or state
  that StandardMaterial/glTF fidelity should resume.
- Confirm no proposed follow-up introduces app-level non-built-in rendering,
  renderer-owned ECS state, WebGL fallback, or a broad collector rewrite.

### task-1502 — Audit tracker/backlog alignment after remaining collector responsibilities audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_REMAINING_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1501` result, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the audit materially changes the recommended
  next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1503 — Plan next route or StandardMaterial follow-up after collector responsibilities audit

Status: superseded 2026-05-18 by `task-1509`, the refreshed planning task after
the selected source asset index helper extraction.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1501`/`task-1502` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1504 — Audit selected follow-up plan after collector responsibilities follow-up planning

Status: superseded 2026-05-18 by `task-1510`, the refreshed audit task after
the selected source asset index helper extraction.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1503`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1505 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: superseded 2026-05-18 by `task-1508`, the tracker/backlog alignment
task for the selected source asset index helper extraction.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1503`/`task-1504` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1506 — Extract generic queued source asset index helper

Status: completed 2026-05-18. See
`packages/webgpu/src/webgpu/queued-source-assets.ts` and
`test/webgpu/queued-source-assets.test.ts`.

Category: `webgpu-render`
Package/write-scope:
`packages/webgpu/src/webgpu/queued-source-assets.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
`test/webgpu` coverage.
Reference anchor:
`docs/research/REMAINING_BUILT_IN_COLLECTOR_RESPONSIBILITIES_AUDIT_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Move generic queued source mesh/material asset interfaces and source asset
  indexing into a reusable WebGPU app route helper.
- Route the built-in collector through the helper without changing collector
  result shape or diagnostics.
- Add focused tests for ready, missing/loading, duplicate, and versioned mesh
  and material source asset indexing.
- Do not move built-in adapter policy, route traversal, compatibility
  diagnostics, or app-level non-built-in rendering.

### task-1507 — Audit queued source asset index helper extraction

Status: completed 2026-05-18. See
`docs/research/QUEUED_SOURCE_ASSET_INDEX_HELPER_EXTRACTION_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1506` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the helper is generic source asset lookup, not built-in adapter policy.
- Confirm built-in collector result shape and diagnostics remain stable.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1508 — Audit tracker/backlog alignment after source asset index helper extraction

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_QUEUED_SOURCE_ASSET_INDEX_HELPER_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1506`/`task-1507` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the helper extraction materially changes route
  contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1509 — Plan next route or StandardMaterial follow-up after source asset index helper extraction

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1506`/`task-1508` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1510 — Audit selected follow-up plan after source asset index helper follow-up planning

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1509`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1511 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_FIDELITY_AUDIT_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1509`/`task-1510` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route-contract status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1512 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1516`, the refreshed planning task after
the selected fidelity gap audit.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1509`/`task-1511` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1513 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1517`, the refreshed audit task after
the selected fidelity gap audit.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1512`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route-contract audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1514 — Audit remaining StandardMaterial glTF fidelity gaps after route helper cleanup

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_SOURCE_ASSET_INDEX_HELPER_PLAN_2026_05_18.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, `docs/ARCHITECTURE.md`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and recent StandardMaterial/glTF browser coverage audits.

Acceptance criteria:

- Inventory the remaining near-term StandardMaterial/glTF fidelity gaps visible
  from current examples/tests and medium-term goals.
- Compare at least three candidate browser-verifiable slices.
- Recommend exactly one next implementation task with category,
  package/write-scope, reference anchor, and acceptance criteria.
- Keep IBL, shadows, binary GLB loading, and app-level non-built-in rendering
  deferred unless the audit finds a direct blocker.

### task-1515 — Audit tracker/backlog alignment after StandardMaterial glTF fidelity gap audit

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1514` result, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the audit materially changes the recommended
  next task or StandardMaterial/glTF status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1516 — Plan next route or StandardMaterial follow-up after fidelity gap audit

Status: superseded 2026-05-18 by `task-1522`, the refreshed planning task after
the selected occlusion strength coverage.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1514`/`task-1515` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1517 — Audit selected follow-up plan after fidelity follow-up planning

Status: superseded 2026-05-18 by `task-1523`, the refreshed audit task after
the selected occlusion strength coverage.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1516`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1518 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: superseded 2026-05-18 by `task-1521`, the tracker/backlog alignment
task for the selected occlusion strength coverage.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1516`/`task-1517` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route/glTF status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1519 — Add StandardMaterial glTF occlusion strength browser coverage

Status: completed 2026-05-18. See
`examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/STANDARD_GLTF_FIDELITY_GAP_AUDIT_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with `occlusionTexture.strength` set to a
  finite non-default value such as `0.25`.
- Assert status JSON reports the mapped occlusion texture, strength value,
  resource counts, pipeline key, and JSON-safe diagnostics.
- Compare screenshot/readback output against the existing full-strength
  occlusion path or another deterministic control so the test proves the
  strength changes rendered output.
- Keep IBL, shadows, binary GLB loading, larger combined PBR fixtures, and
  app-level non-built-in rendering deferred.

### task-1520 — Audit StandardMaterial glTF occlusion strength browser coverage

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_OCCLUSION_STRENGTH_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, targeted tests only if a tiny corrective
fix is required.
Reference anchor:
the `task-1519` implementation, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent StandardMaterial/glTF audits.

Acceptance criteria:

- Confirm the fixture proves non-default occlusion strength affects browser
  output.
- Confirm the status JSON remains stable and JSON-safe.
- Recommend the next tracker/backlog or implementation follow-up.

### task-1521 — Audit tracker/backlog alignment after occlusion strength coverage

Status: completed 2026-05-18. See
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_OCCLUSION_STRENGTH_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1519`/`task-1520` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages for occlusion strength browser coverage.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` after tracker edits.

### task-1522 — Plan next route or StandardMaterial follow-up after occlusion strength coverage

Status: completed 2026-05-18. See
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1519`/`task-1521` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1523 — Audit selected follow-up plan after occlusion strength follow-up planning

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_PLAN_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1522`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1524 — Audit tracker/backlog alignment after selected follow-up plan audit

Status: completed 2026-05-18. Covered by
`docs/research/TRACKER_BACKLOG_ALIGNMENT_AFTER_STANDARD_GLTF_NORMAL_SCALE_AUDIT_2026_05_18.md`.

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1522`/`task-1523` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up materially changes the
  recommended next task or route/glTF status.
- Confirm the ready backlog has at least five categorized, scoped tasks.
- Run `pnpm run check:progress` if tracker pages change.

### task-1525 — Plan next route or StandardMaterial follow-up after tracker alignment

Status: superseded 2026-05-18 by `task-1528`, the focused visual
normal-scale proof audit after browser mapping coverage exposed a fixture
readback gap.

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1522`/`task-1524` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1526 — Audit selected follow-up plan after tracker-aligned planning

Status: superseded 2026-05-18 by `task-1528`, the focused visual
normal-scale proof audit.

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1525`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1527 — Add StandardMaterial glTF normal scale browser coverage

Status: completed 2026-05-18. See
`test/e2e/standard-gltf-texture.spec.ts` and
`docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`.

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the fixture exposes a focused defect.
Reference anchor:
`docs/research/NEXT_ROUTE_OR_STANDARD_AFTER_OCCLUSION_STRENGTH_PLAN_2026_05_18.md`,
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
`references/three.js/src/renderers/common/Bindings.js`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add a glTF-shaped browser scenario with `normalTexture.scale` set to a finite
  non-default value such as `0.25`.
- Assert status JSON reports the mapped normal texture, scale value, tangent
  mesh layout, resource counts, pipeline key, and JSON-safe diagnostics.
- Compare screenshot/readback output against the existing full-scale normal-map
  path or another deterministic control so the test proves the scale changes
  rendered output.
- Keep IBL, shadows, binary GLB loading, larger combined PBR fixtures, and
  app-level non-built-in rendering deferred.

### task-1528 — Audit visual normal-scale proof options after browser mapping coverage

Status: completed 2026-05-18. See
`docs/research/STANDARD_GLTF_NORMAL_SCALE_VISUAL_PROOF_OPTIONS_AUDIT_2026_05_18.md`.

Category: `audit-refactor`
Package/write-scope: `docs/research`, `examples/standard-gltf-texture.js`,
and `test/e2e/standard-gltf-texture.spec.ts` only if a tiny corrective fixture
change is required.
Reference anchor:
`docs/research/STANDARD_GLTF_NORMAL_SCALE_BROWSER_COVERAGE_AUDIT_2026_05_18.md`,
`examples/standard-texture-control.js`,
`test/e2e/standard-texture-control.spec.ts`, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Compare at least two narrow options for proving normal-scale visual output in
  browser without broad lighting or shader refactors.
- Recommend one deterministic fixture shape, such as a scalar-vs-normal control
  inside the glTF example or a reused Standard texture control pattern.
- Preserve JSON-safe diagnostics, ECS authority, and WebGPU-only ownership.

### task-1529 — Implement deterministic visual normal-scale browser proof

Category: `webgpu-render`
Package/write-scope:
`examples/standard-gltf-texture.js`, `test/e2e/standard-gltf-texture.spec.ts`,
and implementation files only if the audit exposes a focused defect.
Reference anchor:
the `task-1528` audit, `examples/standard-texture-control.js`,
`test/e2e/standard-texture-control.spec.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`, and
`references/engine/src/scene/materials/standard-material.js`.

Acceptance criteria:

- Add or adjust one deterministic browser fixture so normal texture scale
  produces a readback or screenshot delta against a stable control.
- Keep the existing mapped-scale status assertions.
- Run targeted Playwright coverage for the normal-scale proof.

### task-1530 — Audit tracker/backlog alignment after visual normal-scale proof

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1528`/`task-1529` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the visual proof materially changes render
  pipeline status.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

### task-1531 — Plan next route or StandardMaterial follow-up after normal-scale visual proof

Category: `docs-tooling`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the `task-1528`/`task-1530` results, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and `docs/DECISIONS.md`.

Acceptance criteria:

- Compare one material route architecture candidate, one StandardMaterial/glTF
  fidelity candidate, and one diagnostics/tooling candidate.
- Select exactly one follow-up with category, package/write-scope, reference
  anchor, and acceptance criteria.
- Keep the selected task to one focused run.

### task-1532 — Audit selected follow-up plan after normal-scale planning

Category: `audit-refactor`
Package/write-scope: `docs/research` and backlog only.
Reference anchor:
the plan from `task-1531`, `docs/ARCHITECTURE.md`,
`docs/MEDIUM_LONG_TERM_GOALS.md`, and recent route/glTF audits.

Acceptance criteria:

- Confirm the selected follow-up is concrete enough for one focused run.
- Confirm it preserves ECS authority, render extraction, JSON-safe diagnostics,
  and WebGPU-only ownership.
- Recommend whether to implement the selected follow-up or adjust the backlog.

### task-1533 — Audit tracker/backlog alignment after normal-scale follow-up plan audit

Category: `docs-tooling`
Package/write-scope: `docs/index.html`, `docs/render-pipeline-comparison.html`,
`agent/BACKLOG.md`, and `docs/research`.
Reference anchor:
the `task-1531`/`task-1532` results, `docs/ARCHITECTURE.md`, and
`docs/MEDIUM_LONG_TERM_GOALS.md`.

Acceptance criteria:

- Update public tracker pages if the selected follow-up changes project status
  or recommended next task.
- Confirm at least five categorized, scoped ready tasks remain.
- Run `pnpm run check:progress` after tracker edits.

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
