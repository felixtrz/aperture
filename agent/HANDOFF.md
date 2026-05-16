# Handoff

## Current Status

Completed this run:

- `task-0380` through `task-0419`

The next recommended task is `task-0420 — Use failure helper in resource route specs`.

## Run Summary

Major changes:

- Added lightweight route smoke specs for extraction failures, texture/sampler asset failures, texture/sampler GPU resource failures, and unknown-scenario dispatch.
- Added shared e2e helpers in `test/e2e/webgpu-status.ts`:
  - `loadExampleStatus`
  - `loadMultiEntityScenarioStatus`
  - `expectMultiEntityRouteFailureStatus`
- Migrated multi-entity, clear, triangle, primitive, camera, visibility, ordering, depth, texture, resource, upload, and readback diagnostic specs to shared loaders where practical.
- Kept the explicit unsupported-WebGPU spec on lower-level wait/attach helpers because the generic loader intentionally skips unsupported environments.
- Added no-browser static guards for helper-call scenario registration, direct multi-entity navigation regressions, and route smoke helper usage.
- Expanded `docs/BROWSER_E2E_RENDERING.md` with route guard coverage, helper conventions, detailed-spec reuse guidance, unsupported-WebGPU exception notes, and static guard behavior.

Architecture boundaries remain intact:

- ECS remains authoritative for authoring state and asset handles.
- Renderer-owned GPU resources stay outside ECS and JSON status payloads.
- Render extraction remains the asset-dependency boundary.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Docs/bookkeeping:

- `docs/BROWSER_E2E_RENDERING.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

E2E helpers/static tests:

- `test/e2e/webgpu-status.ts`
- `test/examples/multi-entity-scenarios.test.mjs`

New route smoke specs:

- `test/e2e/extraction-routing.spec.ts`
- `test/e2e/texture-dependency-routing.spec.ts`
- `test/e2e/texture-resource-routing.spec.ts`
- `test/e2e/scenario-routing.spec.ts`

Existing e2e specs migrated to shared loaders:

- Multiple `test/e2e/*.spec.ts` files covering clear, triangle, multi-entity, primitives, cameras, visibility/order/depth, texture success, texture/resource failures, asset status, route guards, and readback diagnostics.

## Validation Run

Passed:

- Targeted Vitest: `npm test -- test/examples/multi-entity-scenarios.test.mjs`
- Consolidated route suite: `npm run test:e2e -- extraction-routing.spec.ts texture-dependency-routing.spec.ts texture-resource-routing.spec.ts primitive-routing.spec.ts camera-routing.spec.ts visibility-routing.spec.ts texture-routing.spec.ts resource-binding-routing.spec.ts texture-upload-routing.spec.ts shared-texture-asset-routing.spec.ts shared-sampler-asset-routing.spec.ts scenario-routing.spec.ts --reporter=line`
  - Playwright passed: 57 tests.
- Full browser e2e: `npm run test:e2e -- --reporter=line`
  - Playwright passed: 123 tests.
- Full standard check: `npm run check`
  - TypeScript, test typecheck, example syntax, ESLint, Prettier, and Vitest passed.
  - Vitest passed: 129 files, 563 tests.

## Known Issues

- No known validation failures.
- The diff is broad across e2e specs, but changes are mechanical loader/helper migrations and covered by full check plus full Playwright validation.
- Remaining direct wait/attach usage is intentional: helper internals, unsupported-WebGPU payload assertions, and secondary diagnostic artifact attachments.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0380` through `task-0419`

Ready backlog now contains:

- `task-0420 — Use failure helper in resource route specs`
- `task-0421 — Use failure helper in texture resource routes`
- `task-0422 — Use failure helper in scenario route guard`
- `task-0423 — Document failure helper route coverage`
- `task-0424 — Audit route helper docs and static guards`

## Recommended Next Task

Start with `task-0420`. Keep it narrow: migrate resource-binding and texture-upload route guards to `expectMultiEntityRouteFailureStatus`, preserve their diagnostic-code assertions, and run targeted typecheck plus route Playwright coverage.
