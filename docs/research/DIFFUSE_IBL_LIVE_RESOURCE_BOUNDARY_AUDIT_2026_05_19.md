# Diffuse IBL Live Resource Boundary Audit — 2026-05-19

## Task

`task-1829` audited the first live diffuse IBL texture allocation boundary.

## Findings

- Diffuse IBL texture allocation is renderer-owned and lives in
  `packages/webgpu`.
- ECS and render snapshots still carry only stable handles and extracted
  environment packets.
- JSON helpers report descriptors, resource keys, creation counts, and
  diagnostics without exposing raw `GPUTexture` or `GPUTextureView` handles.
- The GLTF scene status distinguishes:
  - live diffuse IBL texture allocation,
  - deferred specular prefiltering,
  - deferred sampler allocation,
  - deferred bind-group layout changes, and
  - deferred StandardMaterial shader sampling.

## Concerns

The GLTF example caches the diffuse IBL texture report in module scope. That is
acceptable for the example fixture, but production app integration should move
IBL resource lifetime into a renderer-owned cache before adding more live
environment resources.

## Recommendation

Proceed to either:

- `task-1830`: allocate IBL samplers, or
- `task-1831`: add a summary bridge over live diffuse allocation plus deferred
  specular/sampler/shader phases.

Do not add shader IBL sampling until texture and sampler resource lifetime is
represented through renderer-owned cache state.
