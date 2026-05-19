# GLTF Scene IBL Preparation Resource Summary Implementation — 2026-05-19

## Task

`task-1812` added a compact JSON-safe IBL preparation resource summary bridge for
the GLTF scene path.

## Reference Anchors

- `references/engine/src/scene/graphics/env-lighting.js`
- `references/three.js/src/extras/PMREMGenerator.js`
- Local `ibl-resource-descriptor`, `ibl-texture-preparation`, and
  `ibl-preparation-pass-plan` helpers.

Both reference engines derive environment-lighting resources through
renderer-owned intermediate textures/passes before material sampling. Aperture's
version keeps this as data-only readiness metadata until WebGPU texture upload,
prefilter pass submission, bind-group changes, and shader sampling are
implemented.

## Implementation

- Added `createIblPreparationResourceSummaryReport`.
- The report combines:
  - environment-map descriptor readiness,
  - planned diffuse/specular texture/view/sampler keys,
  - planned diffuse/specular preparation pass keys,
  - deferred texture upload,
  - deferred pass submission, and
  - deferred shader sampling as a separate section.
- The GLTF scene browser status now exposes `ibl.resourceSummary` alongside the
  existing descriptor, texture preparation, pass-plan, material readiness, and
  sampling status objects.

## Boundary Notes

- No `GPUTexture`, `GPUTextureView`, sampler, command encoder, render pass, or
  bind group is created by this helper.
- ECS still contributes only extracted environment packets and stable source
  asset handles.
- Shader sampling remains explicitly false and is reported separately from IBL
  descriptor readiness.

## Validation

- Added targeted coverage in `test/webgpu/ibl-preparation-resource-summary.test.ts`.
- Updated `test/e2e/gltf-scene.spec.ts` expectations for the browser status.
