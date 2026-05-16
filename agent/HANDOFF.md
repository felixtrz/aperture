# Handoff

## Current Status

Completed this run:

- `task-0340` through `task-0379`

The next recommended task is `task-0380 — Add route smoke for extraction failure scenarios`.

## Run Summary

Major changes:

- Added shared browser e2e helpers:
  - `expectStatusJsonSafeForGpu`
  - `expectNoDrawSubmissionStatus`
  - `expectedDiagnosticCounts`
- Replaced repeated raw-GPU JSON-safety checks across texture/sampler asset, resource, route, and upload failure specs.
- Added and normalized `diagnosticCounts` assertions across extraction, texture/sampler resource, texture upload, asset-state, route guard, success texture/material, primitive, camera, visibility, ordering, and depth browser specs.
- Replaced the deep multi-entity scenario ternary with an explicit `scenarioRenderers` lookup table.
- Split ordered scenario ids into `knownScenarioIds`, derived `knownScenarios`, and expanded the no-browser Vitest guard so literal e2e route URLs and fixture scenarios must stay registered.
- Added lightweight Playwright route guards for resource-binding failures, invalid texture upload failures, primitive success routes, camera success routes, visibility/order/depth success routes, and texture/sampler success routes.
- Documented diagnostic count phase semantics, shared e2e helper conventions, the static scenario route guard, and the new route smoke guard families.

Architecture boundaries remain intact:

- ECS remains authoritative for authoring state and asset handles.
- Renderer-owned GPU resources stay outside ECS and JSON status payloads.
- Render extraction remains the asset-dependency boundary.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Browser example/docs:

- `examples/multi-entity.js`
- `docs/BROWSER_E2E_RENDERING.md`

E2E/helpers/tests:

- `test/e2e/webgpu-status.ts`
- `test/e2e/resource-binding-routing.spec.ts`
- `test/e2e/texture-upload-routing.spec.ts`
- `test/e2e/primitive-routing.spec.ts`
- `test/e2e/camera-routing.spec.ts`
- `test/e2e/visibility-routing.spec.ts`
- `test/e2e/texture-routing.spec.ts`
- `test/e2e/texture-asset-routing.ts`
- `test/examples/multi-entity-scenarios.test.mjs`
- Multiple existing `test/e2e/*.spec.ts` files updated to use shared helpers and assert diagnostic counts.

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- `npm run check`
  - TypeScript typecheck passed.
  - Test typecheck passed.
  - Example syntax check passed.
  - ESLint passed.
  - Prettier format check passed.
  - Vitest passed: 129 files, 561 tests.
- `npm run test:e2e`
  - Playwright passed: 96 tests.

## Known Issues

- No known validation failures.
- Browser helper cleanup touched many e2e specs, but the changes are mechanical and covered by full check/e2e validation.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0340` through `task-0379`

Ready backlog now contains:

- `task-0380 — Add route smoke for extraction failure scenarios`
- `task-0381 — Add route smoke for texture asset failure scenarios`
- `task-0382 — Extract shared multi-entity route loader helper`
- `task-0383 — Add route smoke coverage table to docs`
- `task-0384 — Add route smoke status attachments`

## Recommended Next Task

Start with `task-0380`. Keep it narrow: add a lightweight route/status Playwright loop for extraction-failure scenarios, use the shared no-submit/count helpers, and avoid duplicating detailed diagnostic body assertions from the existing focused specs.
