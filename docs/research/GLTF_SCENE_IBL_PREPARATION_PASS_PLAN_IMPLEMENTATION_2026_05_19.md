# GLTF Scene IBL Preparation Pass Plan Implementation

Date: 2026-05-19

## Summary

Added `IblPreparationPassPlanReport` in `packages/webgpu`.

The report consumes `IblTexturePreparationReport` and derives JSON-safe pass
planning records for diffuse irradiance and specular prefilter work:

- stable pass keys,
- environment-map resource keys and environment ids,
- source texture resource keys,
- derived texture/view/sampler keys,
- operation labels, and
- submission status.

The default status is `deferred`, so the GLTF scene can expose planned IBL
preparation passes without creating GPU textures, render passes, command
encoders, or shader sampling.

## Reference Notes

- `references/engine/src/scene/graphics/env-lighting.js` models environment
  lighting generation as renderer-owned work split into skybox, lighting source,
  and atlas/prefilter steps.
- `references/three.js/src/extras/PMREMGenerator.js` converts environment
  textures into prefiltered renderer-owned targets before material sampling.
- Aperture keeps the current slice at the planning/report layer; no upload,
  prefilter shader, render target, bind group, or StandardMaterial shader
  consumption was added.

## Next

`task-1807` should add directional shadow view/projection planning from the
extracted shadow and light data before any shadow pass command submission is
attempted.
