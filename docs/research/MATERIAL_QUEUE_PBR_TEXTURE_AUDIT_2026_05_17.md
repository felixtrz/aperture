# Material Queue / PBR Texture Audit — 2026-05-17

## Scope

Audited the new material-family queue contract and the expanded
StandardMaterial texture path after:

- `task-0619` added snapshot-level material queue items.
- `task-0620` promoted StandardMaterial emissive and occlusion textures from
  deferred proof-point features to WebGPU-rendered features.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/POST_SHOWCASE_MATERIAL_ROUTE_AUDIT_2026_05_16.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`
- `references/bevy/crates/bevy_pbr/src/render/pbr_fragment.wgsl`
- `references/three.js/src/renderers/shaders/ShaderChunk/emissivemap_fragment.glsl.js`
- `references/engine/src/framework/parsers/glb-parser.js`

The common reference pattern is that material assets are extracted/prepared
before queueing, queue items identify pipeline/material/mesh routing data, and
PBR emissive/occlusion texture sampling belongs in the render backend rather
than in ECS or renderer-independent source assets.

## Findings

- `MaterialQueueItem` is a plain render-bridge contract. It stores stable
  strings, numbers, entity refs, topology, phase, and sort data. It does not
  store WebGPU handles, bind groups, pipelines, buffers, textures, samplers, or
  ECS entities.
- Queue construction starts from `RenderSnapshot.meshDraws` plus caller-provided
  prepared resource-key resolvers. This keeps the queue derived from extraction
  and prepared-resource metadata rather than direct ECS state or renderer-owned
  gameplay state.
- StandardMaterial emissive and occlusion texture support stays inside
  `@aperture-engine/webgpu` for shader generation, bind group resources,
  pipeline specialization, and app resource preparation. The renderer-independent
  material contract only exposes typed source handles and JSON-safe dependency
  data.
- Occlusion texture sampling follows the expected glTF-style red-channel path
  and applies `occlusionStrength` to ambient/indirect contribution only. Direct
  light math is unchanged.
- Emissive texture sampling multiplies the authored `emissiveFactor`, matching
  the common StandardMaterial/glTF pattern.
- Package-boundary validation passed. A scan for WebGPU imports/globals and
  scene-graph terminology in `packages/simulation`, `packages/render`,
  `packages/runtime`, and `packages/core` found no WebGPU leakage or mutable
  scene graph. The only `Scene` hits are typed `SceneHandle` asset helpers.

## Result

No architecture drift was found. The current state still matches the North Star:
ECS remains authoritative, rendering remains a derived view of ECS state, WebGPU
is the only backend, and the new queue/texture work remains package-scoped.

## Follow-Ups

- Integrate the material queue into opaque app routing so the current pairwise
  mixed-family branches do not grow further.
- Keep normal-map rendering deferred until tangent-space support is implemented.
- Add transparent phase sorting only after opaque queue consumption is in place.
