# Render Prepared Material Store Facade Boundary Audit - 2026-05-17

## Scope

Audit the renderer-independent prepared material store facade added to
`@aperture-engine/render`. The goal is to verify the facade does not introduce
WebGPU ownership, mutate source asset authority, or make `RenderWorld` store
anything beyond string resource bindings.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/render-world.ts`
- `test/assets/render-asset-preparation.test.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Findings

### Package Boundary

No drift found.

- `PreparedMaterialStore` lives in `@aperture-engine/render` and is exported
  through the existing render asset preparation module.
- The facade depends only on `AssetRegistry`, material handles,
  `PreparedRenderAssetStore`, and renderer-independent material descriptors.
- It does not import `@aperture-engine/webgpu`, WebGPU resource types, devices,
  queues, buffers, textures, samplers, bind groups, or app caches.

### Source Asset Authority

No drift found.

- `prepare()` reads source material state through the caller-provided
  `AssetRegistry`.
- Source asset registration, readiness, and mutation remain outside the facade.
- Source version changes flow through the existing `prepareRenderAsset()`
  contract and produce created/updated/unchanged outcomes on the prepared
  metadata entry.

### Render-World Boundary

No drift found.

- The facade stores `PreparedMaterialAssetMetadata`, which is JSON-safe material
  descriptor metadata.
- Tests bind `PreparedMaterialAssetMetadata.materialResourceKey` into
  `RenderWorldObject.gpu.materialResourceKey` as a string.
- `RenderWorld` still stores only snapshot packets and string GPU placeholders;
  it does not own prepared entries, GPU resources, buffers, bind groups, or app
  cache objects.
- `RenderSnapshot` remains unchanged and remains the immutable frame boundary.

### Public API Shape

Acceptable incremental surface.

- `createPreparedMaterialStore()` is a convenience facade over the already
  public `createPreparedMaterialAssetStore()` and
  `createMaterialMetadataRenderAssetAdapter()` APIs.
- Exposing `entries` keeps lower-level tests and advanced callers able to use
  the existing `PreparedRenderAssetStore` contract directly.
- A JSON-safe summary helper is still missing and is tracked separately as
  `task-0865`.

## Decision

The prepared material store facade is aligned with the North Star. It provides a
renderer-independent prepared material metadata store without moving WebGPU
resources into `@aperture-engine/render` or making the render world
authoritative.

Proceed with planning and integration tasks that bind facade entries to
render-world resource keys while keeping backend GPU preparation in
`@aperture-engine/webgpu`.

## Follow-Ups

- Keep `task-0862` for a render-world prepared material binding integration
  plan.
- Keep `task-0865` for a JSON-safe prepared material facade summary helper.
- Keep WebGPU prepared material caches private to the backend until a later
  explicit backend-store handoff slice.
