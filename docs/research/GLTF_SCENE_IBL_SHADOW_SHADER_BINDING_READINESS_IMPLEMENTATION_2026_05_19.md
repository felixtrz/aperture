# GLTF Scene IBL/Shadow Shader Binding Readiness Implementation

Date: 2026-05-19

## Summary

Added `StandardMaterialIblShadowBindingReadinessReport` in `packages/webgpu`.

The report consumes IBL preparation pass plans, directional shadow
view/projection plans, and shadow caster draw-list plans, then derives
JSON-safe StandardMaterial binding metadata:

- IBL diffuse and specular slots,
- shadow view-projection slot,
- shadow map slot,
- stable binding keys,
- stable resource keys, and
- deferred bind-group and shader-sampling diagnostics.

This is metadata only. It does not modify WGSL, bind group layouts, pipeline
keys, or WebGPU resources.

## Reference Notes

- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/lighting`
  separates shadow sampling functions and light/shadow declarations from
  material source data.
- `references/three.js/src/renderers/shaders/ShaderChunk` exposes shadow map
  uniforms and sampling chunks as explicit shader resources.
- Aperture keeps the current work as JSON-safe readiness metadata so future
  shader/bind-group work can be reviewed against stable planned slots.

## Next

`task-1810` should audit the IBL/shadow planning chain before visible shader
sampling or command submission is added.
