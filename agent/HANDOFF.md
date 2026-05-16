# Handoff

## Current Status

Completed implementation for:

- `task-0170 — Render multi-entity simple scene in browser`
- `task-0173 — Add multi-material unlit resource helper`

Stopped on an explicit validation-failed condition: `npm run test:e2e` now reaches the browser pages, but screenshot pixel assertions still sample the canvas CSS background instead of WebGPU-presented pixels.

The next recommended task is `task-0175 — Stabilize browser WebGPU pixel verification baseline`.

## Run Summary

Major changes:

- Added `examples/multi-entity.html` and `examples/multi-entity.js`.
- The multi-entity example authors two ECS mesh entities with distinct transforms and unlit materials, extracts two draw packets, applies them to `RenderWorld`, uploads GPU resources, plans two draw packages/commands, and publishes frame status.
- Added `createMultiMaterialUnlitFrameGpuResources` for one shared mesh/view/world-transform resource set plus per-material uniform buffers and group-2 bind groups.
- Updated render pass command planning so `transformPackedOffset` maps to draw `firstInstance`, letting the unlit shader read the correct transform for each draw.
- Fixed WebGPU buffer uploads to pass underlying buffers with byte offsets and pad unaligned writes to 4-byte alignment, which fixed the browser `writeBuffer` exceptions for indexed triangle data.
- Fixed root example asset URLs and made browser examples wait for `queue.onSubmittedWorkDone()` before publishing ready status when available.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering is still derived from `RenderSnapshot` and `RenderWorld`.
- GPU resources remain in WebGPU helpers.
- No scene graph, renderer-owned gameplay state, or WebGL fallback was introduced.

## Files Touched This Run

Source:

- `src/webgpu/buffer.ts`
- `src/webgpu/render-pass-commands.ts`
- `src/webgpu/unlit-frame-resources.ts`

Examples and docs:

- `examples/index.html`
- `examples/main.js`
- `examples/triangle.js`
- `examples/multi-entity.html`
- `examples/multi-entity.js`
- `README.md`

Tests:

- `test/webgpu/buffer.test.ts`
- `test/webgpu/render-pass-commands.test.ts`
- `test/webgpu/unlit-frame-resources.test.ts`

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
- `node --check examples/multi-entity.js`

Failed:

- `npm run test:e2e`

E2E details:

- The local server now binds and both pages publish ready status.
- The prior `writeBuffer` browser exceptions are fixed.
- `webgpu-clear.spec.ts` fails because the sampled canvas pixel matches the CSS canvas background, not the WebGPU clear color.
- `ecs-triangle.spec.ts` reaches successful frame status and records one draw call, but the sampled pixel still matches the CSS background closely enough that the non-background assertion fails.

## Known Issues

- Browser pixel presentation in headless Chromium is not reliable yet. The next run should determine whether this is a test timing/capture problem, a Chromium WebGPU launch/configuration issue, or an unsupported presentation path that should skip with diagnostics.
- Multi-entity status is implemented but does not yet have Playwright coverage.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0170`
- `task-0173`

Ready backlog now contains:

- `task-0175 — Stabilize browser WebGPU pixel verification baseline`
- `task-0171 — Add Playwright multi-entity scene verification`
- `task-0172 — Document browser E2E rendering workflow`
- `task-0174 — Add static example server tests`
- `task-0176 — Add multi-entity browser status smoke test`

## Recommended Next Task

Start with `task-0175`. Do not add more pixel-based scene assertions until the clear and triangle E2E baseline either passes with real WebGPU pixels or skips with a precise unsupported-presentation diagnostic.
