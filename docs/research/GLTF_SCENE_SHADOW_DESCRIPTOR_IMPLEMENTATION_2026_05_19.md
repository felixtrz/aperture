# GLTF Scene Shadow Descriptor Implementation

Date: 2026-05-19

## Reference Pattern

- three.js keeps shadow configuration on light shadow objects, then renderer
  internals create/update shadow matrices and shadow map resources.
- PlayCanvas tracks shadow casters separately from visible draw lists and uses
  renderer-owned shadow render targets/passes.
- Aperture already extracts `ShadowRequestPacket` records from ECS light shadow
  settings, so the next step is a renderer-owned descriptor, not ECS-owned GPU
  state.

## Aperture Slice

Added `ShadowMapDescriptorReport` in `packages/webgpu`.

The report:

- consumes extracted `ShadowRequestPacket` data,
- combines it with scene shadow intent metadata such as map size and bias,
- emits stable renderer-owned shadow-map resource keys,
- reports depth format and layer masks in JSON-safe form,
- keeps `sections.shadowPassSubmission` false, and
- diagnoses missing descriptors or invalid map sizes without creating GPU
  textures or render passes.

The GLTF scene app now exposes this descriptor report under `shadow.descriptor`.
Visible shadows and shadow sampling remain deferred to `task-1798`.
