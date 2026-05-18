# App-Level Generic Material Adapter Route Boundary Plan

Date: 2026-05-18

## Scope

Plan the smallest app-level route boundary that can accept generic
material-family adapters without adding family-specific app wrappers.

This follows the test-only `custom-preview` route spike. It does not add a real
material family, shader, app facade API, or GLB mapping.

## References Inspected

- `docs/research/TEST_ONLY_ADAPTER_SPIKE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`

## Current Boundary

The app route currently has two layers:

- Generic pieces:
  - `createQueuedMaterialAdapterRegistry()` accepts arbitrary family keys.
  - `prepareQueuedMaterialFrameResourceSet()` prepares arbitrary route item and
    frame-resource types through callbacks.
  - `createQueuedMaterialFrameResourceBuckets()` groups resources by family.
  - `createQueuedMaterialFrameResourceSetSummary()` can fold bucket family
    counts into the existing `routedResourceSet` summary shape.

- Built-in app pieces:
  - `collectQueuedBuiltInAppResourceSet()` owns source mesh/material asset
    indexing, material queue creation, route diagnostics, and built-in resource
    item construction.
  - `QueuedBuiltInAppResourceItem` includes built-in material asset typing and a
    built-in app resource adapter.
  - Built-in frame resources still mirror successful resources into `unlit`,
    `matcap`, and `standard` compatibility arrays.

The missing piece is a generic app route item boundary between queue routing and
built-in compatibility wrappers.

## Proposed Small Boundary

Add a generic route item contract in `packages/webgpu/src/webgpu`, separate from
the built-in resource-set module.

Suggested shape:

```ts
export interface QueuedMaterialAppResourceItem<TMaterial, TAdapter> {
  readonly queueItem: MaterialQueueItem;
  readonly prepareRoute: QueuedMaterialPrepareRouteResult;
  readonly adapter: TAdapter;
  readonly draw: MeshDrawPacket;
  readonly mesh: MeshAsset;
  readonly meshKey: string;
  readonly sourceMeshKey: string;
  readonly material: TMaterial;
  readonly materialKey: string;
  readonly sourceMaterialKey: string;
}
```

The helper should not collect from `EcsWorld`, create GPU resources, or know
about `unlit`, `matcap`, or `standard`. Its initial job is only to turn an
already-routed queue item plus source assets into a typed app resource item.

## First Implementation Slice

`task-1184` should add a tiny helper around this contract:

- `createQueuedMaterialAppResourceItem(...)`, parameterized by material and
  adapter types.
- The helper accepts:
  - queue item,
  - prepare route,
  - adapter,
  - draw,
  - source mesh asset and resource key,
  - source material asset and resource key,
  - source mesh/material keys.
- The helper returns a plain item with no family-specific fields.
- Tests use the fake `custom-preview` family to prove the item can feed generic
  frame-resource preparation and routed-resource summaries.

This should not replace `collectQueuedBuiltInAppResourceSet()` yet. It should
create a generic seam that the built-in wrapper can delegate to in a later
slice.

## Transitional Compatibility

Keep stable for now:

- Public app diagnostics field `routedResourceSet`.
- Built-in `unlit`, `matcap`, and `standard` frame-resource arrays.
- Built-in app route collector module and tests.

Do not add:

- A `customPreview` compatibility array.
- A `customPreviewResourceSet` app diagnostics field.
- A product-facing material family API.
- A new app facade route for fake families.

## Acceptance Criteria For The Next Helper

- The generic item helper is family-name agnostic.
- Tests prove a fake non-built-in family can use the helper without touching
  built-in arrays or diagnostics fields.
- Existing built-in app route tests continue to pass.
- The helper lives in `@aperture-engine/webgpu` and does not import ECS world
  state, browser canvas/context state, or raw GPU resource types.

## Outcome

The next implementation should introduce a generic app route item seam, not a
real app-level material-family registry. Built-in route migration should wait
until the helper is audited.
