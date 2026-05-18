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

Start with `task-1127`. The latest run extracted the queued built-in
resource-set collector from WebGPU app orchestration, added GLB-derived
occlusion and emissive StandardMaterial browser fixtures, and added GLB
alpha-mask/double-sided render-state browser diagnostics. The GLB browser
helper/status audit found no boundary drift, and the next frame-resource
collector split has been planned. GLB render-state browser status helpers were
cleaned up locally without changing published status shapes. The GLB
StandardMaterial dependency diagnostics matrix is now planned; the remaining
dependency-diagnostic work is implementation coverage, not another planning
pass.

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

1. `task-1127` — extract queued built-in frame-resource preparation set.
2. `task-1128` — add GLB invalid texture/sampler diagnostics matrix tests.
3. `task-1129` — add GLB delayed dependency browser diagnostics fixture.
4. `task-1132` — plan GLB alpha-mask backface visual fixture.
5. `task-1136` — audit StandardMaterial alpha-mask coverage alignment.

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

### task-1127 — Extract queued built-in frame-resource preparation set

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and targeted
WebGPU route/frame-resource tests.
Reference anchor:
`docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/engine/src/scene/renderer/forward-renderer.js`, and
`references/three.js/src/renderers/common/RenderObject.js`.

Acceptance criteria:

- Move `prepareQueuedBuiltInFrameResources()` scratch ownership and result
  assembly out of `app.ts` without changing rendered output or diagnostics.
- Keep pipeline lookup, layout lookup, and app/device-specific frame-resource
  callbacks injected from `app.ts`.
- Preserve JSON-safe frame-resource route diagnostics and resource reuse
  counters.
- Existing queued route tests and full `standard-gltf-texture` browser spec
  pass, plus a targeted test for one successful prepared frame-resource set and
  one failed frame-resource route diagnostic.

### task-1128 — Add GLB invalid texture/sampler diagnostics matrix tests

Category: `render-bridge`
Package/write-scope: `packages/render/src/assets`,
`packages/render/src/materials`, and targeted GLB mapping/readiness tests.
Reference anchor:
`docs/research/GLB_STANDARD_MATERIAL_DEPENDENCY_DIAGNOSTICS_MATRIX_2026_05_17.md`,
Bevy glTF/load-context dependency patterns, and current
`createGltfAssetMappingReport()` / `createStandardMaterialTextureReadinessReport()`
tests.

Acceptance criteria:

- Add a targeted GLB-shaped test matrix for base-color, metallic-roughness,
  normal, occlusion, and emissive slots.
- Cover at least one invalid texture/image path and one invalid sampler path,
  preserving slot, field, texture index, sampler index when present, and
  dependency kind in diagnostics.
- Verify source registration skips or omits invalid planned dependencies
  without registering a material with missing source texture/sampler edges.
- Keep reports JSON-safe and free of source asset objects or WebGPU resources.

### task-1129 — Add GLB delayed dependency browser diagnostics fixture

Category: `runtime-orchestration`
Package/write-scope: `examples/standard-gltf-texture.js`,
`test/e2e/standard-gltf-texture.spec.ts`, and app-facing diagnostics only.
Reference anchor:
`docs/research/GLB_STANDARD_MATERIAL_DEPENDENCY_DIAGNOSTICS_MATRIX_2026_05_17.md`,
existing `standard-gltf-texture` GLB-derived scenarios, and generic
missing/loading/failed texture browser diagnostics.

Acceptance criteria:

- Add a GLB-derived browser scenario that uses GLB-style material, texture, and
  sampler handle keys while deliberately marking source texture/sampler
  dependencies loading or failed before rendering.
- Assert app-facing readiness diagnostics preserve GLB-derived keys, slot names,
  dependency kinds, and statuses for texture and sampler failures.
- Assert the published browser status remains JSON-safe and contains no raw
  source asset objects or WebGPU resources.
- Do not claim binary `.glb` loading or transparent blending support.

### task-1132 — Plan GLB alpha-mask backface visual fixture

Category: `runtime-orchestration`
Package/write-scope: `docs/research`, `examples/standard-gltf-texture.js`, and
`test/e2e/standard-gltf-texture.spec.ts` only for inspection.
Reference anchor:
`docs/research/GLB_ALPHA_DOUBLE_SIDED_RENDER_STATE_DIAGNOSTICS_PLAN_2026_05_17.md`,
the alpha-mask texture pixel fixture, and current StandardMaterial render-state
pipeline behavior.

Acceptance criteria:

- Plan a narrow browser fixture that proves `doubleSided: true` visually without
  adding transparent blending or multi-object sorting.
- Define mesh orientation, camera/sample positions, source material fields,
  expected pipeline key, and screenshot/readback assertions.
- Decide whether the proof should reuse the alpha-mask texture fixture or use a
  scalar masked material with a back-facing primitive.
- Add a concrete implementation follow-up only if the plan stays aligned with
  current StandardMaterial support.

### task-1136 — Audit StandardMaterial alpha-mask coverage alignment

Category: `audit-refactor`
Package/write-scope: `docs/research`, alpha-mask browser/shader/buffer tests,
and small docs/backlog updates only if needed.
Reference anchor:
`docs/research/GLB_ALPHA_MASK_TEXTURE_PIXEL_FIXTURE_PLAN_2026_05_17.md`,
`packages/webgpu/src/webgpu/standard-shader.ts`,
`packages/webgpu/src/webgpu/standard-material-buffer.ts`, and the GLB
alpha-mask browser tests.

Acceptance criteria:

- Confirm alpha-mask coverage now spans glTF source mapping, buffer feature
  flags, WGSL alpha discard, pipeline key, desktop pixels, and narrow viewport
  pixels.
- Identify any duplicated status/test helper code worth extracting later.
- Verify no alpha-mask coverage claims transparent blending or binary `.glb`
  loading.
- Document findings and add follow-up tasks only for concrete gaps.

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
