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

Start with `task-0602`. The multi-resource app rendering boundary has been
audited after mixed unlit/Matcap support, and StandardMaterial is the next
blocker before the material showcase can move onto built-in material paths.

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

1. `task-0602` — render StandardMaterial in mixed app resource sets.
2. `task-0603` — add mixed material-family browser diagnostics coverage.
3. `task-0583` — promote the material showcase onto built-in material paths
   once app support exists.
4. `task-0604` — support textured unlit in mixed unlit/Matcap app frames.
5. `task-0605` — audit material showcase app-path promotion.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Ready Tasks By Category

### Proof Point Critical Path

### Audit / Refactor

### Runtime / Diagnostics

### task-0602 — Render StandardMaterial in mixed app resource sets

Category: `runtime-orchestration`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`, StandardMaterial
frame-resource/app tests, and app diagnostics.
Reference anchor: Bevy material routing/preparation patterns, local
StandardMaterial, unlit, and Matcap frame-resource helpers, and `task-0598`.

Extend app-facade multi-resource rendering so StandardMaterial can participate
in mixed material-family frames after the unlit/Matcap route exists.

Acceptance criteria:

- A StandardMaterial draw and either an unlit or Matcap draw can render in one
  app frame when all source dependencies are ready.
- Pipeline and bind group routing selects the correct material family per draw
  without reordering snapshot draw order.
- StandardMaterial readiness/resource failures remain diagnostic and do not
  submit partial frames.
- Tests cover success, a missing StandardMaterial dependency/resource, and
  resource reuse across frames.

### task-0603 — Add mixed material-family browser diagnostics coverage

Category: `runtime-orchestration`
Package/write-scope: `examples/app-diagnostics.*`, `test/e2e`, and app report
assertions.
Reference anchor: Bevy material prepare/retry diagnostics, local app report JSON
helpers, and mixed material-family app rendering from `task-0598`/`task-0602`.

Add browser-facing coverage for mixed material-family success and failure
reports once the app facade can render multiple built-in material families.

Acceptance criteria:

- The app diagnostics example includes a mixed material-family route that fails
  because of a missing texture/sampler dependency, not because mixed families
  are unsupported.
- Browser status JSON identifies the failing material family and resource key
  while keeping `submitted` false.
- Playwright covers the JSON-safe failure report and a mixed-family success
  route with non-background pixels.

### task-0583 — Promote material showcase onto built-in material paths

Category: `runtime-orchestration`
Package/write-scope: `examples/materials-showcase.*`, app facade examples, and
Playwright tests after multi-material app rendering and matcap WebGPU support
exist.
Reference anchor: Built-in unlit/standard/matcap shader contracts, Bevy
material routing, and `docs/research/MATERIAL_SHOWCASE_BOUNDARY_AUDIT_2026_05_16.md`.

Replace or supplement the direct WebGPU showcase shader with a browser showcase
that exercises Aperture's built-in material/app-facade path for unlit,
StandardMaterial, and MatcapMaterial.

Acceptance criteria:

- The showcase uses built-in material shader/resource contracts rather than a
  local demo-only PBR/matcap shader for supported materials.
- The example still shows three spinning cubes side by side.
- Playwright verifies the three material families render and the frame status
  is JSON-safe.
- Any remaining direct WebGPU fallback is explicitly labeled as temporary test
  coverage, not the preferred app-facing material path.

### task-0604 — Support textured unlit in mixed unlit/Matcap app frames

Category: `runtime-orchestration`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`, app resource tests,
and texture dependency diagnostics.
Reference anchor: Bevy material prepare/dependency retry patterns, local
textured unlit frame resources, local Matcap frame resources, and `task-0598`.

Extend the mixed unlit/Matcap app path so the unlit side may use a base-color
texture and sampler instead of being limited to factor-only materials.

Acceptance criteria:

- One textured unlit draw and one Matcap draw can render in one app frame when
  all texture/sampler dependencies are ready.
- Distinct unlit and Matcap texture/sampler resources route to the correct
  group-2 material bind group per draw.
- A missing unlit or Matcap texture/sampler dependency blocks the whole app
  frame without submission.
- Tests cover success, missing dependency diagnostics, and texture/sampler
  resource reuse.

### task-0605 — Audit material showcase app-path promotion

Category: `audit-refactor`
Package/write-scope: docs/research audit note, backlog/handoff updates, and
small corrective refactors if needed.
Reference anchor: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, built-in material contracts, and the promoted material
showcase implementation.

Audit the material showcase after it moves from direct WebGPU demo code onto the
built-in material/app-facade path.

Acceptance criteria:

- Audit confirms the showcase uses ECS-authored assets and app-facade material
  routing rather than a hidden scene graph or demo-only material pipeline.
- Audit checks app status JSON, Playwright coverage, and package dependency
  direction.
- Any drift is captured as small follow-up backlog tasks or corrected in scope.
- The handoff records reference files/patterns inspected.

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
