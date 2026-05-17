# Built-In Material Adapter Factory Boundary Audit - 2026-05-17

## Scope

Audit the route-only built-in material queue adapter factory added for the
WebGPU app material queue route.

This audit covers:

- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts` integration
- focused route adapter and app route tests

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/BUILT_IN_MATERIAL_ADAPTER_REGISTRY_FACTORY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-family.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-phase.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/built-in-material-queue-adapter.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Findings

No boundary drift was found.

The new route adapter module contains only:

- built-in material family registration;
- material source asset type guards;
- material queue phase/blend validation delegated to the existing helper;
- duplicate-family diagnostics delegated to the generic queued adapter registry.

The module does not import `WebGpuApp`, app caches, frame scratch, frame
resources, WebGPU devices, pipelines, bind groups, browser globals, or render
submission helpers.

The `app.ts` integration now composes app-local resource adapters by spreading
the route-only adapters and adding closures for:

- texture/sampler preparation;
- frame resource creation/reuse;
- family bucket append.

Those closures remain inside `app.ts`, where the current app facade owns access
to WebGPU initialization, caches, layouts, frame scratch, and family resource
buckets.

Supported family and phase behavior is unchanged:

- `unlit`, `matcap`, and `standard` remain the built-in queue families.
- Opaque draws remain supported for all three families.
- StandardMaterial alpha-test and alpha-blend transparent draws remain
  supported.
- Unsupported families, unsupported alpha-test families, unsupported
  transparent families, unsupported blend presets, and asset mismatches still
  report through the existing app diagnostics.

## Reference Pattern Fit

The extraction follows the common render-list/layer pattern from the local
references: route metadata and phase bucketing are separable from concrete
resource preparation. Aperture keeps the resource-owning half WebGPU-local and
derives routing from queue items instead of renderer-owned scene nodes.

## Validation

- `pnpm exec vitest run test/webgpu/built-in-material-queue-adapter.test.ts`
- `pnpm exec vitest run test/webgpu/built-in-material-queue-adapter.test.ts test/webgpu/webgpu-app.test.ts`
- `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Follow-Ups

- Continue with the planned app-local resource adapter split as a research slice
  before moving more GPU-heavy closures out of `app.ts`.
