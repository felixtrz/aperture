# GLTF Scene Diffuse IBL Texture Resource Implementation — 2026-05-19

## Task

`task-1827` added the first live renderer-owned IBL texture allocation slice.

## Reference Anchors

- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/extras/PMREMGenerator.js`
- Local `ibl-texture-preparation`
- Local `texture-resources`

## Implementation

- Added `createDiffuseIblTextureResourceReport`.
- The helper allocates a WebGPU-owned diffuse IBL texture/view resource from
  planned diffuse IBL texture slots using an injected WebGPU-like device.
- Added JSON helpers that report stable resource keys, descriptors, creation
  counts, and diagnostics without exposing raw GPU handles.
- The GLTF scene status now exposes `ibl.diffuseTextureResource`.
- The grouped IBL readiness now distinguishes live diffuse texture allocation
  from deferred sampler allocation, specular prefiltering, and shader sampling.

## Boundary Notes

- ECS and render snapshots still carry only stable handles and extracted packet
  data.
- Specular prefiltering, IBL bind-group layout changes, and StandardMaterial
  shader sampling remain deferred.
- The GLTF example caches the diffuse IBL texture report so it does not allocate
  a new texture every frame.

## Validation

- Added targeted coverage in `test/webgpu/ibl-texture-resource.test.ts`.
- Updated `test/e2e/gltf-scene.spec.ts` expectations for the browser status.
