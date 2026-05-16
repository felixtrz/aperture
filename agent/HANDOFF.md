# Handoff

## Current Status

Completed this run:

- `task-0228 — Preserve render sort order through draw planning`
- `task-0229 — Refactor browser diagnostic scenario status builders`
- `task-0230 — Add perspective camera FOV browser readback coverage`
- `task-0231 — Add mesh asset failed-diagnostic payload coverage`
- `task-0233 — Add render layer positive/negative browser scenario`
- `task-0234 — Add disabled renderable with visible peer browser coverage`
- `task-0235 — Add sphere primitive mesh builder`
- `task-0236 — Add cylinder and cone primitive mesh builders`
- `task-0237 — Add capsule and torus primitive mesh builders`
- `task-0238 — Add browser primitive readback coverage for curved primitives`
- `task-0239 — Add depth-tested 3D overlap browser coverage`
- `task-0240 — Add a narrow render-frame orchestration helper`
- `task-0241 — Add initial texture-backed unlit material design task`
- `task-0242 — Add texture and sampler GPU resource helpers`

The next recommended task is `task-0243 — Extend unlit bind group planning for base-color textures`.

## Run Summary

Major changes:

- Render sort order is now preserved through draw command descriptors, draw-list records, render-pass resource resolution, and command planning. Tests now cover render order differing from render id order.
- The multi-entity browser example now uses shared status builders for extraction failures and resource-binding failures.
- Added browser scenarios and Playwright coverage for:
  - non-default perspective FOV camera
  - failed mesh/material registry diagnostic payloads
  - mixed render-layer filtering
  - disabled renderable with visible peer
  - sphere primitive rendering
  - depth-tested overlap with a depth attachment and depth-enabled unlit pipeline
- Added primitive mesh builders:
  - `createSphereMeshAsset`
  - `createCylinderMeshAsset`
  - `createConeMeshAsset`
  - `createCapsuleMeshAsset`
  - `createTorusMeshAsset`
- Added `planRenderFrameFromSnapshot`, a narrow helper that plans from an extracted snapshot and caller-owned render world through resource binding, draw packages, descriptors, draw-list/resource resolution, and render pass commands.
- Added `docs/UNLIT_TEXTURED_MATERIAL_PLAN.md` and follow-up tasks for the texture-backed unlit material path.
- Added renderer-owned texture/sampler GPU resource helpers with JSON-safe diagnostics for missing device support and creation/upload/view failures.

Architecture boundaries remain intact:

- ECS remains authoritative.
- Rendering remains derived from snapshots/render-world state.
- WebGPU resources remain renderer/browser-side only.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Core/rendering:

- `src/webgpu/draw-command.ts`
- `src/webgpu/render-pass-draw-list.ts`
- `src/webgpu/render-pass-resources.ts`
- `src/webgpu/render-pass-commands.ts`
- `src/webgpu/render-frame-plan.ts`
- `src/webgpu/texture-resources.ts`
- `src/webgpu/index.ts`

Mesh:

- `src/mesh/primitives.ts`
- `src/mesh/types.ts`

Examples/docs/tests:

- `examples/multi-entity.js`
- `docs/BROWSER_E2E_RENDERING.md`
- `docs/UNLIT_TEXTURED_MATERIAL_PLAN.md`
- `test/mesh/primitive.test.ts`
- `test/webgpu/render-frame-plan.test.ts`
- `test/webgpu/texture-resources.test.ts`
- Multiple draw-planning unit/fixture tests under `test/webgpu/`
- New Playwright specs:
  - `test/e2e/perspective-fov-camera.spec.ts`
  - `test/e2e/render-layer-filter.spec.ts`
  - `test/e2e/disabled-visible-peer.spec.ts`
  - `test/e2e/sphere-primitive.spec.ts`
  - `test/e2e/depth-overlap.spec.ts`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- Focused draw-planning Vitest coverage
- Focused primitive mesh Vitest coverage
- Focused render-frame helper Vitest coverage
- Focused texture/sampler GPU resource Vitest coverage
- Targeted Playwright specs for render order, diagnostics, perspective FOV, layer filtering, disabled peer, sphere primitive, and depth overlap
- `npm run build`
- `npm run check`

Current broad check result:

- `npm run check` passes.
- Vitest: 127 files, 512 tests passed.

## Known Issues

- Texture/sampler GPU helpers exist, but texture-backed unlit bind groups, shader sampling, extraction diagnostics, and browser readback are still pending.
- Curved primitive browser readback currently covers sphere only.
- Depth overlap coverage is in the browser example path; lower-level depth orchestration helpers can still be expanded later if needed.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0228`
- `task-0229`
- `task-0230`
- `task-0231`
- `task-0233`
- `task-0234`
- `task-0235`
- `task-0236`
- `task-0237`
- `task-0238`
- `task-0239`
- `task-0240`
- `task-0241`
- `task-0242`

Ready backlog now contains:

- `task-0243 — Extend unlit bind group planning for base-color textures`
- `task-0244 — Add unlit texture shader feature and pipeline key`
- `task-0245 — Add extraction diagnostics for unlit texture asset states`
- `task-0246 — Add texture-backed unlit browser readback coverage`
- `task-0247 — Add texture and sampler resource summary counts`

## Recommended Next Task

Start with `task-0243`. Keep it narrow: extend unlit bind group planning so factor-only materials keep the current group-2 layout while textured materials require material, texture-view, and sampler resource keys.
