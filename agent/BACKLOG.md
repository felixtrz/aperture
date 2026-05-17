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

Start with `task-0636`. Generic prepared material descriptors, StandardMaterial
texture readiness diagnostics, `TEXCOORD_1` shader variants, alpha/transparent
phase-consumption planning, and single-family queue app routing have landed, so
the next slice should make built-in WebGPU pipeline descriptors render-state
aware before accepting non-opaque queue phases.

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

1. `task-0636` — make built-in WebGPU pipelines render-state aware.
2. `task-0637` — consume StandardMaterial alpha-test queue items.
3. `task-0638` — consume StandardMaterial transparent alpha-blend queue items.
4. `task-0639` — add browser pixel coverage for StandardMaterial queue phases.
5. `task-0640` — audit expanded queue phase consumption.

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

### task-0636 — Make built-in WebGPU pipelines render-state aware

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/*-pipeline-descriptor.ts`,
`packages/webgpu/src/webgpu/*-pipeline.ts`, and focused pipeline descriptor
tests.
Reference anchor:
`docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`, Bevy
mesh pipeline alpha/depth state selection, three.js material transparency
routing, and PlayCanvas material blend/depth state.

Acceptance criteria:

- Built-in descriptor plans and browser pipeline descriptors derive depth write,
  depth compare, cull mode, and blend target state from material pipeline
  render-state tokens.
- `mask` keys keep replacement rendering semantics: no blend and depth writes
  enabled when a depth format is present.
- `blend|alpha` keys produce WebGPU alpha blending and disable depth writes
  while preserving depth tests.
- Tests cover cache-key and browser-descriptor differences for opaque, mask,
  and alpha-blend StandardMaterial keys.

### task-0637 — Consume StandardMaterial alpha-test queue items

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/standard-*`, and focused app/render-frame tests.
Reference anchor:
`docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`, Bevy
`AlphaMask3d` binned phase, and existing StandardMaterial alpha-cutoff shader
support.

Acceptance criteria:

- The queue app route accepts `StandardMaterial` items in the `alpha-test`
  phase and submits them after opaque queue items.
- Unsupported alpha-test material families still emit JSON-safe diagnostics
  without submitting a partial frame.
- StandardMaterial alpha-test items reuse prepared mesh/material resource keys
  and pipeline cache entries across frames.
- Focused app tests cover mixed opaque plus alpha-test StandardMaterial frames.

### task-0638 — Consume StandardMaterial transparent alpha-blend queue items

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/standard-*`, and focused app/render-frame tests.
Reference anchor:
`docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`,
three.js transparent render-list sorting, PlayCanvas back-to-front transparent
sorting, and Bevy `Transparent3d` sorted phase.

Acceptance criteria:

- The queue app route accepts `StandardMaterial` items in the `transparent`
  phase when `alphaMode` is `blend`, `depth.write` is false, and
  `blend.preset` is `alpha`.
- Transparent queue order remains back-to-front and comes after opaque and
  alpha-test items.
- Unsupported transparent material families or blend presets emit JSON-safe
  diagnostics with render id, draw index, material family, phase, and entity.
- Focused app tests cover two overlapping transparent StandardMaterial queue
  items with stable sorted order.

### task-0639 — Add browser pixel coverage for StandardMaterial queue phases

Category: `webgpu-render`
Package/write-scope: `examples`, `test/e2e`, and any narrow WebGPU app fixture
helpers needed for deterministic pixels.
Reference anchor:
`docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`,
existing materials-showcase Playwright coverage, and three.js/PlayCanvas
opaque-before-transparent render order.

Acceptance criteria:

- A browser path renders overlapping opaque, alpha-test StandardMaterial, and
  transparent StandardMaterial draws through the queue route.
- Playwright verifies deterministic non-background pixels for the alpha-test
  cutout and transparent blend regions.
- Frame diagnostics stay JSON-safe and report the expected draw count and no
  unsupported phase diagnostics.
- The test does not rely on WebGL fallback or renderer-owned scene state.

### task-0640 — Audit expanded queue phase consumption

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, and narrow tests or
docs only if drift is found.
Reference anchor:
`docs/research/ALPHA_TRANSPARENT_QUEUE_CONSUMPTION_PLAN_2026_05_17.md`,
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, Bevy render phases, three.js
render lists, and PlayCanvas layer sorting.

Acceptance criteria:

- Audit confirms alpha-test and transparent consumption remains snapshot-derived
  and queue-driven with no hidden mutable scene graph.
- Audit confirms WebGPU resources remain backend-owned and package boundaries
  still pass.
- Any drift in render-state validation, phase ordering, or diagnostics is
  corrected with small scoped edits or captured as follow-up backlog tasks.
- Validation includes package boundary checks and the focused queue/app tests.

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
