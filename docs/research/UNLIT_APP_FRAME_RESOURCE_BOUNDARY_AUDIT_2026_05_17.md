# Unlit App Frame Resource Boundary Audit - 2026-05-17

## Scope

Audit the extracted unlit app frame-resource create/reuse helper.

This audit covers:

- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts` usage of the helper
- focused WebGPU app resource reuse tests

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/FRAME_RESOURCE_REUSE_HELPER_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift was found.

The extracted helper owns only unlit app frame-resource create/reuse behavior:

- view uniform and world-transform descriptor planning;
- source key and prepared texture/sampler key comparisons;
- dynamic buffer writes for reused view and transform buffers;
- unlit frame GPU resource creation on cache miss;
- caller-owned unlit cache slot updates;
- caller-owned reuse counter updates.

The helper receives all ownership-sensitive inputs explicitly:

- WebGPU-like device;
- unlit frame cache slot;
- source mesh/material inputs;
- prepared texture/sampler resources;
- packed view/transform data;
- shared bind group layouts;
- reuse report object.

It does not import `WebGpuApp`, `AssetRegistry`, `RenderSnapshot`, pipeline
caches, pipeline selection, render frame planning, route diagnostics, command
encoding/submission, canvas/context setup, browser globals, or ECS APIs.

`app.ts` still owns:

- pipeline selection and layout lookup;
- app cache construction;
- queued route construction;
- render frame planning;
- command boundary assembly and submission.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Extract Matcap frame-resource reuse using the same explicit input pattern.
- Keep StandardMaterial extraction separate because it also owns snapshot-derived
  light buffer reuse and light buffer dynamic writes.
