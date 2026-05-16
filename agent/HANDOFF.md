# Handoff

## Current Status

Completed this run:

- `task-0243 — Extend unlit bind group planning for base-color textures`
- `task-0244 — Add unlit texture shader feature and pipeline key`
- `task-0245 — Add extraction diagnostics for unlit texture asset states`
- `task-0246 — Add texture-backed unlit browser readback coverage`
- `task-0247 — Add texture and sampler resource summary counts`
- `task-0248 — Add browser texture dependency asset-status scenarios`
- `task-0249 — Add browser missing texture resource-binding diagnostics`
- `task-0250 — Add cylinder and cone browser primitive readback coverage`
- `task-0251 — Add capsule and torus browser primitive readback coverage`
- `task-0252 — Add render-frame textured draw planning unit coverage`
- `task-0253 — Add mixed unlit pipeline browser planning`

The next recommended task is `task-0254 — Add quadrant texture UV browser readback coverage`.

## Run Summary

Major changes:

- Unlit bind group planning now supports two group-2 variants:
  - factor-only: material uniform buffer at binding 0
  - textured: material uniform buffer at binding 0, base-color texture view at binding 1, sampler at binding 2
- Unlit frame GPU resource creation accepts optional texture and sampler GPU resources and reports JSON-safe missing texture/sampler resource diagnostics.
- Added a textured unlit WGSL shader variant and pipeline selection keyed by the `baseColorTexture` material feature.
- Render extraction validates unlit texture/sampler asset dependencies before emitting draw packets.
- Added `?scenario=textured-unlit` to the multi-entity browser example. It uploads a 2x2 texture, uses a nearest sampler, and verifies two UV-separated readback samples in Playwright.
- Added missing/loading/failed texture and sampler dependency scenarios that stop at extraction and report stable asset-key diagnostics.
- Added a browser missing texture/sampler GPU resource scenario that extracts a valid textured draw, withholds renderer-owned resources, and reports JSON-safe resource diagnostics.
- Render resource summaries now include optional texture/sampler resource counts and diagnostics.
- Added `?scenario=cylinder-primitive` and `?scenario=cone-primitive` to the multi-entity browser example, with status metadata and Playwright readback coverage for both primitives.
- Added `?scenario=capsule-primitive` and `?scenario=torus-primitive` to the multi-entity browser example, with status metadata and Playwright readback coverage for both primitives.
- Added unit coverage that proves textured unlit group-2 bind groups flow through render-frame planning, and that missing textured group-2 resources produce the existing JSON-safe diagnostic path.
- The multi-entity browser path now creates one unlit pipeline resource per distinct batch pipeline key.
- Multi-material unlit frame resource creation can use per-material layouts, and browser shared bind groups are scoped per pipeline layout so factor-only and texture-backed unlit draws can share one frame.
- Added `?scenario=mixed-unlit-pipelines` with status metadata for both pipeline keys and Playwright readback coverage for factor-only plus texture-backed pixels.

Architecture boundaries remain intact:

- ECS stores asset handles and material data only.
- Renderer-owned `GPUTexture`, `GPUTextureView`, and `GPUSampler` resources stay in the browser/WebGPU side.
- Snapshots remain JSON/structured-clone friendly and do not serialize raw GPU handles.
- No scene graph, renderer-owned gameplay state, large dependency, or WebGL fallback was introduced.

## Files Touched This Run

Core/rendering:

- `src/rendering/extraction.ts`
- `src/webgpu/resource-summary.ts`
- `src/webgpu/unlit-bind-group-layout.ts`
- `src/webgpu/unlit-bind-group.ts`
- `src/webgpu/unlit-frame-resources.ts`
- `src/webgpu/render-pass-draw-list.ts`
- `src/webgpu/unlit-pipeline-descriptor.ts`
- `src/webgpu/unlit-pipeline.ts`
- `src/webgpu/unlit-shader.ts`

Browser/docs/tests:

- `examples/multi-entity.js`
- `docs/BROWSER_E2E_RENDERING.md`
- `test/e2e/example-status-types.ts`
- `test/e2e/textured-unlit.spec.ts`
- `test/e2e/texture-dependency-asset-status.spec.ts`
- `test/e2e/missing-texture-resource.spec.ts`
- `test/e2e/cylinder-cone-primitive.spec.ts`
- `test/e2e/capsule-torus-primitive.spec.ts`
- `test/e2e/mixed-unlit-pipelines.spec.ts`
- `test/webgpu/render-frame-plan.test.ts`
- `test/webgpu/render-pass-draw-list.test.ts`
- `test/materials/materials.test.ts`
- `test/rendering/extraction.test.ts`
- `test/webgpu/frame-report-json.test.ts`
- `test/webgpu/frame-report.test.ts`
- `test/webgpu/renderer-assembly-diagnostics.test.ts`
- `test/webgpu/renderer-assembly-json.test.ts`
- `test/webgpu/renderer-assembly-smoke.test.ts`
- `test/webgpu/resource-summary-merge.test.ts`
- `test/webgpu/resource-summary.test.ts`
- `test/webgpu/runner-handle-boundary.test.ts`
- `test/webgpu/unlit-bind-group-layout.test.ts`
- `test/webgpu/unlit-bind-group.test.ts`
- `test/webgpu/unlit-frame-resources.test.ts`
- `test/webgpu/unlit-pipeline-descriptor.test.ts`
- `test/webgpu/unlit-pipeline.test.ts`
- `test/webgpu/unlit-shader.test.ts`

Bookkeeping:

- `agent/BACKLOG.md`
- `agent/COMPLETED.md`
- `agent/HANDOFF.md`
- `agent/STATUS.json`

## Validation Run

Passed:

- Focused Vitest coverage for bind groups, unlit frame resources, shaders, pipeline descriptors, render extraction, and resource summaries
- `npm run build`
- `npm run typecheck:test`
- `npm run check:examples`
- Targeted Playwright: `npm run test:e2e -- test/e2e/textured-unlit.spec.ts --reporter=line`
- Targeted Playwright: `npm run test:e2e -- test/e2e/texture-dependency-asset-status.spec.ts --reporter=line`
- Targeted Playwright: `npm run test:e2e -- test/e2e/missing-texture-resource.spec.ts --reporter=line`
- Targeted Playwright: `npm run test:e2e -- test/e2e/cylinder-cone-primitive.spec.ts --reporter=line`
- Targeted Playwright: `npm run test:e2e -- test/e2e/box-primitive.spec.ts test/e2e/sphere-primitive.spec.ts --reporter=line`
- Targeted Playwright: `npm run test:e2e -- test/e2e/capsule-torus-primitive.spec.ts --reporter=line`
- Targeted Playwright: `npm run test:e2e -- test/e2e/box-primitive.spec.ts test/e2e/sphere-primitive.spec.ts test/e2e/cylinder-cone-primitive.spec.ts test/e2e/capsule-torus-primitive.spec.ts --reporter=line`
- Targeted Vitest: `npx vitest run test/webgpu/render-frame-plan.test.ts`
- Targeted Vitest: `npx vitest run test/webgpu/render-pass-draw-list.test.ts test/webgpu/unlit-frame-resources.test.ts`
- Targeted Playwright: `npm run test:e2e -- test/e2e/mixed-unlit-pipelines.spec.ts --reporter=line`
- Full `npm run check`

Current broad check result:

- `npm run check` passes.
- Vitest: 127 files, 530 tests passed.

## Known Issues

- Texture-backed unlit rendering and texture/sampler asset-status browser scenarios now work.
- Mixed factor-only/textured unlit browser rendering now works with distinct pipeline keys.
- Primitive browser coverage now includes box, sphere, cylinder, cone, capsule, and torus.

## Backlog

Completed tasks appended to `agent/COMPLETED.md`:

- `task-0243`
- `task-0244`
- `task-0245`
- `task-0246`
- `task-0247`
- `task-0248`
- `task-0249`
- `task-0250`
- `task-0251`
- `task-0252`
- `task-0253`

Ready backlog now contains:

- `task-0254 — Add quadrant texture UV browser readback coverage`
- `task-0255 — Add multi-pipeline render-frame planning unit coverage`
- `task-0256 — Add sampler filter and address browser readback coverage`
- `task-0257 — Add texture upload row-stride diagnostics coverage`
- `task-0258 — Add textured unlit tint browser coverage`

## Recommended Next Task

Start with `task-0254`. Keep it narrow: expand the texture-backed unlit browser fixture to sample all four 2x2 quadrants and verify U/V orientation through readback.
