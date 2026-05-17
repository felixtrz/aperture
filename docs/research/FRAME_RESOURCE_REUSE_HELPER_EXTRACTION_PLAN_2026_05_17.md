# Frame Resource Reuse Helper Extraction Plan - 2026-05-17

## Scope

Plan the smallest safe extraction boundary for the app-local frame-resource
reuse helpers:

- `createOrReuseUnlitAppFrameResources`
- `createOrReuseMatcapAppFrameResources`
- `createOrReuseStandardAppFrameResources`

This is a planning slice only. It does not move implementation code.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/APP_LOCAL_RESOURCE_ADAPTER_SPLIT_PLAN_2026_05_17.md`
- `docs/research/APP_TEXTURE_SAMPLER_RESOURCE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Dependencies

The three app reuse helpers currently share a pattern:

1. Build view and world-transform buffer descriptor plans.
2. Compare source mesh/material keys and texture/sampler dependency keys.
3. Compare dynamic buffer byte lengths.
4. Reuse existing frame resources by writing new dynamic data into existing GPU
   buffers.
5. Fall back to full per-family frame resource creation.
6. Update caller-owned reuse counters.
7. Store successful results back into caller-owned app frame caches.

StandardMaterial adds light buffer dependencies:

- packed light float buffer byte length;
- packed light metadata buffer byte length;
- dynamic writes into reused light GPU buffers;
- `lightBuffersCreated` / `lightBuffersReused` counters;
- `RenderSnapshot` input for light packing and Standard frame resource
  creation.

## Required Types

A safe extraction needs explicit type ownership for:

- per-family cached frame resources;
- shared app frame resource reuse counters;
- `WebGpuAppPipelineLayouts`;
- a small `QueueWriteBufferDeviceLike`;
- `PreparedAppTextureSamplerResources`;
- `PackedSnapshotViewUniforms`;
- `PackedSnapshotTransforms`;
- source `MeshAsset` and material assets;
- optional `RenderSnapshot` only for StandardMaterial.

The extracted module should not define or own:

- pipeline caches;
- texture/sampler caches;
- render frame plan scratch;
- material queue scratch;
- route report shell;
- WebGPU app creation;
- render-world mutation;
- command encoding/submission.

## Recommended Extraction

Add an internal module:

```text
packages/webgpu/src/webgpu/app-frame-resource-reuse.ts
```

Initial exports:

- `CachedUnlitFrameResources`
- `CachedMatcapFrameResources`
- `CachedStandardFrameResources`
- `WebGpuAppPipelineLayouts`
- `WebGpuAppFrameResourceReuseReport`
- `createOrReuseUnlitAppFrameResources`
- `createOrReuseMatcapAppFrameResources`
- `createOrReuseStandardAppFrameResources`

The module should take explicit options:

```ts
{
  device,
  cacheSlot,
  mesh,
  meshKey,
  material,
  materialKey,
  textures,
  viewUniforms,
  worldTransforms,
  layouts,
  reuse,
}
```

For StandardMaterial only, add:

```ts
{
  snapshot,
}
```

Because cache slots need mutation, use a caller-owned mutable cache container
rather than returning a hidden module-owned cache:

```ts
{
  current: CachedUnlitFrameResources | null;
}
```

or keep the first implementation in `app.ts` and extract only after introducing
small cache slot wrappers in a separate slice.

## Hot-Path Allocation Notes

The current helpers still allocate on some success paths:

- descriptor plan helpers may allocate;
- reused-resource results spread existing resource objects into fresh result
  objects;
- successful cache miss writes copy texture/sampler key arrays.

This extraction should preserve behavior first. Allocation cleanup should be a
separate audit/refactor after the helper boundary is stable.

The first implementation should not introduce additional per-frame arrays, maps,
or closures beyond what already exists.

## Validation Plan

Before extraction:

- keep focused app route tests passing;
- keep resource reuse assertions for second-frame unlit/matcap/standard paths
  passing;
- keep type-checking and package boundary checks passing.

After extraction:

- add or preserve tests that verify second-frame reuse counters:
  - mesh/material buffer reuse;
  - bind group reuse;
  - dynamic buffer writes;
  - Standard light buffer reuse where existing coverage applies.
- verify successful app renders do not emit route reports by default.

## Non-Goals

- Do not move pipeline selection or pipeline cache ownership.
- Do not move render frame plan assembly.
- Do not move command boundary assembly or queue submission.
- Do not create a public material plugin API.
- Do not add new app-global or module-global caches.
- Do not change supported material families, route phases, or diagnostics.

## Proposed Next Slice

Add a resource adapter construction shell first, with frame-resource callbacks
still supplied from `app.ts`. Then move frame-resource reuse helpers behind the
planned explicit cache-slot boundary in a later implementation slice.
