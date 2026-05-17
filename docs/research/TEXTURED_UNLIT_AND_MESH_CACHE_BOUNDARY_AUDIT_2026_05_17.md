# Textured Unlit And Mesh Cache Boundary Audit - 2026-05-17

## Scope

Audit the current textured unlit prepared-resource helper, scalar unlit app-route
mesh cache wiring, and WebGPU-private prepared mesh cache before the next app
route handoff.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/PREPARED_MESH_CACHE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/TEXTURED_UNLIT_PREPARED_DEPENDENCY_HANDOFF_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/mesh-buffer-resources.ts`
- `packages/webgpu/src/webgpu/texture-resources.ts`
- Local references:
  - `references/engine/src/platform/graphics/vertex-buffer.js`
  - `references/engine/src/platform/graphics/index-buffer.js`
  - `references/engine/src/platform/graphics/webgpu/webgpu-buffer.js`
  - `references/three.js/src/renderers/webgpu/utils/WebGPUAttributeUtils.js`
  - `references/three.js/src/renderers/webgpu/WebGPUBackend.js`

## Findings

- Prepared mesh resources remain WebGPU-owned. `PreparedMeshGpuResource` stores
  source mesh key/version/layout metadata plus `MeshGpuBufferResource`; it does
  not store ECS entities, render packets, materials, transforms, view data, draw
  queues, or app lifecycle state.
- Scalar unlit app-route mesh cache wiring is renderer-derived. The cache key is
  computed from the ECS-authored mesh handle, source asset version, and upload
  layout signature. Transform, material, view, light, frame number, and draw
  count changes do not invalidate the prepared mesh resource.
- Textured unlit prepared material resources remain WebGPU-owned. The current
  direct helper consumes source material/version, texture/sampler source-version
  dependency keys, existing WebGPU texture/sampler resources, and group-2 layout
  metadata to create only the material uniform buffer and material bind group.
- Source assets remain authoritative. Meshes, materials, textures, and samplers
  are still read from `AssetRegistry` / typed collections; the WebGPU caches
  derive from ready source assets and do not replace registry status or source
  versions.
- Raw backend handles do not leak into render-layer contracts. The render-layer
  prepared material descriptor records logical material, bind-group, texture,
  and sampler resource keys; raw buffers, bind groups, textures, views, and
  samplers are present only in `packages/webgpu` resource types.
- Public app authoring APIs remain unchanged. Users still author ECS components
  and source assets; prepared mesh/material caches are private implementation
  details behind `createWebGpuApp`.
- Package boundary validation passes. `pnpm run check:boundaries` found no
  forbidden imports after the scalar unlit mesh-cache integration.

## Notes

- The current `WebGpuAppResourceReuseReport` now exposes prepared mesh
  create/reuse counters in addition to existing frame-resource mesh counters.
  This is JSON-safe and does not expose cache internals or raw GPU handles.
- `task-0812` can proceed without changing source asset ownership. It should
  only route textured unlit group-2 material resources through the existing
  WebGPU-private prepared unlit cache.
- `task-0813` remains useful for broader invalidation counter coverage across
  mesh, scalar material, textured material, texture, and sampler version
  changes.

## Outcome

No boundary drift was found. No follow-up task wording changes are required.
