# Handoff

## Current Status

Completed this run:

- `task-0465` through `task-0494`

The next recommended task is `task-0495 — Add light GPU buffer resource JSON helper`.

## Run Summary

Major changes:

- Added optional ECS environment-map handle authoring for environment lights.
- Added extraction validation for ready, missing, loading, failed, and malformed
  environment-map handles, with diagnostics that preserve stable asset keys.
- Added browser lighting routes for ready/missing/loading/failed/malformed
  environment-map scenarios and status fields for extracted and diagnostic
  environment-map keys.
- Added snapshot inspection and cloneability coverage for environment-map
  handles.
- Added renderer-side light packet packing, light buffer descriptors, WebGPU
  descriptor plans, and injected light GPU buffer resource creation for separate
  float and metadata buffers.
- Added environment resource planning, snapshot lighting resource plans, JSON
  helpers, browser lighting-resource status, and resource-summary inputs for
  planned light buffers, created light GPU buffers, and environment-map
  requirements.
- Updated docs for the environment-map and light GPU buffer boundaries.

Architecture boundaries remain intact:

- ECS remains authoritative for authoring state and asset handles.
- Rendering reads flat render snapshot packets derived from ECS state.
- Light GPU buffers are renderer-owned resources created from descriptor plans
  with injected WebGPU devices.
- JSON/debug summaries expose stable keys, counts, and diagnostics without raw
  GPU handles.
- No scene graph, renderer-owned gameplay state, large dependency, WebGL
  fallback, shader lighting path, skybox/IBL path, or shadow renderer was
  introduced.

## Files Touched This Run

Docs/bookkeeping:

- `docs/ARCHITECTURE.md`
- `docs/BROWSER_E2E_RENDERING.md`
- `docs/RENDER_FRAME_READINESS.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

Runtime/example code:

- `examples/multi-entity.js`
- `src/rendering/authoring.ts`
- `src/rendering/extraction.ts`
- `src/rendering/snapshot-inspection.ts`
- `src/webgpu/environment-resource-planning.ts`
- `src/webgpu/index.ts`
- `src/webgpu/light-packing.ts`
- `src/webgpu/lighting-resource-plan.ts`
- `src/webgpu/resource-summary.ts`

Tests and e2e helpers:

- `test/e2e/example-status-types.ts`
- `test/e2e/lighting-routing.spec.ts`
- `test/rendering/components.test.ts`
- `test/rendering/extraction.test.ts`
- `test/rendering/snapshot-clone.test.ts`
- `test/rendering/snapshot-inspection.test.ts`
- `test/webgpu/environment-resource-planning.test.ts`
- `test/webgpu/frame-report-json.test.ts`
- `test/webgpu/frame-report.test.ts`
- `test/webgpu/light-packing.test.ts`
- `test/webgpu/lighting-resource-plan.test.ts`
- `test/webgpu/renderer-assembly-diagnostics.test.ts`
- `test/webgpu/renderer-assembly-json.test.ts`
- `test/webgpu/renderer-assembly-smoke.test.ts`
- `test/webgpu/resource-summary-json.test.ts`
- `test/webgpu/resource-summary-merge.test.ts`
- `test/webgpu/resource-summary.test.ts`
- `test/webgpu/runner-handle-boundary.test.ts`

## Validation Run

Passed:

- `npm run check`
  - TypeScript, test typecheck, example syntax, ESLint, Prettier, and Vitest
    passed.
  - Vitest passed: 132 files, 586 tests.
- `npm run test:e2e -- lighting-routing.spec.ts --reporter=line`
  - Playwright passed: 15 tests.
- `npm test -- test/rendering/components.test.ts`
- `npm test -- test/rendering/extraction.test.ts`
- `npm test -- test/rendering/snapshot-clone.test.ts`
- `npm test -- test/rendering/snapshot-inspection.test.ts`
- `npm test -- test/webgpu/light-packing.test.ts`
- `npm test -- test/webgpu/resource-summary.test.ts test/webgpu/resource-summary-json.test.ts test/webgpu/resource-summary-merge.test.ts`
- `npm test -- test/webgpu/light-packing.test.ts test/webgpu/resource-summary.test.ts test/webgpu/resource-summary-json.test.ts test/webgpu/resource-summary-merge.test.ts`
- `npm run typecheck`
- `npm run typecheck:test`
- `npm run format:check`

The stop hook still needs to run after this handoff is finalized.

## Known Issues

- No known validation failures.
- Browser light/environment routes prove extraction and JSON-safe status only;
  the WebGPU shader path remains unlit.
- Light GPU buffers can now be created with injected devices, but bind groups,
  shader consumption, skybox/IBL, and shadows remain deferred.
- Environment resource planning currently produces stable requirements only; no
  environment texture binding or skybox resource creation exists yet.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0465` through `task-0494`

Ready backlog now contains:

- `task-0495 — Add light GPU buffer resource JSON helper`
- `task-0496 — Add snapshot light GPU buffer creation adapter`
- `task-0497 — Cover light GPU buffers in renderer assembly JSON`
- `task-0498 — Document snapshot light GPU buffer creation`
- `task-0499 — Run consolidated light GPU buffer validation`

## Recommended Next Task

Start with `task-0495`. Keep it narrow: serialize light GPU buffer resource
results with stable keys/counts/diagnostics, omit raw buffers, and cover success
plus failure diagnostics in focused tests.
