# Standard App Frame Resource Reuse Extraction Plan - 2026-05-17

## Scope

Plan the StandardMaterial app frame-resource reuse extraction after unlit and
Matcap helpers were moved behind explicit cache-slot boundaries.

This is a planning slice only. It does not move StandardMaterial implementation
code.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/FRAME_RESOURCE_REUSE_HELPER_EXTRACTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/webgpu/src/webgpu/lighting-resource-plan.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Standard Reuse Dependencies

StandardMaterial frame-resource reuse has the same base dependencies as unlit
and Matcap:

- source mesh/material keys;
- prepared texture/sampler keys;
- packed view uniforms;
- packed world transforms;
- shared bind group layouts;
- material bind group layout;
- caller-owned frame cache slot;
- caller-owned reuse counters.

It also adds light-specific dependencies:

- `RenderSnapshot` input for light packing;
- `createLightBufferDescriptor`;
- `createLightBufferDescriptorPlan`;
- cached light float buffer byte length;
- cached light metadata buffer byte length;
- dynamic writes into reused light float and metadata GPU buffers;
- `lightBuffersCreated` / `lightBuffersReused` counters;
- `LightBindGroupLayoutResource`.

## Recommended Extraction

Add an internal module:

```text
packages/webgpu/src/webgpu/standard-app-frame-resources.ts
```

Initial exports:

- `CachedStandardAppFrameResources`
- `StandardAppFrameResourceCacheSlot`
- `StandardAppFrameResourceReuseReport`
- `createOrReuseStandardAppFrameResources`

The helper should take explicit options:

```ts
{
  device,
  cache,
  snapshot,
  mesh,
  meshKey,
  material,
  materialKey,
  textures,
  viewUniforms,
  worldTransforms,
  sharedLayouts,
  materialLayout,
  lightLayout,
  reuse,
}
```

The helper may import Standard frame-resource creation and light packing helpers
directly, but it must not import:

- `WebGpuApp`;
- app resource cache;
- route adapter construction;
- material queue planning;
- pipeline selection/cache;
- render frame planning;
- command encoding/submission;
- browser globals.

## Validation Required

Before extraction:

- keep the current StandardMaterial queue route tests passing;
- identify focused app assertions that cover Standard second-frame reuse and
  light buffer reuse.

After extraction:

- run focused WebGPU app tests;
- verify Standard successful renders still omit material queue route reports by
  default;
- verify Standard route failures still stop before resource creation;
- run WebGPU package type-checking, test type-checking, and package boundary
  checks.

## Hot-Path Allocation Notes

The first extraction should preserve existing behavior, including current result
object and key-array allocation. Allocation cleanup should follow as a separate
audit/refactor so the helper move remains reviewable.

## Non-Goals

- Do not change StandardMaterial shader lighting behavior.
- Do not move pipeline selection or pipeline layout lookup.
- Do not move render frame plan assembly.
- Do not move command boundary assembly or queue submission.
- Do not create a public material plugin API.
- Do not introduce module-owned caches.

## Proposed Next Slice

Extract `createOrReuseStandardAppFrameResources` into the internal module using
the unlit/Matcap helper pattern, then run a focused boundary audit specifically
covering light buffer ownership.
