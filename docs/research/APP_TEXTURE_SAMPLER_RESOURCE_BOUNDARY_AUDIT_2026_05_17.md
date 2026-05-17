# App Texture/Sampler Resource Boundary Audit - 2026-05-17

## Scope

Audit the extracted WebGPU app texture/sampler resource helper module.

This audit covers:

- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/app.ts` usage of the extracted helpers
- focused WebGPU app route tests

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_LOCAL_RESOURCE_ADAPTER_SPLIT_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift was found.

The extracted helper module owns only the app route's texture/sampler
preparation step:

- material-family texture binding inspection for Unlit, Matcap, and
  StandardMaterial;
- source texture/sampler readiness diagnostics;
- app texture/sampler cache lookups by source handle/version key;
- WebGPU texture/sampler resource creation through the existing WebGPU resource
  helpers;
- caller-owned reuse counter updates;
- JSON-safe prepared texture/sampler result types.

The module receives all ownership-sensitive dependencies explicitly:

- `AssetRegistry`;
- WebGPU-like `device`;
- texture/sampler cache maps;
- reuse report object.

It does not import `WebGpuApp`, frame-resource caches, `RenderSnapshot`,
pipeline layout helpers, bind group construction, render frame plans, command
encoding, command submission, canvas/context setup, or browser globals.

`app.ts` still owns:

- app lifecycle and WebGPU initialization;
- frame scratch and per-family frame-resource caches;
- route adapter composition;
- pipeline selection and layout lookup;
- frame resource creation/reuse;
- render frame planning;
- command boundary assembly and submission.

## Reference Pattern Fit

The split matches the local reference pattern of separating resource preparation
from queue/list routing without moving authoritative scene/app state into the
renderer helper. Aperture's version keeps the dependency shape explicit and
snapshot/app route driven rather than scene-node driven.

## Validation

- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/built-in-material-queue-adapter.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Plan frame-resource reuse helper extraction before moving
  `createOrReuse*AppFrameResources`, because those helpers own dynamic buffer
  writes, light buffer reuse, and per-family frame cache updates.
