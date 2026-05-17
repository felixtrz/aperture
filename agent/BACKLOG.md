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

Start with `task-0625`. StandardMaterial normal-map shader support and the
glTF PBR texture audit have landed, so the next implementation slice should
make prepared material resource contracts renderer-independent.

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

1. `task-0625` — add generic prepared material resource contracts.
2. `task-0632` — add StandardMaterial texture semantic/color-space diagnostics.
3. `task-0634` — diagnose unsupported StandardMaterial texture UV sets.
4. `task-0635` — add StandardMaterial TEXCOORD_1 shader variants.
5. `task-0630` — route single-family app frames through material queue.
6. `task-0631` — plan alpha-test and transparent app queue consumption.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Post-Queue Direction

After the current ready queue, steer backlog refill toward full StandardMaterial
PBR support and then a generic render pipeline/material queue. The near-term
goal is not to add unrelated engine features; it is to turn the current
specialized material proof path into the normal renderer architecture.

Preferred refill order after the current ready queue:

1. StandardMaterial metallic-roughness texture rendering.
2. StandardMaterial emissive and occlusion texture support.
3. Color-space, UV-set, sampler, and material dependency diagnostics for the
   above texture paths.
4. Audit the expanded StandardMaterial path against glTF metallic-roughness
   expectations.
5. Replace narrow mixed-family app routing with a generic material-family render
   queue.
6. Add opaque phase queueing/sorting by pipeline, material, mesh, and depth.
7. Add transparent phase sorting and render-state validation.
8. Add render-world/prepared-asset contracts that make material preparation
   generic instead of family-specific app branches.
9. Add IBL/environment lighting for StandardMaterial.
10. Add shadow-map passes and StandardMaterial shadow sampling.

Keep GLB work narrow until StandardMaterial PBR is ready enough to map glTF
materials honestly. GLB container parsing and diagnostics are fine, but GLB
viewer/material mapping should not outrun the material and queue architecture.

## Ready Tasks By Category

### Proof Point Critical Path

### Audit / Refactor

### task-0625 — Add generic prepared material resource contracts

Category: `render-bridge`
Package/write-scope: `packages/render` prepared-asset contracts and targeted
tests; `packages/webgpu/src/webgpu` only for adapter tests if needed.
Reference anchor: Bevy `RenderAsset` preparation pattern, existing unlit,
MatcapMaterial, and StandardMaterial preparation helpers.

Acceptance criteria:

- A renderer-independent prepared material descriptor can identify source
  material key, material family, pipeline key, bind-group/resource key, and
  dependency readiness without WebGPU handles.
- Built-in unlit, MatcapMaterial, StandardMaterial, and DebugNormalMaterial
  preparation helpers can populate the descriptor shape.
- The descriptor is JSON-safe and suitable for material queue resource-key
  resolution.
- Tests cover all built-in material families and invalid source material kinds.

### task-0632 — Add StandardMaterial texture semantic/color-space diagnostics

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials`,
`packages/render/src/rendering`, and focused material/extraction tests.
Reference anchor:
`docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`,
three.js `GLTFLoader` color-space assignment, Bevy StandardMaterial texture
channel docs, and existing material dependency readiness reports.

Acceptance criteria:

- StandardMaterial readiness can diagnose base-color/emissive textures that are
  not authored as color/sRGB data.
- StandardMaterial readiness can diagnose metallic-roughness, normal, and
  occlusion textures that are not authored as data/linear maps.
- Diagnostics are JSON-safe and include material key, texture key, field, and
  expected semantic/color-space hints.
- Existing valid StandardMaterial texture tests continue to pass.

### task-0634 — Diagnose unsupported StandardMaterial texture UV sets

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials`,
`packages/render/src/rendering`, and focused material/extraction tests.
Reference anchor:
`docs/research/STANDARD_MATERIAL_UV_TEXTURE_TRANSFORM_PLAN_2026_05_17.md`,
Bevy glTF UV channel mapping, three.js `GLTFLoader` texture channel handling,
and existing StandardMaterial dependency/readiness diagnostics.

Acceptance criteria:

- StandardMaterial readiness diagnoses any texture binding with `texCoord > 0`
  until a shader variant can consume `TEXCOORD_1`.
- Diagnostics are JSON-safe and include material key, field, texture key when
  present, and the unsupported `texCoord`.
- Existing `TEXCOORD_0`/undefined texture bindings remain valid.
- Extraction/app diagnostics surface the unsupported UV-set reason before
  WebGPU resource preparation.

### task-0635 — Add StandardMaterial TEXCOORD_1 shader variants

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`,
`packages/render/src/rendering`, focused StandardMaterial shader/pipeline/app
tests, and browser coverage if practical.
Reference anchor:
`docs/research/STANDARD_MATERIAL_UV_TEXTURE_TRANSFORM_PLAN_2026_05_17.md`,
three.js texture channel selection, Bevy UV channel material keys, and existing
StandardMaterial texture shader specialization.

Acceptance criteria:

- StandardMaterial shader variants can sample texture bindings from
  `TEXCOORD_1` when mesh metadata provides that attribute.
- Pipeline keys/layout metadata distinguish `TEXCOORD_0` and `TEXCOORD_1`
  variants without encoding raw material handles.
- Missing `TEXCOORD_1` mesh attributes block rendering with JSON-safe
  diagnostics.
- Tests cover at least one ready `TEXCOORD_1` texture path and one missing-UV
  blocked path.

### task-0630 — Route single-family app frames through material queue

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts` and focused app tests.
Reference anchor: task-0621 queue-driven app routing, task-0628 reusable queue
scratch, Bevy render phase queue/sort patterns.

Acceptance criteria:

- Single-family unlit, MatcapMaterial, and StandardMaterial app frames can use
  the queue route without regressing existing resource reuse and diagnostics
  tests.
- Same-resource multi-draw frames continue to render through stable prepared
  mesh/material resource keys.
- The optimized multi-unlit path is either preserved as an explicit fast path or
  replaced only if tests prove equivalent cache/reuse behavior.
- No pairwise mixed-material app branches are reintroduced.

### task-0631 — Plan alpha-test and transparent app queue consumption

Category: `audit-refactor`
Package/write-scope: `docs/research`, backlog updates, and small diagnostics
test adjustments only if needed.
Reference anchor: task-0623 transparent queue sort coverage, task-0629
unsupported phase diagnostics, three.js/PlayCanvas transparent sorting
patterns, Bevy render phase split.

Acceptance criteria:

- The plan identifies the smallest app/render-frame changes needed to consume
  alpha-test and transparent queue items rather than only diagnosing them.
- The plan covers render-state validation, phase ordering, depth/write/blend
  behavior, and JSON-safe diagnostics.
- The plan confirms which material families should be supported first and which
  tests should prove browser pixel behavior.
- Backlog receives concrete implementation slices if the plan finds safe next
  steps.

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
