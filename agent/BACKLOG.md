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

Start with `task-0617`. StandardMaterial base-color texture rendering and the
narrow GLB container parser are now in place. Continue into deeper
StandardMaterial PBR texture slices, then the generic material queue/sorter
work.

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

1. `task-0617` — render StandardMaterial metallic-roughness textures.
2. `task-0618` — add StandardMaterial normal-map tangent diagnostics.
3. `task-0619` — add a generic material-family render queue contract.
4. `task-0620` — render StandardMaterial emissive and occlusion textures.
5. `task-0621` — integrate opaque material queue app routing.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Post-Queue Direction

After the current ready queue, steer backlog refill toward full StandardMaterial
PBR support and then a generic render pipeline/material queue. The near-term
goal is not to add unrelated engine features; it is to turn the current
specialized material proof path into the normal renderer architecture.

Preferred refill order after the current ready queue:

1. StandardMaterial metallic-roughness texture rendering.
2. StandardMaterial normal map and tangent/bitangent support.
3. StandardMaterial emissive and occlusion texture support.
4. Color-space, UV-set, sampler, and material dependency diagnostics for the
   above texture paths.
5. Audit the expanded StandardMaterial path against glTF metallic-roughness
   expectations.
6. Replace narrow mixed-family app routing with a generic material-family render
   queue.
7. Add opaque phase queueing/sorting by pipeline, material, mesh, and depth.
8. Add transparent phase sorting and render-state validation.
9. Add render-world/prepared-asset contracts that make material preparation
   generic instead of family-specific app branches.
10. Add IBL/environment lighting for StandardMaterial.
11. Add shadow-map passes and StandardMaterial shadow sampling.

Keep GLB work narrow until StandardMaterial PBR is ready enough to map glTF
materials honestly. GLB container parsing and diagnostics are fine, but GLB
viewer/material mapping should not outrun the material and queue architecture.

## Ready Tasks By Category

### Proof Point Critical Path

### Audit / Refactor

### task-0617 — Render StandardMaterial metallic-roughness textures

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, StandardMaterial shader/
buffer/bind-group/frame-resource tests, and focused app/browser coverage.
Reference anchor: task-0615 StandardMaterial base-color texture path, Bevy
material preparation patterns, three.js/PlayCanvas PBR metallic-roughness
texture handling, and glTF metallic-roughness channel expectations.

Extend StandardMaterial from scalar metallic/roughness factors to optional
metallic-roughness texture sampling.

Acceptance criteria:

- StandardMaterial WGSL samples an optional metallic-roughness texture using
  roughness from the green channel and metallic from the blue channel, multiplied
  by the authored scalar factors.
- Prepared texture/sampler resources are cached and reported with JSON-safe
  reuse diagnostics.
- Pipeline keys specialize factor-only, base-color-textured, and
  metallic-roughness-textured StandardMaterial variants without breaking scalar
  lit StandardMaterial rendering.
- App/browser or focused WebGPU tests verify textured metallic/roughness pixels
  and blocked texture/sampler dependencies.

### task-0618 — Add StandardMaterial normal-map tangent diagnostics

Category: `webgpu-render`
Package/write-scope: `packages/render` mesh/material contracts,
`packages/webgpu/src/webgpu` StandardMaterial planning/shader tests, and focused
diagnostics coverage.
Reference anchor: Bevy mesh attribute/material preparation patterns, three.js
normal material/PBR normal-map behavior, and PlayCanvas tangent-space normal-map
handling.

Prepare the StandardMaterial normal-map slice by making tangent requirements
explicit before treating normal maps as supported PBR rendering.

Acceptance criteria:

- Mesh/material contracts can express whether tangent data required by a
  StandardMaterial normal map is available for a draw.
- StandardMaterial dependency/readiness diagnostics clearly block normal-map
  rendering when a normal texture is authored but required tangent data is
  missing.
- The WebGPU StandardMaterial pipeline/shader plan records the normal-map
  specialization key without changing factor-only or base-color texture output.
- Tests cover ready tangent metadata, missing tangent diagnostics, and JSON-safe
  report output.

### task-0619 — Add a generic material-family render queue contract

Category: `render-bridge`
Package/write-scope: `packages/render`, `packages/webgpu/src/webgpu`, targeted
queue/sort tests, and docs/research notes if needed.
Reference anchor: `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`,
Bevy render phase queue/sort patterns, and existing Aperture render-frame plan
contracts.

Introduce the first generic queue contract that can replace pairwise
mixed-family app routing after the near-term StandardMaterial texture slices.

Acceptance criteria:

- A plain, serializable material queue item can identify material family,
  pipeline key, mesh key, material resource key, render phase, draw index, and
  depth/sort data without carrying WebGPU handles.
- Queue building works from `RenderSnapshot` data plus prepared resource-key
  resolvers, not direct ECS state or renderer-owned gameplay state.
- Opaque queue sort order is stable and groups by pipeline/material/mesh before
  depth where appropriate for the initial contract.
- Tests cover mixed unlit, MatcapMaterial, and StandardMaterial queue items and
  prove the output is JSON-safe.

### task-0620 — Render StandardMaterial emissive and occlusion textures

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, StandardMaterial shader/
bind-group/frame-resource tests, and focused app/browser coverage.
Reference anchor: task-0615 and task-0617 StandardMaterial texture paths,
three.js/PlayCanvas glTF PBR texture handling, and Bevy material preparation
patterns.

Extend StandardMaterial PBR texture support beyond base color and
metallic-roughness by sampling emissive and occlusion textures.

Acceptance criteria:

- StandardMaterial WGSL samples an optional emissive texture and combines it
  with `emissiveFactor`.
- StandardMaterial WGSL samples an optional occlusion texture and applies
  `occlusionStrength` to ambient/indirect contribution without changing direct
  light math.
- Prepared texture/sampler resources, bind group entries, and pipeline keys
  specialize emissive and occlusion texture variants without breaking scalar,
  base-color, or metallic-roughness paths.
- Tests cover resource reuse, missing texture/sampler dependencies, shader
  metadata, and at least one browser/app pixel route.

### task-0621 — Integrate opaque material queue app routing

Category: `webgpu-render`
Package/write-scope: `packages/render`, `packages/webgpu/src/webgpu`, focused
mixed-material app tests, and render-frame plan tests.
Reference anchor: task-0619 generic material-family queue contract, Bevy render
phase queue/sort patterns, and existing Aperture render-frame plan contracts.

Use the generic material-family queue to replace the current narrow pairwise
and three-family app routing for opaque built-in material frames.

Acceptance criteria:

- `createWebGpuApp.render()` can route mixed opaque unlit, MatcapMaterial, and
  StandardMaterial frames from generic queue items rather than hard-coded
  material-family branch shapes.
- Queue consumption preserves stable grouping by pipeline/material/mesh and
  emits JSON-safe diagnostics for unsupported material families or missing
  prepared resources.
- Existing material showcase and app diagnostics examples still render through
  the app facade without renderer-owned ECS/game state.
- Tests cover scalar and textured StandardMaterial queue items alongside unlit
  and MatcapMaterial items.

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
