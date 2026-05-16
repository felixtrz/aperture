# Handoff

## Current Status

Completed this run:

- `task-0212 — Add built-in primitive geometry browser readback coverage`
- `task-0213 — Add unlit material variant browser readback coverage`
- `task-0214 — Add visibility and layer browser readback coverage`
- `task-0215 — Add missing-resource browser diagnostic smoke`
- Refill task `task-0218 — Add layer-mismatch browser diagnostic scenario`
- Refill task `task-0219 — Add missing ECS mesh asset browser diagnostic scenario`
- `task-0220 — Add box primitive browser readback coverage`
- `task-0221 — Add orthographic camera browser readback coverage`
- `task-0222 — Add render-order overlap browser coverage`
- `task-0223 — Add missing mesh resource-binding smoke`
- `task-0224 — Add missing ECS material asset smoke`
- Refill task `task-0225 — Add unknown browser scenario diagnostic`
- Refill task `task-0226 — Add loading and failed mesh asset browser diagnostics`
- Refill task `task-0227 — Add loading and failed material asset browser diagnostics`
- `task-0232 — Add disabled renderable browser diagnostic scenario`

The next recommended task is `task-0228 — Preserve render sort order through draw planning`.

## Run Summary

Major changes:

- The multi-entity browser example now uses Aperture's built-in `createPlaneMeshAsset` instead of inline triangle vertex data.
- The visible browser scene now renders three primitive planes with red, green, and blue unlit materials and samples nine current-texture readback points.
- The same scene authors a fourth hidden magenta renderable; extraction reports `render.invisible`, draw submission stays at three visible entities, and readback verifies magenta is absent.
- Added query-mode browser diagnostics on `/examples/multi-entity.html`:
  - `?scenario=missing-resource` withholds a renderer-side material resource binding after successful extraction.
  - `?scenario=missing-mesh-resource` withholds a renderer-side mesh resource binding after successful extraction.
  - `?scenario=layer-mismatch` authors a renderable outside the camera layer mask.
  - `?scenario=missing-mesh-asset` authors a renderable with an unavailable mesh asset handle.
  - `?scenario=missing-material-asset` authors a renderable with an unavailable material asset handle.
  - `?scenario=loading-mesh-asset` / `?scenario=failed-mesh-asset` verify mesh asset registry states.
  - `?scenario=loading-material-asset` / `?scenario=failed-material-asset` verify material asset registry states.
  - `?scenario=disabled-renderable` authors a ready renderable skipped by `Enabled.value = false`.
  - `?scenario=box-primitive` renders a built-in box primitive.
  - `?scenario=orthographic-camera` renders through an ECS-authored orthographic camera.
  - `?scenario=render-order-overlap` verifies overlapping primitive output with explicit `RenderOrder`.
  - Unknown scenarios now publish an explicit `unknown-scenario` zero-submission diagnostic.
- Status payloads now include JSON-safe geometry, camera, render-order, visibility, disabled, layer-filtering, asset-status, binding, render-world readiness, zero-submission, and diagnostic fields for these scenarios.
- Expanded `docs/BROWSER_E2E_RENDERING.md` to document primitive geometry, material variants, hidden renderables, resource-binding failures, layer mismatch, asset states, camera modes, render order, and unknown scenario payloads.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering remains derived from snapshots/render-world state.
- ECS components store handles/components only; WebGPU devices, buffers, textures, pipelines, bind groups, and command encoders remain outside ECS and status payloads.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Examples:

- `examples/multi-entity.js`

Docs:

- `docs/BROWSER_E2E_RENDERING.md`

Tests:

- `test/e2e/ecs-multi-entity-pixels.spec.ts`
- `test/e2e/ecs-multi-entity-status.spec.ts`
- `test/e2e/example-status-types.ts`
- `test/e2e/layer-mismatch.spec.ts`
- `test/e2e/missing-mesh-asset.spec.ts`
- `test/e2e/missing-resource.spec.ts`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/CURRENT_TASK.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- `npm run build`
- `npm run check`
- `npm run test:e2e -- --reporter=line`

Current e2e result:

- 23 passed browser tests.
- Multi-entity pixel verification passes through GPU readback for red, green, and blue visible primitive planes.
- Diagnostic scenarios assert zero draw submission for missing renderer resource bindings, layer mismatch, disabled renderables, missing/loading/failed ECS assets, and unknown scenarios.

## Known Issues

- Built-in browser primitive readback currently covers plane and box primitives only.
- Render-order overlap coverage currently aligns explicit `RenderOrder` with entity creation/render id order; `task-0228` should lock or fix sort-order preservation through lower-level draw planning.
- The multi-entity query scenarios intentionally reuse one browser page; consider refactoring repeated status builders before adding many more scenarios.
- Headless screenshot capture may still sample CSS background in some environments, but pixel tests prefer GPU readback first.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0212`
- `task-0213`
- `task-0214`
- `task-0215`
- `task-0218`
- `task-0219`
- `task-0220`
- `task-0221`
- `task-0222`
- `task-0223`
- `task-0224`
- `task-0225`
- `task-0226`
- `task-0227`
- `task-0232`

Ready backlog now contains:

- `task-0228 — Preserve render sort order through draw planning`
- `task-0229 — Refactor browser diagnostic scenario status builders`
- `task-0230 — Add perspective camera FOV browser readback coverage`
- `task-0231 — Add mesh asset failed-diagnostic payload coverage`
- `task-0233 — Add render layer positive/negative browser scenario`
- `task-0234 — Add disabled renderable with visible peer browser coverage`

## Recommended Next Task

Start with `task-0228`. Keep it narrow: add unit coverage for a render sort order that differs from render id order, then preserve that order through draw command descriptors, draw-list records, and render pass command planning if the tests expose a gap.
