# Handoff

## Current Status

Completed this run:

- `task-0190 — Prototype WebGPU current-texture readback for clear pixels`
- `task-0191 — Use GPU readback in triangle and multi-entity pixel tests`
- `task-0202 — Add browser example import-map parsing helper`
- `task-0197 — Add unsupported WebGPU status smoke coverage`
- `task-0198 — Add example server invalid-port CLI smoke test`
- `task-0199 — Add import-map consistency checks`
- `task-0200 — Add browser e2e artifact guide`
- Follow-up hardening tasks `task-0203` through `task-0211`
- `task-0216 — Add readback diagnostics for command-copy failure modes`
- `task-0217 — Add browser artifact guide links from failure output docs`

The next recommended task is `task-0212 — Add built-in primitive geometry browser readback coverage`.

## Run Summary

Major changes:

- Added `clearWebGpuCanvasWithReadback` and `createReadbackCanvasTextureUsage` for JSON-safe current-texture pixel readback.
- `initializeWebGpu` now accepts optional canvas texture usage and reports `context-configure-failed` distinctly.
- The clear, triangle, and multi-entity browser examples opt into `COPY_SRC` when available and publish readback success or explicit diagnostics.
- Pixel e2e specs prefer GPU readback and keep screenshot/CSS-background fallback diagnostics.
- Added browser diagnostics for missing `navigator.gpu`, `GPUBufferUsage`, and `GPUMapMode`.
- Added shared browser readback and override helpers plus status-shape assertions.
- Added parsed import-map tests, import-map consistency checks, edge-case parser coverage, and static/server coverage for the shared browser helper module.
- Added readback helper tests for missing and throwing texture-copy support.
- Expanded `docs/BROWSER_E2E_RENDERING.md` with readback behavior and Playwright artifact/trace guidance.
- Linked the browser E2E artifact guide from `README.md` with artifact-focused link text.
- Added invalid-port CLI smoke coverage for the examples server.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering remains derived from snapshots/render-world state.
- GPU devices, textures, buffers, encoders, pipelines, and bind groups remain outside ECS/status payloads.
- Browser readback publishes copied pixel bytes and diagnostics only.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Source and examples:

- `src/webgpu/clear-readback.ts`
- `src/webgpu/index.ts`
- `examples/main.js`
- `examples/triangle.js`
- `examples/multi-entity.js`
- `examples/webgpu-readback.js`
- `package.json`

Docs:

- `docs/BROWSER_E2E_RENDERING.md`
- `README.md`

Tests:

- `test/webgpu/clear-readback.test.ts`
- `test/webgpu/index.test.ts`
- `test/e2e/basic-status.spec.ts`
- `test/e2e/browser-overrides.ts`
- `test/e2e/ecs-multi-entity-pixels.spec.ts`
- `test/e2e/ecs-multi-entity-status.spec.ts`
- `test/e2e/ecs-triangle.spec.ts`
- `test/e2e/example-status-types.ts`
- `test/e2e/readback-diagnostics.spec.ts`
- `test/e2e/readback-status.ts`
- `test/e2e/unsupported-webgpu.spec.ts`
- `test/e2e/webgpu-clear.spec.ts`
- `test/examples/import-map.mjs`
- `test/examples/navigation.test.mjs`
- `test/examples/webgpu-readback.test.mjs`
- `test/scripts/serve-examples.test.mjs`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/CURRENT_TASK.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- `npm run check`
- `npm run test:e2e -- --reporter=line`

Current e2e result:

- 8 passed browser tests.
- Pixel verification now passes through GPU readback in this Chromium/WebGPU environment.
- Screenshot fallback diagnostics remain available for environments that cannot expose presented WebGPU pixels or cannot support readback.

## Known Issues

- Browser readback currently covers clear, triangle center, and multi-entity red/blue sample regions only.
- The example readback helper is intentionally browser/test scoped; broader renderer APIs should wait for the next geometry/material verification slices.
- Headless screenshot capture may still sample CSS background in some environments, but pixel tests now prefer GPU readback first.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0190`
- `task-0191`
- `task-0197`
- `task-0198`
- `task-0199`
- `task-0200`
- `task-0202`
- `task-0203` through `task-0211`
- `task-0216`
- `task-0217`

Ready backlog now contains:

- `task-0212 — Add built-in primitive geometry browser readback coverage`
- `task-0213 — Add unlit material variant browser readback coverage`
- `task-0214 — Add visibility and layer browser readback coverage`
- `task-0215 — Add missing-resource browser diagnostic smoke`

## Recommended Next Task

Start with `task-0212`. Keep it narrow: render at least one built-in primitive mesh through the existing ECS/render extraction/WebGPU path and verify non-clear pixels through readback without moving GPU resources into ECS.
