# Built-In Material Adapter Registry Factory Plan - 2026-05-17

## Scope

Plan the smallest safe extraction of built-in material adapter registry creation
from `packages/webgpu/src/webgpu/app.ts`.

This is a planning slice only. It does not move runtime code, change app
behavior, change queue sorting, or move GPU resource preparation.

## References Inspected

- `docs/research/BUILT_IN_MATERIAL_ADAPTER_ROUTE_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-family.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-phase.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Coupling

`QUEUED_BUILT_IN_MATERIAL_ADAPTERS` still combines two kinds of behavior:

- Pure routing metadata:
  - built-in family name;
  - material asset type guard;
  - queue item phase/blend validation.
- App-specific resource work:
  - texture/sampler preparation;
  - frame resource creation and reuse;
  - concrete family bucket append;
  - app/cache/scratch/layout/light dependencies.

The pure routing metadata is the better extraction target. The app-specific
resource closures still depend heavily on `WebGpuApp`, `WebGpuAppResourceCache`,
prepared texture resources, frame resources, pipeline layouts, and family
buckets.

## Proposed Extraction

Add a small module:

```ts
packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts
```

Initial exports:

```ts
export type BuiltInMaterialAsset =
  | UnlitMaterialAsset
  | MatcapMaterialAsset
  | StandardMaterialAsset;

export interface BuiltInMaterialQueueRouteAdapter extends QueuedMaterialAdapterRegistration<BuiltInMaterialQueueFamily> {
  readonly kind: BuiltInMaterialQueueFamily;
  isMaterialAsset(material: MaterialAsset): material is BuiltInMaterialAsset;
  validateQueueItem(
    queueItem: MaterialQueueItem,
  ): BuiltInMaterialQueuePhaseDiagnostic | null;
}

export function createBuiltInMaterialQueueRouteAdapterRegistry(): QueuedMaterialAdapterRegistry<BuiltInMaterialQueueRouteAdapter>;
```

This module may import render material asset types and the existing built-in
family/phase helpers. It must not import `WebGpuApp`, app resource cache types,
frame resources, WebGPU resource handles, devices, pipelines, bind groups, or
browser globals.

## App Integration Shape

After the route-only factory exists, `app.ts` can keep its resource closures in a
small local map keyed by built-in family:

- `prepareTextureSamplerResources`
- `createFrameResources`
- `appendFrameResource`

The queued route can look up the pure route adapter first, then pair it with the
app-local resource adapter for resource preparation. This keeps route
diagnostics, duplicate-family diagnostics, and material asset type checks
inspectable without prematurely extracting the GPU-heavy half of the app route.

## Validation Plan

- Unit tests for route adapter registry families and duplicate-family JSON
  diagnostics.
- Unit tests for material asset type guards across unlit, matcap, standard, and
  unsupported material kinds.
- Focused app tests for unknown material family, unsupported alpha-test family,
  unsupported transparent family/blend, asset mismatch when available, and
  successful unlit/matcap/standard queued paths.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Non-Goals

- Do not move texture/sampler preparation out of `app.ts`.
- Do not move frame resource creation or family bucket append out of `app.ts`.
- Do not add a public material plugin API.
- Do not change supported material families, phase support, sorting, or draw
  submission.
- Do not introduce ECS, source asset registry, or GPU resource ownership into
  the route adapter module.

## Recommended Implementation Slice

Add `built-in-material-queue-adapter.ts` with the route-only adapter registry
factory and focused tests. Keep `app.ts` behavior unchanged until a follow-up
slice pairs the route-only adapters with app-local resource closures.
