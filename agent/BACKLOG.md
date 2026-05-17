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

Start with `task-0610`. The material showcase now proves the ECS-authored
app-facade path for unlit, StandardMaterial, and MatcapMaterial in one browser
example, StandardMaterial source texture dependencies now have app/browser
diagnostics, and DebugNormalMaterial has renderer-independent preparation
metadata.

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

1. `task-0610` — document the app facade as the default example path.
2. `task-0611` — plan the first renderer-independent GLB container slice.
3. `task-0612` — audit post-showcase material route specialization.
4. `task-0613` — add package-boundary import guard coverage.
5. `task-0614` — add DebugNormalMaterial WebGPU shader metadata contracts.

Defer allocation-only cleanup and metadata-only shader-contract tasks unless
they are a direct blocker for this track.

## Ready Tasks By Category

### Proof Point Critical Path

### task-0610 — Document app facade as the default example path

Category: `docs-tooling`
Package/write-scope: `README.md`, `docs/ARCHITECTURE.md`, and example-facing
documentation only.
Reference anchor: `docs/NORTH_STAR.md`, `docs/MEDIUM_LONG_TERM_GOALS.md`, and
the app-facade examples (`spinning-cube`, `matcap-app`,
`materials-showcase`).

Update project-facing docs so new work starts from ECS-authored app-facade
examples instead of direct WebGPU demo snippets.

Acceptance criteria:

- Docs identify `createWebGpuApp`, typed assets, ECS components, and systems as
  the preferred browser example shape.
- Direct WebGPU helpers are described as backend/test surfaces, not the default
  user API.
- The docs preserve the package-boundary rule that `@aperture-engine/core` stays
  headless-safe and WebGPU is imported explicitly.
- Documentation changes do not add new architectural commitments beyond
  existing decisions.

### task-0611 — Plan the first renderer-independent GLB container slice

Category: `docs-tooling`
Package/write-scope: `docs/research`, `agent/BACKLOG.md`, and no runtime code
unless a tiny type stub is needed.
Reference anchor: `docs/MEDIUM_LONG_TERM_GOALS.md`, glTF 2.0 GLB container
structure, and local reference engine loader patterns.

Create a concrete implementation plan for a narrow GLB-only loader foundation
that preserves typed source assets and structured diagnostics.

Acceptance criteria:

- The research note defines the first GLB slice: header/chunk validation, JSON
  chunk extraction, binary chunk bounds, and JSON-safe diagnostics.
- The plan explicitly excludes OBJ/FBX/STL/USD and advanced glTF extensions.
- Follow-up backlog tasks are added for parser tests and typed asset mapping if
  needed.
- No renderer-owned GPU resources or browser APIs are introduced into
  simulation/render packages.

### Audit / Refactor

### task-0612 — Audit post-showcase material route specialization

Category: `audit-refactor`
Package/write-scope: docs/research audit note, backlog/handoff updates, and
small corrective refactors if needed.
Reference anchor: `docs/NORTH_STAR.md`, `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`, Bevy material route/prepare patterns, and
`packages/webgpu/src/webgpu/app.ts`.

Audit the now-working mixed material app routes before expanding StandardMaterial
textures or DebugNormalMaterial rendering.

Acceptance criteria:

- Audit checks whether the current pairwise/three-family app route helpers are
  still a safe narrow bridge or need a generic material-family queue task.
- Audit verifies pipeline-scoped bind groups, material resource-key resolution,
  and resource reuse reports remain JSON-safe.
- Any package-boundary or hidden-scene-graph drift is corrected or captured as a
  small follow-up.
- Handoff records the inspected reference files and recommended next task.

### task-0613 — Add package-boundary import guard coverage

Category: `docs-tooling`
Package/write-scope: architecture test or script plus targeted test coverage.
Reference anchor: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and current
workspace package dependency manifests.

Add automated coverage for the package-boundary invariant that WebGPU/browser
backend APIs stay out of headless packages.

Acceptance criteria:

- The guard fails if `packages/simulation`, `packages/render`,
  `packages/runtime`, or `packages/core` imports `@aperture-engine/webgpu` or
  direct browser WebGPU globals in source files.
- The guard allows `packages/webgpu`, browser examples, and WebGPU tests to use
  backend APIs.
- The check runs under the existing test/check workflow without adding a large
  dependency.
- Failure output names the offending file and forbidden import/global.

### task-0614 — Add DebugNormalMaterial WebGPU shader metadata contracts

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, public WebGPU exports, and
targeted shader/descriptor tests only.
Reference anchor: local unlit/Matcap shader metadata contracts,
`references/engine` debug/normal visualization shader patterns, and
`references/three.js` normal material shader behavior.

Define the WebGPU-side shader metadata and pipeline descriptor plan for
DebugNormalMaterial without activating app-facade rendering.

Acceptance criteria:

- DebugNormalMaterial has WGSL shader metadata declaring view/world/material
  binding requirements appropriate for normal visualization.
- Pipeline descriptor planning uses the renderer-independent material pipeline
  key and rejects unsupported topology/layout inputs with JSON-safe diagnostics.
- No frame-resource creation, bind group creation, or browser example activation
  is introduced in this task.
- Tests cover shader metadata, descriptor planning, and public exports.

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
