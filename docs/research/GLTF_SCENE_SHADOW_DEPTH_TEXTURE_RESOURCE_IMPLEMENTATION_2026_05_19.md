# GLTF Scene Shadow Depth Texture Resource Implementation — 2026-05-19

## Task

Implemented `task-1832`: allocate renderer-owned shadow depth texture/view
resources from planned shadow texture descriptors.

## Reference Anchors

- `references/engine/src/scene/renderer/render-pass-shadow-directional.js`
- `references/three.js/src/renderers/webgl/WebGLShadowMap.js`
- Local `packages/webgpu/src/webgpu/shadow-texture-resource.ts`
- Local `packages/webgpu/src/webgpu/texture-resources.ts`
- Local diffuse IBL texture allocation helper.

The external references allocate or reuse shadow-map render targets before
shadow command submission. Aperture adapts that pattern as an explicit
renderer-owned WebGPU resource helper fed by extracted/planned descriptors,
without adding renderer-owned ECS state or shadow pass submission.

## Implementation

Added `ShadowDepthTextureResourceReport` in `packages/webgpu`. It:

- consumes `ShadowTextureResourceReport`;
- creates `depth24plus` textures with render-attachment usage through an
  injected WebGPU-like device;
- stores live texture/view handles only in the non-JSON report;
- exposes JSON-safe stable resource, texture, and view keys; and
- reports matrix upload, pass submission, and shader sampling as deferred.

The GLTF scene status now includes `shadow.depthTextureResources` and a
`readiness.shadow.phases.depthTextureResources` phase. Existing shadow texture
descriptors remain available separately under `shadow.textures`.

## Deferred

- Shadow matrix upload.
- Shadow depth pass command encoding/submission.
- StandardMaterial shadow bind-group/layout changes.
- StandardMaterial shadow-map sampling.
