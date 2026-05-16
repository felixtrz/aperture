# Handoff

## Current Status

Completed `task-0163` through `task-0169`.

This run moved Aperture from report/planning-only WebGPU slices into browser-facing examples and real unlit GPU resource creation:

```text
ECS world
  -> RenderSnapshot
  -> RenderWorld resource bindings
  -> mesh/view/transform/material GPU buffers
  -> actual unlit bind groups
  -> real unlit WebGPU pipeline
  -> render pass commands
  -> browser example status + Playwright pixel checks
```

The next recommended task is `task-0170 — Render multi-entity simple scene in browser`. Consider `task-0173 — Add multi-material unlit resource helper` first if the multi-entity example starts getting too much ad hoc material upload code.

## Run Summary

Major changes:

- Added `examples/` browser harness, import maps for local `dist` plus ESM dependencies, and `scripts/serve-examples.mjs`.
- Added `examples:build` and `examples:serve` npm scripts.
- Added root WebGPU clear smoke example with JSON-safe `window.__APERTURE_EXAMPLE_STATUS__`.
- Added Playwright `webServer` config plus clear and ECS triangle E2E specs with screenshot pixel sampling.
- Added `vitest.config.ts` so Vitest excludes Playwright specs.
- Added real unlit WebGPU pipeline bridge in `src/webgpu/unlit-pipeline.ts`.
- Added world-transform storage buffers, actual-buffer bind group creation, and `createUnlitFrameGpuResources`.
- Added ECS-extracted triangle browser example at `/examples/triangle.html`.
- Updated README with browser example and E2E instructions.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering is still derived from `RenderSnapshot` and `RenderWorld`.
- Browser examples consume snapshots/resource plans; production WebGPU helpers do not query ECS directly.
- GPU buffers, pipelines, bind groups, and command submission remain WebGPU-only.
- No scene graph, renderer-owned gameplay state, or WebGL fallback was introduced.

## Files Touched This Run

Source:

- `src/webgpu/index.ts`
- `src/webgpu/mesh-buffer-descriptors.ts`
- `src/webgpu/resource-keys.ts`
- `src/webgpu/unlit-bind-group.ts`
- `src/webgpu/unlit-frame-resources.ts`
- `src/webgpu/unlit-pipeline.ts`
- `src/webgpu/world-transform-buffer.ts`

Examples and tooling:

- `examples/index.html`
- `examples/main.js`
- `examples/styles.css`
- `examples/triangle.html`
- `examples/triangle.js`
- `scripts/serve-examples.mjs`
- `playwright.config.ts`
- `vitest.config.ts`
- `eslint.config.js`
- `tsconfig.test.json`
- `package.json`
- `README.md`

Tests:

- `test/e2e/ecs-triangle.spec.ts`
- `test/e2e/png.ts`
- `test/e2e/webgpu-clear.spec.ts`
- `test/webgpu/unlit-bind-group.test.ts`
- `test/webgpu/unlit-frame-resources.test.ts`
- `test/webgpu/unlit-pipeline.test.ts`
- `test/webgpu/world-transform-buffer.test.ts`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- `npm run check`
- `npm run build`
- `node --check examples/main.js`
- `node --check examples/triangle.js`
- `node --check scripts/serve-examples.mjs`
- Targeted Vitest runs for unlit pipeline and GPU resource helpers

Blocked by sandbox:

- `npm run test:e2e` failed before tests could run because Playwright's configured web server cannot bind `127.0.0.1:4173` in this environment:
  `listen EPERM: operation not permitted 127.0.0.1:4173`.

The E2E specs and server wiring typecheck and lint, but browser pixel verification still needs to be run on a machine/session that allows a local listener.

## Known Issues

- Browser examples were not visually verified in this sandbox due the local listener restriction.
- `examples/triangle.js` currently supports one material resource path. The multi-entity scene will need either a small multi-material helper or careful manual creation of a second material buffer/group-2 bind group.
- The root clear E2E and triangle E2E specs are ready, but `npm run test:e2e` is expected to fail in this sandbox until local server binding is available.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0163` through `task-0169`

Ready backlog now contains:

- `task-0170 — Render multi-entity simple scene in browser`
- `task-0171 — Add Playwright multi-entity scene verification`
- `task-0172 — Document browser E2E rendering workflow`
- `task-0173 — Add multi-material unlit resource helper`
- `task-0174 — Add static example server tests`

## Recommended Next Task

Start with `task-0170`. If multi-material resource handling becomes noisy inside the example, do `task-0173` first and then return to `task-0170`.
