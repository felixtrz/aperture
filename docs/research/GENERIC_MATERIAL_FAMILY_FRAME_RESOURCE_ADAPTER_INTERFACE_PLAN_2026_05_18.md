# Generic Material-Family Frame-Resource Adapter Interface Plan

Date: 2026-05-18

## Scope

Plan the next interface split after the built-in queued frame-resource set
extraction. This plan does not change render behavior. It defines the smallest
contract that lets future material families participate in queue-to-frame-
resource preparation without adding another family-specific route to `app.ts`.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_COLLECTOR_SPLIT_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/common/RenderObject.js`

## Reference Commonality

PlayCanvas separates a material/shader preparation pass from the draw submission
pass and writes transient results into a reusable `_drawCallList`. The draw pass
then consumes those prepared entries, binds material/light/mesh state, and
submits commands.

three.js treats a render object as renderer-owned draw state derived from object,
material, geometry, camera, lights, and render context. Its cache keys combine
material, geometry, and dynamic context concerns rather than making the authoring
object the draw representation.

Aperture should keep the same split, but its inputs are `RenderSnapshot`,
prepared source assets, material queue items, and adapter-created WebGPU frame
resources. No generic interface should introduce a mutable scene object or make
the renderer read ECS state.

## Current Shape

`queued-built-in-frame-resource-set.ts` now owns the loop over
`QueuedBuiltInAppResourceSet` items:

- request or reuse a pipeline through callbacks;
- read bind group layouts from the pipeline view;
- request texture/sampler dependencies through callbacks;
- create family frame-resource options through callbacks;
- call `item.adapter.createFrameResources`;
- append successful family resources to fixed built-in buckets;
- write mesh/material resource-key maps and pipeline-scoped bind groups.

This is close to the desired collector shape, but the contract is still
hard-coded around built-in families:

- the item type is `QueuedBuiltInAppResourceItem`;
- the resource result union is `CreateQueuedBuiltInFamilyFrameResourcesResult`;
- output buckets are `unlit`, `matcap`, and `standard`;
- app callbacks still construct one built-in `QueuedBuiltInFrameResourcePreparationOptions`
  object that includes `WebGpuApp`, caches, assets, and snapshot data.

## Proposed Interface Split

Introduce a generic WebGPU-internal collector contract, then adapt built-in
families to it.

Suggested names:

```ts
interface QueuedMaterialFrameResourceItem<TFamily, TRoute, TSource> {
  readonly family: TFamily;
  readonly route: TRoute;
  readonly source: TSource;
  readonly draw: MeshDrawPacket;
  readonly sourceMeshKey: string;
  readonly sourceMaterialKey: string;
  readonly backendMeshKey: string;
  readonly backendMaterialKey: string;
  readonly pipelineKey: string;
}

interface QueuedMaterialFrameResourceFamilyAdapter<
  TItem,
  TTextureOptions,
  TFrameOptions,
  TFrameResources,
  TFrameResult,
> {
  readonly family: string;
  prepareTextureSamplerResources(
    options: TTextureOptions,
  ): PreparedAppTextureSamplerResources;
  createFrameResources(options: TFrameOptions): TFrameResult;
  appendFrameResources(input: {
    readonly item: TItem;
    readonly result: TFrameResult;
    readonly sink: QueuedMaterialFrameResourceSink<TFrameResources>;
  }): QueuedMaterialFrameResourceAdapterReport;
}

interface QueuedMaterialFrameResourceSink<TFrameResources> {
  readonly meshResources: TFrameResources["mesh"][];
  readonly bindGroups: TFrameResources["bindGroups"][number][];
  appendFamilyResources(family: string, resources: TFrameResources): void;
}
```

The collector should depend on item capabilities rather than built-in material
names. The built-in adapter can then provide a sink implementation that maps
`unlit`, `matcap`, and `standard` into the existing output arrays while a future
material family can provide its own sink bucket without changing the app render
loop.

## App-Owned Responsibilities

Keep these injected from `app.ts` or app-owned helper modules:

- WebGPU device, queue, context, canvas, format, and readback dimensions.
- Pipeline cache lookup/creation and pipeline-layout cache lookup.
- Prepared mesh/material/texture/sampler caches.
- Source asset registry access needed by current app resource helpers.
- Resource reuse counters and app render-report assembly.
- Render frame planning, frame boundary assembly, command submission, and
  submitted-work waiting.

## Family-Adapter-Owned Responsibilities

Move or keep these behind material-family adapters:

- route compatibility and source material type guards;
- texture/sampler dependency preparation for the family;
- frame-resource creation for family-specific uniforms, textures, samplers,
  lights, and material bind groups;
- family-specific output append behavior;
- JSON-safe route/resource diagnostics that omit raw GPU handles and source
  asset objects.

## Hot-Path And JSON-Safety Constraints

- The collector must accept caller-owned scratch and reset maps/arrays in place.
- The success path should not allocate a new bucket map, route report, or
  diagnostic wrapper per item.
- Failure diagnostics may allocate, but diagnostics must serialize without raw
  `GPU*` resources, device/context/canvas objects, or source asset payloads.
- Pipeline plans may carry raw pipeline handles internally, but JSON helpers and
  route reports must expose only stable keys and diagnostic data.
- The interface should avoid accepting broad objects such as `WebGpuApp` when it
  only needs prepared data and app-injected callbacks.

## Migration Slice

The smallest aligned implementation slice is to add generic contracts while
keeping the existing built-in behavior intact:

1. Add a generic `queued-material-frame-resource-set` module with item/sink/
   adapter contracts and reusable scratch.
2. Make `queued-built-in-frame-resource-set` a built-in adapter/sink wrapper over
   the generic collector.
3. Keep `QueuedBuiltInFrameResources` and public app render reports unchanged.
4. Port the existing queued built-in frame-resource tests to assert both the
   generic collector behavior and built-in wrapper compatibility.

This does not require adding a new material family. The purpose is to make the
next family integration avoid another app-specific preparation route.

## Follow-Up Task

### task-1147 — Introduce generic queued material frame-resource collector contracts

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, targeted WebGPU tests.
Reference anchor: this plan,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/engine/src/scene/renderer/forward-renderer.js`, and
`references/three.js/src/renderers/common/RenderObject.js`.

Acceptance criteria:

- Add a generic queued material frame-resource collector contract with reusable
  scratch and adapter/sink hooks.
- Re-implement the built-in frame-resource set wrapper through the generic
  contract without changing app render reports.
- Preserve JSON-safe diagnostics and current resource reuse semantics.
- Existing queued built-in frame-resource tests pass, plus one focused generic
  collector test that does not mention unlit/matcap/standard buckets.
