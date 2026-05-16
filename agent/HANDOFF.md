# Handoff

## Current Status

Completed this run:

- `task-0302` through `task-0339`

The next recommended task is `task-0340 — Add no-raw-GPU assertion helper for texture failures`.

## Run Summary

Major changes:

- Added shared-sampler and shared-texture browser asset-failure scenarios for missing texture assets, missing sampler assets, and the shared-texture combined missing texture/sampler asset case.
- Added Playwright coverage for those scenarios, including stable code/asset-key diagnostics, duplicated per-renderable diagnostics for shared dependencies, route/status guard specs, and no-submission assertions.
- Added shared route assertion coverage in `test/e2e/texture-asset-routing.ts`.
- Added shared texture/sampler status typing for missing shared asset metadata.
- Expanded render extraction unit coverage for two renderables sharing texture/sampler dependencies across missing, loading, and failed asset states.
- Added extraction diagnostic helpers and report count assertions for blocked dependency snapshots.
- Added `diagnosticCounts` to extraction-failure browser statuses and zeroed counts to unknown-scenario statuses.
- Added `diagnosticCounts` to resource-binding failure browser statuses, with missing mesh/material resource coverage asserting binding and readiness diagnostic buckets.
- Added non-texture extraction-failure diagnostic count assertions for missing mesh asset, missing material asset, layer mismatch, and disabled renderable scenarios.
- Updated browser and render-readiness docs for shared dependency diagnostics, route guards, and texture-before-sampler diagnostic order.

Architecture boundaries remain intact:

- ECS still owns authoring state and asset handles.
- Renderer-owned GPU resources remain outside ECS and JSON status payloads.
- Render extraction remains the asset-dependency boundary.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Browser/docs/tests:

- `examples/multi-entity.js`
- `docs/BROWSER_E2E_RENDERING.md`
- `docs/RENDER_FRAME_READINESS.md`
- `test/e2e/disabled-renderable.spec.ts`
- `test/e2e/example-status-types.ts`
- `test/e2e/layer-mismatch.spec.ts`
- `test/e2e/missing-material-asset.spec.ts`
- `test/e2e/missing-mesh-asset.spec.ts`
- `test/e2e/missing-mesh-resource.spec.ts`
- `test/e2e/missing-resource.spec.ts`
- `test/e2e/multi-textured-unlit.spec.ts`
- `test/e2e/shared-sampler-asset-routing.spec.ts`
- `test/e2e/shared-texture-asset-routing.spec.ts`
- `test/e2e/texture-asset-routing.ts`
- `test/e2e/unknown-scenario.spec.ts`
- `test/rendering/extraction.test.ts`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- `npm run build`
- `npm run typecheck:test`
- `npm run check:examples`
- `npx playwright test test/e2e/multi-textured-unlit.spec.ts -g "missing texture asset with a shared sampler"`
- `npx playwright test test/e2e/unknown-scenario.spec.ts`
- `npx playwright test test/e2e/multi-textured-unlit.spec.ts`
- `npx playwright test test/e2e/shared-texture-asset-routing.spec.ts`
- `npx playwright test test/e2e/shared-sampler-asset-routing.spec.ts`
- `npx playwright test test/e2e/shared-sampler-asset-routing.spec.ts test/e2e/shared-texture-asset-routing.spec.ts`
- `npm run check`
- `npm run test:e2e`

Latest broad validation:

- `npm run check` passes: 128 Vitest files, 559 tests.
- `npm run test:e2e` passes: 71 Playwright tests.

## Known Issues

- No known validation failures.
- `examples/multi-entity.js` still has a noisy diff because new scenario branches landed in the existing nested ternary. `task-0341` is queued to replace that dispatch with an explicit lookup table.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0302` through `task-0339`

Ready backlog now contains:

- `task-0340 — Add no-raw-GPU assertion helper for texture failures`
- `task-0341 — Split multi-entity scenario dispatch into a lookup table`
- `task-0342 — Document browser diagnostic count phases`
- `task-0343 — Add route guard coverage for resource-binding scenarios`
- `task-0344 — Add diagnostic count assertions for asset-state failures`

## Recommended Next Task

Start with `task-0340`. Keep it narrow: add a shared no-raw-GPU status assertion helper and use it in texture/sampler asset and resource failure specs.
