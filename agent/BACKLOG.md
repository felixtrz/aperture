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

Start with `task-1149`. The latest run introduced generic queued material
frame-resource collector contracts, kept the built-in wrapper compatible, added
JSON-safe queued route summaries in app render reports, planned base-color
texture-transform sampling, and audited GLB helper boundaries.

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

1. `task-1149` — surface app diagnostics summary in the standard GLB browser status.
2. `task-1148` — implement base-color texture transform offset/scale sampling.
3. `task-1150` — audit generic frame-resource collector after implementation.
4. `task-1151` — plan StandardMaterial non-UV0 texture-coordinate fixture.
5. `task-1152` — add generic collector failed-route diagnostics coverage.

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

- About 18-24 focused automation tasks for a production-shaped pipeline that can
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

### task-1149 — Surface app diagnostics summary in the standard GLB browser status

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js` and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
`packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/app-diagnostics-summary.ts`, and
`docs/research/STANDARD_GLB_TEXTURE_HELPER_EXTRACTION_AUDIT_2026_05_18.md`.

Acceptance criteria:

- The standard GLB browser status publishes `report.diagnosticsSummary` when the
  app render report includes one.
- The ready StandardMaterial texture path asserts material queue and routed
  resource-set summary counts.
- The unsupported texture-transform or delayed-dependency path asserts the
  summary remains absent or only includes the applicable route/readiness data.
- Status remains JSON-safe and does not expose raw GPU resources or source asset
  payloads.

### task-1148 — Implement base-color texture transform offset/scale sampling

Category: `webgpu-render`
Package/write-scope: `packages/render/src/materials`,
`packages/webgpu/src/webgpu`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts`.
Reference anchor:
`docs/research/GLB_TEXTURE_TRANSFORM_SAMPLING_FIXTURE_PLAN_2026_05_18.md`,
the current `base-color-transform` fixture,
`packages/render/src/materials/gltf-material.ts`, and
`packages/webgpu/src/webgpu/standard-shader.ts`.

Acceptance criteria:

- StandardMaterial base-color texture transforms support offset and scale for
  UV0 without making ECS own renderer state.
- Unsupported transform diagnostics remain for unsupported rotation or non-UV0
  cases.
- A browser fixture verifies transformed base-color sampling with readback.
- Existing `base-color-transform` diagnostic coverage is either updated to the
  unsupported case that remains true or replaced by a clearly named unsupported
  rotation fixture.

### task-1150 — Audit generic frame-resource collector after implementation

Category: `audit-refactor`
Package/write-scope: `docs/research`, `packages/webgpu/src/webgpu`, and
targeted tests only if a tiny corrective fix is needed.
Reference anchor:
`docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`,
`docs/ARCHITECTURE.md`, the generic collector from `task-1147`, and the built-in
wrapper.

Acceptance criteria:

- Confirm the generic collector does not accept `WebGpuApp`, ECS world access,
  canvas/context/queue submission, or renderer-authoritative source state.
- Verify built-in material behavior remains adapter/sink-owned rather than
  hard-coded in the generic collector.
- Check scratch reuse and JSON-safe diagnostics.
- Document concrete gaps and add follow-up tasks only for issues found.

### task-1151 — Plan StandardMaterial non-UV0 texture-coordinate fixture

Category: `runtime-orchestration`
Package/write-scope: `docs/research`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts` only for inspection.
Reference anchor:
`packages/render/src/materials/gltf-material.ts`,
`packages/webgpu/src/webgpu/standard-shader.ts`, and current GLB texture browser
fixtures.

Acceptance criteria:

- Decide the smallest future fixture that proves non-UV0 texture-coordinate
  diagnostics or sampling behavior honestly.
- Identify mesh attribute, material `texCoord`, shader, and status/reporting
  requirements.
- Add a concrete implementation follow-up only if it is smaller than the
  texture-transform sampling task and does not conflict with StandardMaterial
  scope.

### task-1152 — Add generic collector failed-route diagnostics coverage

Category: `webgpu-render`
Package/write-scope: `test/webgpu/queued-material-frame-resource-set.test.ts`
and `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts` only if a
small corrective fix is needed.
Reference anchor:
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and
`docs/research/QUEUED_FRAME_RESOURCE_EXTRACTION_BOUNDARY_AUDIT_2026_05_18.md`.

Acceptance criteria:

- The generic collector test covers a failed frame-resource result and verifies
  the injected route diagnostic is appended.
- The failure path remains JSON-safe and does not expose raw GPU handles.
- The built-in frame-resource route tests still pass.

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
