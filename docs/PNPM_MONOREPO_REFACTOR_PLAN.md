# pnpm Monorepo Refactor Plan

## Goal

Move Aperture from a single-package TypeScript project into a small
purpose-driven pnpm workspace that makes the headless simulation, render
contract, WebGPU backend, and user-facing runtime boundaries explicit.

Implementation status as of 2026-05-16:

- The workspace split is implemented with `@aperture-engine/simulation`,
  `@aperture-engine/render`, `@aperture-engine/webgpu`,
  `@aperture-engine/runtime`, and `@aperture-engine/core`.
- `@aperture-engine/core` is headless-safe and does not re-export WebGPU APIs.
- `@aperture-engine/webgpu` is the explicit backend import and depends only on
  the simulation/render contracts it consumes.
- The first runtime facade covers headless simulation and render extraction;
  WebGPU app orchestration remains a future optional facade.

This refactor should not change the runtime architecture:

```text
Simulation
  -> Bevy-inspired render extraction / render contract
  -> WebGPU backend
  -> Runtime orchestration
```

The main purpose is to make these boundaries enforceable by package imports
rather than only by convention.

The package split should preserve the Bevy-inspired bridge documented in
`docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`: ECS authoring components reference
typed assets by stable handles, render extraction produces derived state,
renderer-owned preparation turns source assets into GPU-ready resources, and
WebGPU submission remains isolated from simulation.

## Proposed Packages

### `@aperture-engine/simulation`

Headless logic package. It must be usable in Node, CI, workers, and agent tools
without a canvas, browser globals, or WebGPU.

Owns:

- ECS wrapper over EliCS.
- System/runtime stepping primitives.
- Transform components and transform resolution.
- Math utilities needed by simulation and extraction.
- Generic diagnostics helpers.
- Stable asset handles and registry, because handles are app/simulation state.

Initial source move:

- `src/ecs/*`
- `src/math/*`
- `src/diagnostics/*`
- `src/assets/*`
- `src/transform/*`

Must not import:

- `@aperture-engine/webgpu`
- browser-only APIs
- WebGPU types or resource handles

### `@aperture-engine/render`

Renderer-independent render contract and bridge package. It describes what
should be rendered, but not how a GPU backend renders it.

Owns:

- Render authoring components: `Mesh`, `Material`, `Camera`, `Light`,
  `Visibility`, `RenderLayer`, shadow request authoring, and related helpers.
- Mesh and material asset schemas that are renderer-facing data contracts.
- Render extraction from ECS state.
- `RenderSnapshot`.
- `RenderWorld`.
- Renderer-independent render asset preparation contracts.
- Snapshot inspection, cloneability, packing, and draw package planning.
- Render diagnostics and batching/resource-readiness data that do not expose raw
  GPU handles.

Initial source move:

- `src/rendering/*`
- `src/mesh/*`
- `src/materials/*`

Depends on:

- `@aperture-engine/simulation`

Must not import:

- `@aperture-engine/webgpu`
- WebGPU device/canvas/buffer/pipeline APIs

### `@aperture-engine/webgpu`

Concrete WebGPU backend. It consumes render snapshots/render-world data and owns
GPU resources.

Owns:

- WebGPU feature detection and initialization.
- Canvas/context configuration.
- Buffers, textures, samplers, bind groups, pipeline cache, shaders, render
  passes, command encoding, and queue submission.
- Unlit shader path.
- Future standard/PBR shader path.
- Light/environment GPU resource preparation.
- WebGPU frame reports, resource summaries, and backend diagnostics.

Initial source move:

- `src/webgpu/*`

Depends on:

- `@aperture-engine/render`
- `@aperture-engine/simulation` only when shared types/helpers are needed

Must not own:

- Gameplay state
- ECS world state
- Transform hierarchy
- Public scene graph

### `@aperture-engine/runtime`

User-facing orchestration package. This is the layer currently missing from the
examples. It composes simulation, render extraction, and optionally WebGPU into
usable app runners.

Owns:

- `createSimulationApp`.
- `createExtractionApp` or equivalent snapshot-only runner.
- `createWebGpuApp` eventually as an optional WebGPU facade.
- System registration.
- Frame loop.
- Fixed/update stepping policy.
- Transform resolution scheduling.
- Snapshot extraction scheduling.
- Renderer resource cache.
- Mesh/material/texture upload/update orchestration.
- Canvas resize/device-loss handling eventually.

Depends on:

- `@aperture-engine/simulation`
- `@aperture-engine/render`
- optionally `@aperture-engine/webgpu` only when the WebGPU app facade is added

Public mode intent:

```text
simulation mode: ECS + systems + transforms only
extraction mode: simulation + RenderSnapshot production, no GPU
webgpu mode: simulation + extraction + WebGPU presentation
```

### `@aperture-engine/core`

Convenience umbrella package for users who want one import path.

Owns:

- Re-exports curated stable APIs from the workspace packages.
- Public identity metadata such as version/backend/world-model information.
- A headless-safe convenience surface that intentionally excludes WebGPU APIs.

Does not own implementation logic.

## Dependency Direction

The intended dependency graph is:

```text
@aperture-engine/simulation
        ↓
@aperture-engine/render
        ↓
@aperture-engine/webgpu

@aperture-engine/runtime
  depends on simulation + render
  depends on webgpu only for WebGPU app creation

@aperture-engine/core
  re-exports public APIs
```

Forbidden dependency directions:

- `simulation -> render`
- `simulation -> webgpu`
- `render -> webgpu`
- `webgpu -> runtime`

## Target Repository Layout

```text
package.json
pnpm-workspace.yaml
pnpm-lock.yaml
tsconfig.base.json

packages/
  simulation/
    package.json
    tsconfig.json
    src/
    test/
  render/
    package.json
    tsconfig.json
    src/
    test/
  webgpu/
    package.json
    tsconfig.json
    src/
    test/
  runtime/
    package.json
    tsconfig.json
    src/
    test/
  core/
    package.json
    tsconfig.json
    src/
    test/

examples/
docs/
scripts/
test/e2e/
```

Root `package.json` should become private workspace orchestration only. The
published entrypoint package should be `@aperture-engine/core`, not `aperture`.

## Migration Phases

### Phase 1 — Prepare pnpm Workspace

Tasks:

- Add `pnpm-workspace.yaml`.
- Add `packageManager` to root `package.json`.
- Convert root package to private workspace root.
- Add workspace scripts for build, typecheck, lint, format, unit tests, e2e
  tests, and examples.
- Generate `pnpm-lock.yaml`.
- Decide whether to keep `package-lock.json` during transition or remove it in
  the same commit.

Acceptance criteria:

- `pnpm install` succeeds.
- Root workspace scripts run without moving source yet.
- Existing npm scripts have pnpm equivalents.
- CI/local docs name pnpm commands.

### Phase 2 — Create Package Shells Without Moving Logic

Tasks:

- Add package directories and `package.json` files.
- Add tsconfig project references.
- Add placeholder index files or temporary re-export shims.
- Configure package exports.
- Keep current `src/` as the source of truth during this phase.

Acceptance criteria:

- Workspace package graph builds.
- No behavior changes.
- No example changes beyond import path setup if needed.

### Phase 3 — Move Simulation Package

Tasks:

- Move ECS, math, diagnostics, assets, and transform code into
  `packages/simulation/src`.
- Move or retarget related tests.
- Update imports to `@aperture-engine/simulation`.
- Add package-level build/typecheck.

Acceptance criteria:

- Simulation package has no imports from render, webgpu, or runtime.
- Simulation tests pass in Node without browser/WebGPU assumptions.
- Root `pnpm check` passes.

### Phase 4 — Move Render Package

Tasks:

- Move render contract, mesh, and material code into `packages/render/src`.
- Update imports to consume simulation package APIs.
- Move render/mesh/material tests.
- Confirm `RenderSnapshot` and `RenderWorld` remain GPU-handle-free.

Acceptance criteria:

- Render package imports simulation but not webgpu.
- Render extraction tests pass.
- Snapshot JSON/cloneability tests pass.
- No WebGPU types or raw handles leak into render package public contracts.

### Phase 5 — Move WebGPU Package

Tasks:

- Move WebGPU backend code into `packages/webgpu/src`.
- Update imports to consume render and simulation packages.
- Move WebGPU tests.
- Keep browser examples working through package imports.

Acceptance criteria:

- WebGPU package depends on render and simulation only as needed.
- WebGPU package does not import runtime.
- Existing WebGPU unit tests pass.
- Existing browser e2e tests pass.

### Phase 6 — Add Runtime Package

Tasks:

- Add the first app runner APIs:
  - `createSimulationApp`
  - `createWebGpuApp`
- Implement system registration and frame stepping.
- Implement the minimal renderer resource manager needed by the spinning cube
  example.
- Keep lower-level APIs available for tests and advanced use.
- Rewrite the spinning cube example to use runtime APIs.

Acceptance criteria:

- A spinning unlit cube can be authored with ECS components plus a spin system
  without manually creating pipelines, bind groups, command encoders, or render
  passes in example code.
- A simulation-only example or test can run the same spin system without WebGPU.
- Runtime package does not make WebGPU mandatory for simulation mode.

### Phase 7 — Add Core Umbrella Package

Tasks:

- Add `@aperture-engine/core`.
- Re-export curated APIs from simulation, render, webgpu, and runtime.
- Preserve familiar import ergonomics for examples.
- Document package-specific import paths for headless and backend-specific use.

Acceptance criteria:

- `@aperture-engine/core` is the main user entrypoint.
- Headless users can import from `@aperture-engine/simulation` or runtime
  simulation APIs without loading WebGPU.
- Examples use either `@aperture-engine/core` or focused package imports
  intentionally.

### Phase 8 — Remove Legacy Single-Package Source

Tasks:

- Remove or empty old root `src/`.
- Remove stale build outputs and package metadata.
- Update docs, examples, and tests to workspace paths.
- Add dependency-boundary lint/check script if practical.

Acceptance criteria:

- No production imports reference old root `src/`.
- Root build/test/check commands cover all packages and examples.
- Package dependency graph matches this plan.

## Suggested First Runtime API Target

The refactor should be judged partly by whether this style becomes possible:

```ts
const app = await createWebGpuApp({ canvas });

const cube = app.spawnMesh({
  transform: createLocalTransform(),
  mesh: createBoxMeshAsset(),
  material: createUnlitMaterialAsset(),
});

app.addSystem((_world, _dt, time) => {
  cube
    .getVectorView(LocalTransform, "rotation")
    .set(quatFromAxisAngle([0, 1, 0], time));
});

app.run();
```

And this headless variant:

```ts
const app = createSimulationApp();

app.addSystem(spinSystem);
app.step(1 / 60);
```

## Risks

- Moving too many files at once could obscure behavioral regressions.
- Package splits may expose hidden circular dependencies currently hidden by
  relative imports.
- Examples may temporarily become more complex if moved before the runtime layer
  exists.
- `@aperture-engine/core` may become too broad if it starts owning logic instead
  of re-exporting stable APIs.
- Keeping mesh/material contracts in `render` means simulation-only users who
  author renderable scenes may still depend on render; this is acceptable for
  extraction-mode apps but should remain optional for pure simulation apps.

## Non-Goals For This Refactor

- Do not add PBR as part of the monorepo move.
- Do not add worker-thread simulation yet.
- Do not introduce WebGL or alternate render backends.
- Do not replace EliCS.
- Do not redesign the ECS/render snapshot model.
- Do not create a public mutable scene graph.

## Recommended Commit Strategy

Use small commits:

1. pnpm workspace scaffolding.
2. package shells and tsconfig references.
3. simulation move.
4. render move.
5. webgpu move.
6. runtime package MVP.
7. core umbrella package and docs.
8. legacy cleanup.

Each move commit should run targeted package tests plus the root check command.
