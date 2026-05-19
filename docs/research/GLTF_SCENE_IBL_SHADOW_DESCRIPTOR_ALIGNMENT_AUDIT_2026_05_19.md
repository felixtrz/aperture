# GLTF Scene IBL/Shadow Descriptor Alignment Audit

Date: 2026-05-19

## Scope

Audited the GLTF scene path added in `task-1795` through `task-1798` against
the North Star, architecture document, decisions log, and the local
implementation.

## Findings

- ECS remains authoritative. The GLTF scene fixture registers source assets,
  replays ECS authoring commands, steps extraction, and reads diagnostics from
  the render report.
- IBL descriptor/readiness helpers live in `packages/webgpu` and consume
  extracted environment packets or renderer-side descriptor reports.
- Shadow descriptor/readiness helpers live in `packages/webgpu` and consume
  extracted `ShadowRequestPacket` data plus scene shadow intent metadata.
- Source assets and ECS components do not store `GPUTexture`, `GPUTextureView`,
  pass encoders, bind groups, callbacks, or renderer caches.
- The scene fixture does not introduce a hidden scene graph; its inline
  glTF-derived data is converted into typed assets and ECS components before
  rendering.
- Shader IBL sampling, shadow texture allocation, shadow pass submission, shadow
  matrix packing, and StandardMaterial shadow sampling are still explicitly
  deferred through JSON-safe diagnostics.

## Corrective Action

No code correction was required. The backlog should continue with small
renderer-owned resource/pass planning slices before enabling visible IBL or
shadow sampling.

## Recommended Next Work

Start with a shadow texture/pass descriptor plan. It should stay data-only and
prove resource keys, attachment shape, clear/load/store policy, and deferred
submission diagnostics before creating live WebGPU shadow textures.
