# GLTF Scene StandardMaterial IBL/Shadow Pipeline-Key Implementation — 2026-05-19

## Task

`task-1814` added metadata-only StandardMaterial IBL/shadow pipeline-key
readiness.

## Reference Anchors

- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting`
- `references/three.js/src/renderers/shaders/ShaderChunk`
- Local `standard-pipeline-descriptor` and
  `standard-material-ibl-shadow-binding-readiness` helpers.

The reference shader systems specialize lighting, environment, and shadow
features through shader/pipeline variants. Aperture now exposes the future
StandardMaterial feature tokens as readiness metadata while leaving the current
direct-lit pipeline unchanged.

## Implementation

- Added `createStandardMaterialIblShadowPipelineKeyReadinessReport`.
- The report summarizes future StandardMaterial pipeline-key tokens:
  - `iblDiffuseIrradiance`
  - `iblSpecularPrefilter`
  - `shadowMap`
  - `shadowViewProjection`
- The GLTF scene status now exposes `ibl.pipelineKey` beside the IBL/shadow
  binding readiness report.

## Boundary Notes

- No WGSL, bind-group layout, or pipeline descriptor behavior changed.
- The report is JSON-safe metadata only.
- Public custom material and shader-extension APIs remain deferred.

## Validation

- Added targeted coverage in
  `test/webgpu/standard-material-ibl-shadow-pipeline-key-readiness.test.ts`.
- Updated `test/e2e/gltf-scene.spec.ts` expectations for the browser status.
