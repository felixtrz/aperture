# GLTF Scene IBL Sampler Descriptor Implementation — 2026-05-19

## Task

`task-1816` added JSON-safe IBL sampler descriptor readiness.

## Reference Anchors

- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/extras/PMREMGenerator.js`
- Local `ibl-texture-preparation` and StandardMaterial IBL readiness helpers.

The reference engines prepare sampled environment resources before material
lighting uses them. Aperture's current step exposes sampler descriptor intent
from planned diffuse/specular IBL texture slots without allocating GPU samplers
or changing bind-group layouts.

## Implementation

- Added `createIblSamplerDescriptorReadinessReport`.
- The report derives stable sampler keys from IBL texture preparation slots.
- The descriptor metadata uses clamp-to-edge addressing and linear filtering for
  the current cube IBL slots.
- The GLTF scene status now exposes `ibl.samplers` beside texture preparation
  and pass planning.

## Boundary Notes

- No `GPUSampler`, bind group, bind-group layout, shader, or texture upload is
  created.
- Shader sampling remains explicitly deferred.
- Unsupported or missing texture preparation is reported before sampler
  descriptor readiness.

## Validation

- Added targeted coverage in
  `test/webgpu/ibl-sampler-descriptor-readiness.test.ts`.
- Updated `test/e2e/gltf-scene.spec.ts` expectations for the browser status.
