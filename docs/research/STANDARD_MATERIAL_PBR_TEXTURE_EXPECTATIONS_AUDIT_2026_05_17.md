# StandardMaterial PBR Texture Expectations Audit - 2026-05-17

## Scope

Audited Aperture's current `StandardMaterial` texture behavior against the
near-term glTF metallic-roughness target after the queue-driven StandardMaterial
texture path and dependency diagnostics work.

Reference anchors inspected:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/STANDARD_MATERIAL_GLTF_PBR_TEXTURE_AUDIT_2026_05_17.md`
- `docs/research/STANDARD_MATERIAL_UV_TEXTURE_TRANSFORM_PLAN_2026_05_17.md`
- `references/three.js/examples/jsm/loaders/GLTFLoader.js`
- `references/engine/src/framework/parsers/glb-parser.js`
- `references/bevy/crates/bevy_gltf/src/material.rs`
- `references/bevy/crates/bevy_pbr/src/pbr_material.rs`

## Reference Pattern

The common pattern is:

- Base-color and emissive textures are color data and use sRGB sampling.
- Metallic-roughness, normal, and occlusion textures are data/linear inputs.
- Metallic-roughness uses one texture for roughness and metallic channels.
- Normal maps require tangent/normal/UV readiness.
- Texture `texCoord` and transform metadata affect material preparation and
  shader variants; they should not be silently dropped by import.
- Sampler state is part of texture readiness. three.js, PlayCanvas, and Bevy all
  resolve glTF sampler data before the material reaches GPU submission.

## Current Aperture Alignment

- `StandardMaterial` source assets cover the near-term five glTF texture slots:
  `baseColorTexture`, `metallicRoughnessTexture`, `normalTexture`,
  `occlusionTexture`, and `emissiveTexture`.
- WebGPU shaders sample the currently supported texture channels without making
  ECS own GPU textures, samplers, bind groups, or pipelines.
- Readiness diagnostics validate expected texture semantic/color-space metadata
  per slot and keep diagnostics JSON-safe with material key, field, texture key,
  status, and dependency kind.
- `task-0644` fixed a drift found during this audit: StandardMaterial extraction
  now validates sampler handles/statuses for every authored PBR texture channel
  before queueing a draw. Missing, loading, and failed sampler dependencies are
  now blocked before WebGPU preparation.
- Normal-map tangent readiness remains renderer-independent and blocks invalid
  normal-mapped draws before render submission.
- `TEXCOORD_0` and `TEXCOORD_1` are explicit. Unsupported higher UV sets are
  diagnosed, and missing mesh `TEXCOORD_1` attributes block extraction.

## Remaining Gaps

- `KHR_texture_transform` is still not represented in `MaterialTextureBinding`.
  GLB material mapping must preserve or diagnose this metadata before claiming
  support.
- Import-level glTF sampler conversion is not implemented yet. The runtime has
  sampler assets and readiness checks, but no GLB mapping from glTF sampler
  enums to Aperture sampler assets.
- IBL/environment lighting and shadow sampling are still deferred, so current
  StandardMaterial remains a direct-lit metallic-roughness MVP rather than full
  glTF PBR.
- Advanced glTF PBR extensions remain out of scope until the base pipeline and
  GLB material mapping path are stable.

## Result

No ECS/render ownership drift was found. The fixed sampler-readiness gap stayed
inside `packages/render` diagnostics and extraction tests; WebGPU resource
ownership remains inside `packages/webgpu`, and `RenderSnapshot` remains the
boundary between ECS authoring and renderer submission.

GLB material mapping should remain deferred until sampler import conversion and
texture-transform preservation/diagnostics are implemented as focused slices.
