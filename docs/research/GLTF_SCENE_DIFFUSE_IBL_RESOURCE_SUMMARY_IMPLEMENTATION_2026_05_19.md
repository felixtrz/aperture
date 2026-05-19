# GLTF Scene Diffuse IBL Resource Summary Implementation - 2026-05-19

## Summary

Added a compact JSON-safe bridge for the GLTF scene's live diffuse IBL
resources. The report summarizes the live diffuse texture allocation, live IBL
sampler allocation, deferred specular prefiltering, deferred bind-group layout
changes, and deferred StandardMaterial shader sampling without exposing raw
WebGPU handles.

## Reference Anchor

- `references/engine/src/platform/graphics/webgpu/webgpu-bind-group-format.js`
  keeps sampler/texture bindings explicit before shader use.
- `references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`
  treats sampler and texture resources as renderer-owned GPU resources.
- Aperture keeps the bridge as a report over ECS-derived descriptors and
  renderer-owned resources, not as renderer-owned game state.

## Implementation

- Added `DiffuseIblResourceSummaryReport` in `packages/webgpu`.
- Exposed JSON helpers and package exports.
- Updated the GLTF scene status with `ibl.diffuseResourceSummary` and grouped
  readiness phase `readiness.ibl.phases.diffuseResourceSummary`.
- Added focused unit coverage for summary counts, resource keys, deferred
  diagnostics, and JSON safety.

## Remaining Work

- Allocate the first live shadow depth texture/view resource.
- Move repeated example-level live IBL resource caching into a renderer-owned
  cache once the cache direction audit lands.
- Add StandardMaterial IBL bind-group layout and shader sampling only after the
  resource summaries identify the required texture/sampler/view inputs.
