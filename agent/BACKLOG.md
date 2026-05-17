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

Start with `task-0643`. StandardMaterial opaque, alpha-test, and transparent
queue phases now render through the WebGPU app route, and the generic
material-family queue contract has been planned. The next slice should wrap the
current built-in family preparation branches behind a narrow internal adapter
contract without adding new material behavior.

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

1. `task-0643` — add a generic queued material resource adapter contract.
2. `task-0644` — tighten StandardMaterial texture dependency diagnostics.
3. `task-0645` — audit StandardMaterial PBR texture expectations.
4. `task-0646` — promote WebGPU validation warning guards to shared E2E helpers.
5. `task-0647` — audit queued material adapter integration.

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

### task-0643 — Add generic queued material resource adapter contract

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`, narrow helper modules
under `packages/webgpu/src/webgpu`, and focused WebGPU app tests.
Reference anchor:
`docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`,
Bevy render-asset preparation, and the current unlit/Matcap/Standard
frame-resource branches.

Acceptance criteria:

- Queue item resource preparation is dispatched through a typed adapter contract
  instead of open-coded family switches where practical.
- The adapter contract keeps WebGPU resources backend-owned and does not move
  GPU handles into `packages/render`.
- Existing unlit, MatcapMaterial, and StandardMaterial queue tests keep passing.
- The change is narrow enough to avoid broad renderer rewrites.

### task-0644 — Tighten StandardMaterial texture dependency diagnostics

Category: `render-bridge`
Package/write-scope: `packages/render/src/materials`,
`packages/render/src/rendering/extraction.ts`, and focused readiness/extraction
tests.
Reference anchor: Bevy material extraction diagnostics and glTF texture-channel
validation patterns from three.js and PlayCanvas.

Acceptance criteria:

- StandardMaterial dependency diagnostics clearly identify missing/loading/failed
  texture and sampler handles for every supported PBR texture channel.
- Diagnostics include material key, field, texture key or sampler key when
  available, and remain JSON-safe.
- Extraction blocks invalid texture dependencies before WebGPU preparation.
- Focused readiness and extraction tests cover at least one missing sampler and
  one failed texture path.

### task-0645 — Audit StandardMaterial PBR texture expectations

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, and narrow tests/docs
only if drift is found.
Reference anchor: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, three.js
GLTFLoader material mapping, PlayCanvas GLB parser, and Bevy glTF material
loading.

Acceptance criteria:

- Audit compares current StandardMaterial texture behavior against glTF
  metallic-roughness expectations.
- Audit confirms ECS/render extraction boundaries and WebGPU resource ownership
  remain intact.
- Any drift is fixed with scoped edits or captured as concrete follow-up tasks.
- Validation includes package boundary checks and focused StandardMaterial tests.

### task-0646 — Promote WebGPU validation warning guards to shared E2E helpers

Category: `docs-tooling`
Package/write-scope: `test/e2e` helpers and selected WebGPU browser specs.
Reference anchor: existing `test/e2e/webgpu-status.ts`,
`test/e2e/standard-queue-phases.spec.ts`, and browser validation warnings
observed during `task-0640`.

Acceptance criteria:

- A shared helper records WebGPU validation warnings/errors from Playwright
  console messages.
- At least the Standard queue-phase and material showcase specs assert that no
  WebGPU command-buffer or auto-layout validation warnings were emitted.
- The helper ignores unrelated browser noise such as missing favicon requests.
- Focused Playwright specs pass with the guard enabled.

### task-0647 — Audit queued material adapter integration

Category: `audit-refactor`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, and narrow tests or
docs only if drift is found.
Reference anchor:
`docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`,
`docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`, package boundaries, and focused
queue/app tests.

Acceptance criteria:

- Audit confirms any queued material adapter implementation keeps
  `RenderSnapshot` as the boundary and WebGPU resources inside `packages/webgpu`.
- Audit confirms optimized multi-unlit reuse and StandardMaterial queue-phase
  browser coverage still pass.
- Any drift is fixed with scoped edits or captured as concrete follow-up tasks.
- Validation includes package boundary checks and focused queue/app tests.

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
