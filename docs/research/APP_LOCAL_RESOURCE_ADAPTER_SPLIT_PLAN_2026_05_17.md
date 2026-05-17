# App-Local Resource Adapter Split Plan - 2026-05-17

## Scope

Plan whether and how to split the WebGPU app's built-in material resource
closures out of the large app facade after the route-only adapter factory.

This is a planning slice only. It does not move implementation code.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/BUILT_IN_MATERIAL_ADAPTER_REGISTRY_FACTORY_PLAN_2026_05_17.md`
- `docs/research/BUILT_IN_MATERIAL_ADAPTER_FACTORY_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Shape

The app route now has two distinct halves:

- Route metadata from `built-in-material-queue-adapter.ts`:
  - family name;
  - material asset type guard;
  - phase/blend validation.
- App-local resource closures in `app.ts`:
  - texture/sampler preparation;
  - frame resource creation/reuse;
  - family bucket append.

The resource closures currently depend on:

- `WebGpuApp.initialization.device`;
- `WebGpuAppResourceCache`;
- per-family frame caches (`unlitFrame`, `matcapFrame`, `standardFrame`);
- frame scratch maps/lists/buckets in `queueRoute`;
- pipeline layout lookup through concrete WebGPU pipeline handles;
- texture and sampler caches;
- dynamic `queue.writeBuffer` updates for reused uniform/transform/light
  buffers;
- resource reuse counters.

This makes them a poor fit for the route-only factory, but a good fit for a
small internal WebGPU app resource module.

## Recommendation

Split the resource closures only after adding a narrow internal boundary:

```text
route adapter
  -> app resource adapter
  -> prepared frame resources
  -> render frame plan / boundary assembly
```

The app resource adapter should stay private to the WebGPU package and should
not become a public material plugin API.

Suggested module:

```text
packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts
```

Suggested responsibilities:

- define `QueuedBuiltInAppResourceAdapter`;
- create adapters for `unlit`, `matcap`, and `standard`;
- keep family-specific texture/sampler preparation functions;
- keep family-specific create/reuse frame resource functions;
- keep family bucket append functions;
- receive all resource-owning dependencies through explicit options from
  `app.ts`.

`app.ts` should continue to own:

- `WebGpuApp`;
- `WebGpuAppResourceCache` construction;
- frame scratch construction;
- render snapshot extraction;
- pipeline lookup/cache lifetime;
- render frame plan assembly;
- WebGPU command boundary submission.

## Cache And Scratch Ownership

The split should not create new hidden caches.

The resource module should receive the existing cache/scratch objects from
`app.ts`:

- texture cache;
- sampler cache;
- per-family frame cache references;
- queue-route scratch arrays/maps;
- route report shell;
- reuse report object.

Any writer-style helpers should reuse caller-provided arrays/maps. Allocation is
acceptable for setup-time adapter construction and failure diagnostics, but not
as a steady-state success-path requirement.

## Bind Group And Layout Dependencies

Pipeline layout lookup should remain driven by the concrete pipeline selected by
the app route:

1. `app.ts` resolves or creates the WebGPU pipeline.
2. `app.ts` obtains bind group layouts from the pipeline handle.
3. `app.ts` passes `WebGpuAppPipelineLayouts` into the resource adapter.
4. The resource adapter creates/reuses frame resources for that family.

This avoids giving the adapter ownership of pipeline caches or render-pass
submission.

## Validation Required Before Extraction

Before moving code:

- add a focused app regression test for two route failures across frames so the
  route report shell cannot leak stale counts;
- keep the current unsupported-family, unsupported alpha-test family,
  unsupported transparent/blend, asset-mismatch, and successful built-in route
  app assertions unchanged;
- run focused app route tests before and after the move;
- run package type-checking and package boundary checks.

After moving code:

- add a small unit test for app resource adapter construction if the extracted
  module exposes an internal factory;
- verify no extracted module imports simulation ECS APIs, render extraction,
  browser globals beyond WebGPU-like resource inputs, or app facade creation.

## Non-Goals

- Do not add a public material plugin API.
- Do not move route family/type/phase validation back into `app.ts`.
- Do not move `RenderSnapshot` extraction or render frame plan assembly into the
  resource adapter module.
- Do not introduce a renderer-owned scene graph or authoritative app state.
- Do not add new GPU resource caches outside the app cache.

## Proposed Next Implementation Slice

First add the planned route report shell app reuse regression test. Then extract
only the app-local resource adapter construction into an internal module,
preserving the existing tests and supported route behavior.
