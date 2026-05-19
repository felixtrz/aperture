# Specular IBL Texture Resource Implementation — 2026-05-19

## Task

Completed `task-1849`: allocate the specular IBL texture/view resource.

## Reference Anchors

- `packages/webgpu/src/webgpu/ibl-texture-resource.ts`
- `packages/webgpu/src/webgpu/standard-material-ibl-bind-group.ts`
- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/extras/PMREMGenerator.js`
- `docs/research/SPECULAR_IBL_RESOURCE_ALLOCATION_SLICE_PLAN_2026_05_19.md`

## Implementation

- Added `SpecularIblTextureResourceReport`.
- Allocates renderer-owned specular texture/view resources from planned IBL
  specular slots.
- Uses `TEXTURE_BINDING | COPY_DST | RENDER_ATTACHMENT` usage and mip counts
  derived from texture size.
- Reports deferred prefilter pass execution separately from allocation.
- Updated `StandardMaterialIblBindGroupDescriptorPlan` so group 4 becomes valid
  when diffuse texture, specular texture, and sampler resource keys are all
  available.
- Updated the GLTF scene status with `ibl.specularTextureResource` and the
  matching readiness phase.

## Validation

- `pnpm exec vitest run test/webgpu/specular-ibl-texture-resource.test.ts test/webgpu/ibl-texture-resource.test.ts test/webgpu/standard-material-ibl-bind-group.test.ts`
- `pnpm run typecheck:test`
- `pnpm exec playwright test test/e2e/gltf-scene.spec.ts`

## Deferred

- Specular prefilter shader/pass execution.
- WebGPU app environment-resource cache integration.
- Live group 4 bind-group creation.
- WGSL IBL sampling.
