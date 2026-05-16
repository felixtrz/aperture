# Handoff

## Current Status

Completed this run:

- `task-0420` through `task-0464`

The next recommended task is `task-0465 — Add environment map handle authoring`.

## Run Summary

Major changes:

- Migrated remaining shallow browser route failure specs to shared helper
  expectations and added a static guard that keeps shallow route specs on the
  approved helper path.
- Added light extraction browser scenarios for directional, ambient,
  environment, point, spot, missing-transform, and invalid-light authoring.
- Promoted environment authoring into `EnvironmentPacket` extraction, leaving
  `handle: null` until environment-map asset binding is implemented.
- Added renderer-independent ECS `LightShadowSettings` authoring, validation,
  and `ShadowRequestPacket` extraction for supported directional lights.
- Added browser shadow routes for supported directional requests, invalid
  shadow settings, and unsupported ambient shadow requests.
- Extended browser status payloads with light, environment, and shadow
  extraction summaries.
- Updated docs to keep lights, environments, and shadow settings ECS-owned while
  deferring shader lighting, environment texture binding, shadow maps, shadow
  passes, atlases, cameras, and GPU resources to renderer-owned work.

Architecture boundaries remain intact:

- ECS remains authoritative for authoring state and asset handles.
- Rendering reads flat render snapshot packets derived from ECS state.
- Renderer-owned GPU resources stay outside ECS and JSON status payloads.
- No scene graph, renderer-owned gameplay state, large dependency, WebGL
  fallback, shadow renderer, or lighting shader path was introduced.

## Files Touched This Run

Docs/bookkeeping:

- `docs/ARCHITECTURE.md`
- `docs/BROWSER_E2E_RENDERING.md`
- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

Runtime/example code:

- `src/rendering/authoring.ts`
- `src/rendering/extraction.ts`
- `examples/multi-entity.js`

Tests and e2e helpers:

- `test/rendering/components.test.ts`
- `test/rendering/extraction.test.ts`
- `test/examples/multi-entity-scenarios.test.mjs`
- `test/e2e/example-status-types.ts`
- `test/e2e/lighting-routing.spec.ts`
- `test/e2e/resource-binding-routing.spec.ts`
- `test/e2e/scenario-routing.spec.ts`
- `test/e2e/texture-asset-routing.ts`
- `test/e2e/texture-resource-routing.spec.ts`
- `test/e2e/texture-upload-routing.spec.ts`
- `test/e2e/webgpu-status.ts`

## Validation Run

Passed:

- `npm run typecheck`
- `npm run typecheck:test`
- `npm run check:examples`
- `npm run format:check`
- `npm test -- test/rendering/components.test.ts`
- `npm test -- test/rendering/extraction.test.ts`
- `npm test -- test/examples/multi-entity-scenarios.test.mjs`
- `npm run test:e2e -- lighting-routing.spec.ts --reporter=line`
  - Playwright passed: 10 tests.
- `npm run test:e2e -- test/e2e/*-routing.spec.ts --reporter=line`
  - Playwright passed: 67 tests.
- `npm run check`
  - TypeScript, test typecheck, example syntax, ESLint, Prettier, and Vitest
    passed.
  - Vitest passed: 129 files, 569 tests.

The stop hook still needs to run after the handoff is finalized.

## Known Issues

- No known validation failures.
- Current browser light/shadow routes prove extraction and JSON-safe status
  only; the WebGPU shader path remains unlit.
- `EnvironmentPacket.handle` is still `null` until environment-map handle
  authoring and asset dependency checks are added.
- `ShadowRequestPacket` extraction exists, but shadow map allocation, shadow
  passes, atlases, shadow cameras, and shader consumption remain deferred.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0420` through `task-0464`

Ready backlog now contains:

- `task-0465 — Add environment map handle authoring`
- `task-0466 — Validate environment map asset dependency`
- `task-0467 — Add browser route for environment map diagnostics`
- `task-0468 — Add browser route for environment map handle extraction`
- `task-0469 — Document environment map handle boundary`

## Recommended Next Task

Start with `task-0465`. Keep it narrow: add optional environment-map handle
authoring that flows into `EnvironmentPacket.handle`, cover it in core
extraction tests, and avoid adding GPU texture binding or shader consumption in
the same slice.
