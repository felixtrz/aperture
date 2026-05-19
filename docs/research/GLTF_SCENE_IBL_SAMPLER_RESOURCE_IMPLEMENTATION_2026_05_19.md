# GLTF Scene IBL Sampler Resource Implementation - 2026-05-19

## Summary

Added the first renderer-owned IBL sampler allocation slice for the GLTF scene
fixture. The scene now keeps sampler descriptor planning separate from live
WebGPU sampler handles, allocates the diffuse/specular IBL samplers through the
existing texture resource device boundary, and publishes JSON-safe resource
diagnostics.

## Reference Anchor

- `references/engine/src/platform/graphics/webgpu/webgpu-bind-group-format.js`
  separates texture and sampler binding layout entries.
- `references/three.js/src/renderers/webgpu/utils/WebGPUTextureUtils.js`
  creates `GPUSampler` resources from reusable descriptors and caches them by
  sampler key.
- Aperture adapts those patterns by keeping authoring in ECS/snapshot-derived
  reports and limiting the WebGPU-specific object lifetime to renderer-owned
  resource reports.

## Implementation

- Added `createIblSamplerResourceReport` in `packages/webgpu`.
- Reused `createSamplerGpuResource` so sampler allocation shares the same
  device-like test seam as texture allocation.
- Added `iblSamplerResourceReportToJsonValue` and JSON serialization that omit
  raw `GPUSampler` handles.
- Updated the GLTF scene status with `ibl.samplerResources` and a grouped
  `readiness.ibl.phases.samplerResources` phase.
- Added tests for successful allocation, unavailable devices, missing
  descriptors, and JSON safety.

## Remaining Work

- Add a diffuse IBL resource summary bridge that combines texture and sampler
  live allocation status with existing preparation summaries.
- Add the StandardMaterial IBL bind-group layout slice after live texture,
  sampler, and view reports are available.
- Keep specular prefiltering and shader sampling explicitly deferred until the
  resource summaries can describe the required inputs.
