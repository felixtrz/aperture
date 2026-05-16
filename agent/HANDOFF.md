# Handoff

## Current Status

Completed this run:

- `task-0175 — Stabilize browser WebGPU pixel verification baseline`
- `task-0176 — Add multi-entity browser status smoke test`
- `task-0172 — Document browser E2E rendering workflow`
- `task-0174 — Add static example server tests`
- `task-0171 — Add Playwright multi-entity scene verification`

Also completed follow-up harness tasks `task-0177` through `task-0189`, plus `task-0192` through `task-0196` and `task-0201`, to share e2e helpers/types, harden the example server, expand no-TCP server coverage, lint JS harness files, add `check:examples`, add clear/triangle status-only e2e smoke tests, document status payloads, and add example navigation/structure coverage.

The next recommended task is `task-0190 — Prototype WebGPU current-texture readback for clear pixels`.

## Run Summary

Major changes:

- Added `docs/BROWSER_E2E_RENDERING.md` and linked it from `README.md`.
- Added shared Playwright helpers for example status waiting, unsupported WebGPU skips, status attachments, and canvas presentation sampling.
- Clear, triangle, and multi-entity pixel specs now skip with an explicit diagnostic when screenshots expose the canvas CSS background instead of WebGPU-presented pixels.
- Added status-only Playwright smoke tests for clear, triangle, and multi-entity examples so browser readiness is covered even when pixel capture is skipped.
- Added multi-entity pixel verification that checks red and blue regions when real presented pixels are capturable.
- Added shared test-side browser example status types.
- Added navigation links between browser examples plus static href/HTML structure coverage.
- Refactored `scripts/serve-examples.mjs` into importable path/MIME/request helpers without changing CLI behavior.
- Hardened the static server against allowed-root traversal and malformed percent-encoded paths.
- Added no-TCP server tests for path resolution, MIME types, GET/HEAD/redirect/404/400/405 responses, query strings, and exact import-map dependency paths.
- Added ESLint coverage for `.mjs` harness files and browser example modules.
- Added `npm run check:examples` and included it in `npm run check`.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering remains derived from render snapshots and render-world state.
- Browser status payloads are diagnostics, not source-of-truth state.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Source and harness:

- `scripts/serve-examples.mjs`
- `package.json`
- `eslint.config.js`
- `README.md`
- `docs/BROWSER_E2E_RENDERING.md`
- `examples/index.html`
- `examples/triangle.html`
- `examples/multi-entity.html`
- `examples/styles.css`

Tests:

- `test/e2e/basic-status.spec.ts`
- `test/e2e/example-status-types.ts`
- `test/e2e/ecs-multi-entity-pixels.spec.ts`
- `test/e2e/ecs-multi-entity-status.spec.ts`
- `test/e2e/ecs-triangle.spec.ts`
- `test/e2e/webgpu-clear.spec.ts`
- `test/e2e/webgpu-presentation.ts`
- `test/e2e/webgpu-status.ts`
- `test/examples/navigation.test.mjs`
- `test/scripts/serve-examples.test.mjs`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- `npm run build`
- `npm run check`
- `npm run test:e2e -- --reporter=line`

Current e2e result:

- 3 passed status tests.
- 3 skipped pixel tests.
- Pixel skips are expected in this headless Chromium environment because canvas screenshots sample the CSS canvas background instead of WebGPU-presented pixels.

Additional note:

- I tested browser-side `drawImage(canvas)` readback in an ad hoc Playwright run; it returned transparent pixels, so it is not a replacement for screenshot capture. The next realistic path is WebGPU texture/buffer readback.

## Known Issues

- Headless Chromium executes the WebGPU examples and publishes ready statuses, but screenshot capture still does not expose presented WebGPU pixels.
- Pixel tests are now safe and diagnostic, but they do not prove rendered colors in this environment until a GPU readback path or different browser capture path exists.
- `task-0190` should investigate current-texture copy/readback support without making ECS or render-world state depend on WebGPU handles.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0171`
- `task-0172`
- `task-0174`
- `task-0175`
- `task-0176`
- `task-0177` through `task-0189`
- `task-0192`
- `task-0193`
- `task-0194`
- `task-0195`
- `task-0196`
- `task-0201`

Ready backlog now contains:

- `task-0190 — Prototype WebGPU current-texture readback for clear pixels`
- `task-0191 — Use GPU readback in triangle and multi-entity pixel tests`
- `task-0202 — Add browser example import-map parsing helper`
- `task-0197 — Add unsupported WebGPU status smoke coverage`
- `task-0198 — Add example server invalid-port CLI smoke test`
- `task-0199 — Add import-map consistency checks`
- `task-0200 — Add browser e2e artifact guide`

## Recommended Next Task

Start with `task-0190`. Keep it narrow: prove whether WebGPU readback can provide deterministic clear-pixel evidence in browser tests, and report unsupported paths explicitly if the canvas/current texture cannot be copied.
