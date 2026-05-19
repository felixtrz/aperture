# GLTF Scene StandardMaterial Shadow Readiness Implementation

Date: 2026-05-19

## Summary

Added `StandardMaterialShadowReadinessReport` in `packages/webgpu`.

The report consumes `ShadowPassPlanReport` and the number of active
StandardMaterial source assets, then classifies shadow readiness as:

- `available` when pass planning is ready for a future submitter,
- `missing` when shadow texture resources or pass plans are incomplete,
- `unsupported` when pass submission is explicitly unsupported,
- `deferred` when pass planning exists but submission is not implemented, or
- `not-required` when no StandardMaterial or no shadow request needs it.

The GLTF scene status now exposes this under `shadow.standardMaterial`. The
current scene reports `deferred`: shadow descriptors, texture descriptors, and
pass plans are available, but shadow pass submission and StandardMaterial shader
sampling remain inactive.

## Reference Notes

- `references/engine/src/scene/materials/standard-material-options-builder.js`
  connects lit StandardMaterial options to scene shadow settings.
- `references/engine/src/scene/shader-lib/*/chunks/lit/frag/lighting/*`
  shows that lit materials need explicit shadow sampler and shadow parameter
  bindings before shading can consume shadow maps.
- `references/three.js/src/renderers/WebGLRenderer.js` updates material
  `receiveShadow` state and shadow-map uniforms after shadow-map rendering.
- Aperture keeps this as a readiness report only; no StandardMaterial WGSL
  shadow sampling or bind-group changes were added.

## Next

`task-1803` should add the next IBL texture preparation descriptor so IBL
resources progress in parallel with the shadow readiness chain.
