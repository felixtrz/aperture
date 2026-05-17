# Render-World Prepared Material Store Handoff Plan - 2026-05-17

## Scope

Plan the smallest vertical slice for moving the current WebGPU app-local
prepared material caches toward render-world/prepared-asset ownership without
changing ECS authority, `RenderSnapshot` shape, or public app reports.

This is a handoff plan only. It does not move runtime code.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_PREPARATION_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/render/src/rendering/render-world.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/app.ts`
- Bevy anchors:
  - `references/bevy/crates/bevy_render/src/render_asset.rs`
  - `references/bevy/examples/shader_advanced/manual_material.rs`

## Reference Pattern

Bevy separates source assets, extracted changed assets, prepared render assets,
and draw-time material bindings. `RenderAssets<A>` is the render-world resource
that stores prepared resources keyed by source asset IDs, while material
preparation can retry when dependencies such as GPU images are not ready.

Aperture should borrow the separation, not Bevy's ECS sub-app shape:

```text
source material asset + source version
  -> renderer-independent prepared material descriptor
  -> backend-owned prepared material cache entry
  -> queue resource key / bind group resource key
  -> draw resource binding
```

## Current Aperture State

- `@aperture-engine/render` already has renderer-independent prepared material
  metadata stores via `createPreparedMaterialAssetStore()`.
- WebGPU owns app-local prepared material caches:
  - scalar/textured unlit material buffers and group-2 bind groups
  - Matcap material buffers and group-2 bind groups
  - scalar and currently covered textured Standard material buffers and group-2
    bind groups
- WebGPU texture and sampler resources are separate app-local caches and should
  remain separate dependencies.
- Standard group-3 light resources are frame-derived and must remain outside
  material cache ownership.
- `RenderSnapshot` remains the frame boundary; it carries draw packets and
  handles, not GPU resources or cache entries.

## Smallest Vertical Slice

Move only the prepared material store container first, not all preparation
logic.

1. Add a WebGPU-private `PreparedBuiltInMaterialStore` module that owns the
   current unlit, Matcap, and Standard prepared material caches as named
   family buckets.
2. Replace `WebGpuAppResourceCache.scalarUnlitMaterials`,
   `matcapMaterials`, and `scalarStandardMaterials` with one
   `preparedMaterials` store field.
3. Keep the existing family preparation helpers and adapter table. They should
   receive the family cache from `preparedMaterials` instead of receiving
   scattered cache fields directly.
4. Keep texture/sampler caches, prepared mesh caches, frame-resource cache
   slots, pipelines, layouts, and light resources where they are.
5. Preserve `WebGpuAppResourceReuseReport` semantics, including the prepared
   material cache summary counts added in the previous slice.

This slice creates the handoff shape needed for a later render-world store
without forcing an immediate `RenderWorld` API migration.

## Boundary Distinction

Renderer-independent prepared material metadata:

- source material key
- source version
- material family/kind
- pipeline key and pipeline-key input
- logical material resource key
- logical bind group resource key
- texture/sampler dependency keys and readiness
- JSON-safe diagnostics

WebGPU-owned prepared material resources:

- material uniform buffers
- group-2 material bind groups
- WebGPU bind group descriptors
- references to prepared texture views and sampler resources
- cache keys that include source material version and dependency versions

The first slice should keep the WebGPU-owned resources in
`@aperture-engine/webgpu`. A later render-world migration may expose a
renderer-owned prepared material store concept, but `@aperture-engine/render`
must not import or expose raw WebGPU handles.

## Tests For The First Slice

- Direct store tests:
  - creates empty unlit, Matcap, and Standard cache buckets
  - exposes JSON-safe family entry counts
  - does not expose raw GPU buffers, bind groups, textures, or samplers
- App route tests:
  - scalar unlit prepared material reuse still reports unchanged counters
  - Matcap prepared material reuse still reports unchanged counters
  - Standard prepared material reuse still reports unchanged counters
  - prepared material cache summary counts are unchanged before and after the
    store container refactor
- Boundary tests:
  - `pnpm run check:boundaries`
  - `pnpm exec tsc --noEmit -p packages/webgpu/tsconfig.json`
  - targeted WebGPU app and prepared material cache tests

## Non-Goals

- Do not move texture/sampler GPU resources into material cache ownership.
- Do not move Standard light buffers or group-3 bind groups into material cache
  ownership.
- Do not change `RenderSnapshot`.
- Do not make ECS/source assets own prepared material cache entries.
- Do not introduce a broad material plugin system in this slice.

## Follow-Up Task Shape

```md
### task-next - Add WebGPU prepared built-in material store container

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu`, focused tests.
Reference anchor:
`docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`,
current prepared unlit/Matcap/Standard material caches, and Bevy `RenderAssets`
prepared-resource storage pattern.

Acceptance criteria:

- One WebGPU-private store owns unlit, Matcap, and Standard prepared material
  cache buckets.
- App resource cache uses the store instead of three scattered material cache
  fields.
- Prepared material cache summary reports and existing reuse counters are
  unchanged.
```
