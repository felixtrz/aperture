# GLTF Scene Shadow Texture Resource Implementation

Date: 2026-05-19

## Summary

Added `ShadowTextureResourceReport` in `packages/webgpu`.

The report consumes `ShadowMapDescriptorReport` and produces JSON-safe,
renderer-owned texture planning records:

- shadow-map resource key,
- derived texture and view keys,
- width and height from map size,
- depth format,
- render-attachment usage intent, and
- deferred GPU allocation diagnostics.

The GLTF scene status now exposes the planned shadow texture resources under
`shadow.textures`. No live `GPUTexture`, texture view, render pass, or command
encoder is created in this slice.

## Next

`task-1801` should add the first shadow pass plan/report from these texture
resource descriptors and extracted shadow request data, still without command
submission.
