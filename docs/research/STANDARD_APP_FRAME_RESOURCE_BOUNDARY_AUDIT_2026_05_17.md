# Standard App Frame Resource Boundary Audit - 2026-05-17

## Scope

Audit the extracted StandardMaterial app frame-resource create/reuse helper.

This audit covers:

- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts` usage of the helper
- StandardMaterial app route/reuse behavior covered by focused WebGPU app tests

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/STANDARD_APP_FRAME_RESOURCE_REUSE_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/lighting-resource-plan.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift was found.

The extracted helper owns only StandardMaterial app frame-resource create/reuse
behavior, including the Standard-specific light-buffer reuse path:

- view uniform and world-transform descriptor planning;
- snapshot-derived light buffer descriptor planning;
- source key and prepared texture/sampler key comparisons;
- dynamic buffer writes for reused view, transform, light float, and light
  metadata buffers;
- Standard frame GPU resource creation on cache miss;
- caller-owned Standard cache slot updates;
- caller-owned reuse counter updates.

The helper receives all ownership-sensitive inputs explicitly:

- WebGPU-like device;
- Standard frame cache slot;
- render snapshot for light packing;
- source mesh/material inputs;
- prepared texture/sampler resources;
- packed view/transform data;
- shared, material, and light bind group layouts;
- reuse report object.

It does not import `WebGpuApp`, `AssetRegistry`, app resource caches, frame
scratch, route adapters, material queue planning, pipeline caches, pipeline
selection, render frame planning, command encoding/submission, canvas/context
setup, browser globals, or ECS APIs.

`app.ts` still owns:

- pipeline selection and layout lookup;
- app cache construction;
- queued route construction and route diagnostics;
- render frame planning;
- command boundary assembly and submission.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Inspect whether duplicated helper utilities (`sameStringList`,
  `writeBufferData`) should be extracted now or deferred until a broader
  hot-path allocation cleanup.
- Add focused cache-slot regression coverage if current app tests become too
  broad for frame-resource reuse maintenance.
