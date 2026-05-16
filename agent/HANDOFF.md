# Handoff

## Current Status

The pnpm monorepo/package-boundary refactor is implemented.

Completed in this run:

- Converted the repo to a pnpm workspace.
- Added packages:
  - `@aperture-engine/simulation`
  - `@aperture-engine/render`
  - `@aperture-engine/webgpu`
  - `@aperture-engine/runtime`
  - `@aperture-engine/core`
- Moved implementation code from `src/*` into package-scoped source trees.
- Removed the old root `src/index.ts`.
- Removed `package-lock.json` and generated `pnpm-lock.yaml`.
- Replaced active `MeshRenderer` authoring with separate `Mesh` and `Material`
  ECS components.
- Updated extraction, examples, fixtures, and tests to use `Mesh` plus
  `Material`.
- Decoupled primitive mesh builders from material handles.
- Added a first headless runtime facade:
  - `createSimulationApp`
  - `createExtractionApp`
- Made `@aperture-engine/core` headless-safe; it exports simulation, render, and
  runtime only.
- Made `@aperture-engine/webgpu` the explicit backend import; it re-exports only
  simulation/render contracts plus WebGPU backend APIs.

## Architecture Notes

- ECS remains authoritative.
- Rendering remains derived from extracted snapshots/render-world data.
- `@aperture-engine/simulation` imports no render/runtime/WebGPU packages.
- `@aperture-engine/render` imports simulation only.
- `@aperture-engine/runtime` imports simulation and render only.
- `@aperture-engine/core` does not import or export WebGPU.
- `@aperture-engine/webgpu` does not import runtime or core.
- WebGPU examples import `@aperture-engine/core` and
  `@aperture-engine/webgpu` explicitly.

## Files Touched

Package/workspace structure:

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `tsconfig.base.json`
- `tsconfig.json`
- `tsconfig.test.json`
- `packages/*/package.json`
- `packages/*/tsconfig.json`
- `packages/*/src/**`

Docs/bookkeeping:

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MVP_3D_CONCEPTS.md`
- `docs/NORTH_STAR.md`
- `docs/ROADMAP.md`
- `docs/UNLIT_TEXTURED_MATERIAL_PLAN.md`
- `docs/PNPM_MONOREPO_REFACTOR_PLAN.md`
- `docs/research/BEVY_ECS_RENDER_ALIGNMENT.md`
- `docs/research/MATERIAL_TEXTURE_RENDER_STATE_COVERAGE.md`
- `docs/research/MESH_GEOMETRY_COVERAGE.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

Examples/scripts/config:

- `examples/*.html`
- `examples/main.js`
- `examples/triangle.js`
- `examples/multi-entity.js`
- `examples/spinning-cube.js`
- `scripts/serve-examples.mjs`
- `playwright.config.ts`
- `eslint.config.js`
- `vitest.config.ts`

Tests:

- Updated package imports across unit tests.
- Updated render authoring/extraction tests for `Mesh` plus `Material`.
- Added `test/runtime/runtime.test.ts`.
- Updated browser E2E expected backend identity to `webgpu-explicit`.

## Validation Run

Passed:

- `pnpm install`
- `pnpm run check`
  - build/typecheck
  - test typecheck
  - example syntax checks
  - ESLint
  - Prettier check
  - Vitest: 139 files, 643 tests
- `pnpm run test:e2e -- spinning-cube.spec.ts primitive-routing.spec.ts --reporter=line`
  - 7 browser tests passed.
- `pnpm exec playwright test --reporter=line`
  - 139 browser tests passed.

One attempted command was invalid:

- `pnpm run test:e2e -- --reporter=line` passed an extra `--` through to
  Playwright and produced "No tests found"; reran as
  `pnpm exec playwright test --reporter=line`, which passed.

## Known Issues

- No known validation failures.
- Typed asset collections are still not implemented; callers still use
  `AssetRegistry` directly.
- Render asset preparation is still spread across render/WebGPU helpers and
  examples rather than a formal renderer-independent adapter contract.
- Runtime does not yet provide a `createWebGpuApp` facade; WebGPU examples still
  contain backend setup code.
- PBR remains blocked on typed assets, material-family contracts, and render
  asset preparation.

## Recommended Next Task

Start with `task-0540 — Add typed asset collection API over AssetRegistry`.
That is the next Bevy-aligned bridge gap before deeper material/PBR work.
