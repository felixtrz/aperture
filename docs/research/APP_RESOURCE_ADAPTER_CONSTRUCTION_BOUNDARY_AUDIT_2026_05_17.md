# App Resource Adapter Construction Boundary Audit - 2026-05-17

## Scope

Audit the built-in app resource adapter construction shell.

This audit covers:

- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts` usage of the shell
- `test/webgpu/built-in-material-app-resource-adapter.test.ts`
- focused WebGPU app route tests

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_LOCAL_RESOURCE_ADAPTER_SPLIT_PLAN_2026_05_17.md`
- `docs/research/FRAME_RESOURCE_REUSE_HELPER_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift was found.

The construction shell composes:

- route-only built-in material adapters;
- caller-provided texture/sampler preparation callbacks;
- caller-provided frame-resource creation/reuse callbacks;
- fixed family bucket append behavior.

The shell does not import `WebGpuApp`, `AssetRegistry`, `RenderSnapshot`, app
resource caches, frame scratch, pipeline caches, pipeline layout helpers, render
frame plans, command encoding, command submission, canvas/context setup, browser
globals, or ECS APIs.

The shell is not a public material plugin API. It is a typed internal WebGPU
composition helper for the built-in families that already exist:

- `unlit`
- `matcap`
- `standard`

`app.ts` remains responsible for:

- passing app-owned assets, device, caches, and reuse counters into
  texture/sampler callbacks;
- passing app-owned frame-resource cache and layout inputs into frame-resource
  callbacks;
- pipeline selection and layout lookup;
- route diagnostics and route report creation;
- render frame planning and command submission.

## Validation

- `pnpm exec vitest run test/webgpu/built-in-material-app-resource-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec vitest run test/webgpu/webgpu-app.test.ts test/webgpu/built-in-material-queue-adapter.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Follow-Ups

- Move frame-resource reuse helpers only after introducing the explicit
  cache-slot boundary described in the frame-resource reuse extraction plan.
- Keep allocation cleanup separate from the first frame-resource helper move.
