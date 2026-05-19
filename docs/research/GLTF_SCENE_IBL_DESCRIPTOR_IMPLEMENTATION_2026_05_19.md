# GLTF Scene IBL Descriptor Implementation

Date: 2026-05-19

## Reference Pattern

- PlayCanvas prepares environment lighting as renderer-side cubemap/atlas
  resources and lets lit material options choose reflection and ambient sources
  from prepared scene/material resources.
- three.js generates PMREM render targets from equirectangular or cubemap
  inputs before material environment sampling consumes them.
- Bevy extracts environment-map/light-probe authoring into the render world and
  keeps prepared image/bind resources renderer-owned.

The common pattern is that ECS/source assets identify environment intent, while
prefiltered diffuse/specular resources and shader bindings belong to the
renderer.

## Aperture Slice

Added a JSON-safe `IblResourceDescriptorReport` in `packages/webgpu`.

The report:

- derives required environment-map resource keys from extracted environment
  packets,
- records renderer-owned diffuse/specular IBL resource keys when available,
- emits explicit unsupported placeholders when those resources are not prepared,
- keeps shader sampling marked inactive through `sections.shaderSampling:
false`, and
- omits raw handles, GPU resources, source assets, and callbacks from JSON.

The GLTF scene app now surfaces this descriptor report beside the existing
environment-map readiness report. This proves descriptor readiness without
claiming StandardMaterial IBL sampling is implemented.

## Next

`task-1796` should connect these descriptors to StandardMaterial readiness
diagnostics so the scene can explain whether StandardMaterial has usable IBL
inputs, even before shader sampling is active.
