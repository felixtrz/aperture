# Generic Render-World Prepared Material Store API Plan - 2026-05-17

## Scope

Plan the smallest renderer-independent prepared material store API that can sit
between source material assets and the WebGPU-private prepared material store.
This is a planning task only; it does not move runtime ownership or change app
reports.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/RENDER_WORLD_PREPARED_MATERIAL_STORE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/render/src/rendering/render-world.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Reference Pattern

Bevy's `RenderAssets<A>` resource stores prepared render-side assets keyed by
source asset IDs. Preparation receives source assets, dependency state, previous
prepared assets, and can retry when dependencies are not available.

Aperture already has the renderer-independent half of this shape:

- `PreparedRenderAssetStore<TKind, TPrepared>` stores prepared metadata by
  source handle.
- `prepareRenderAsset()` removes stale entries for missing/not-ready sources,
  passes dependency state and previous entries to adapters, and records
  created/updated/skipped/retry/failed outcomes.
- `PreparedMaterialResourceDescriptor` captures material family, pipeline key,
  dependency keys, texture bindings, and JSON-safe readiness diagnostics without
  raw GPU handles.

The missing link is a render-world material store facade that makes prepared
material metadata easy to bind to `RenderWorld` objects before WebGPU prepares
backend resources.

## Proposed Minimal API

Add a renderer-independent `PreparedMaterialStore` facade in
`@aperture-engine/render` that wraps the existing
`PreparedRenderAssetStore<"material", PreparedMaterialResourceDescriptor>`.

Initial surface:

```ts
interface PreparedMaterialStore {
  readonly entries: PreparedRenderAssetStore<
    "material",
    PreparedMaterialResourceDescriptor
  >;
  get(
    handle: MaterialHandle,
  ):
    | PreparedRenderAssetEntry<"material", PreparedMaterialResourceDescriptor>
    | undefined;
  list(): PreparedRenderAssetEntry<
    "material",
    PreparedMaterialResourceDescriptor
  >[];
  prepare(
    registry: AssetRegistry,
    handle: MaterialHandle,
  ): RenderAssetPreparationReport<
    "material",
    PreparedMaterialResourceDescriptor
  >;
  remove(
    handle: MaterialHandle,
  ): PreparedRenderAssetStoreRemoval<
    "material",
    PreparedMaterialResourceDescriptor
  >;
  clear(): void;
}
```

The implementation should use a material adapter backed by
`createPreparedMaterialResourceDescriptor()` and should not add WebGPU imports.

## Render-World Binding Flow

The first vertical slice should update material resource bindings on
`RenderWorld` objects from prepared metadata keys, not GPU handles:

```text
AssetRegistry material handle + source version
  -> PreparedMaterialResourceDescriptor
  -> RenderWorldObject.gpu.materialResourceKey
  -> WebGPU prepared built-in material store lookup/preparation
  -> WebGPU bind group resources
```

`RenderWorldObject.gpu.materialResourceKey` should remain a string placeholder.
For the first slice, use the descriptor's `materialResourceKey` or
`bindGroupResourceKey` consistently with the existing draw readiness reports.
Do not put cache entries, GPU buffers, bind groups, or app resource objects into
the render world.

## Boundary Rules

Renderer-independent prepared material store may contain:

- source material handle/key and source version
- material family/kind
- pipeline key and pipeline key input
- logical material and bind group resource keys
- texture/sampler dependency keys
- dependency readiness diagnostics
- previous-entry/update metadata

Renderer-independent prepared material store must not contain:

- `GPUBuffer`, `GPUBindGroup`, `GPUTexture`, `GPUTextureView`, or `GPUSampler`
- WebGPU device/queue references
- frame-local packed view, transform, or light buffers
- Standard group-3 light resources
- app resource cache objects or WebGPU prepared material cache entries

WebGPU remains responsible for turning the descriptor and ready texture/sampler
GPU resources into backend-owned material buffers and bind groups.

## Unload And Invalidation

Use the existing `PreparedRenderAssetStore.remove()` and `clear()` semantics for
renderer-independent metadata.

Rules for the first runtime slice:

- Missing, loading, or failed source material entries remove the prepared
  metadata entry.
- Source material version changes update the metadata entry under the same
  source handle key.
- Texture/sampler source-version changes should be represented in dependency
  readiness and dependency keys, but WebGPU remains responsible for backend
  prepared-resource invalidation keyed by dependency versions.
- WebGPU prepared material caches may retain older backend entries until a
  later explicit unload/eviction slice; public reports should expose counts
  honestly.

## Tests For The First Runtime Slice

- Direct render package tests:
  - create an empty prepared material store
  - prepare unlit, Matcap, and Standard descriptors by material handle
  - update the same handle after a source material version change
  - remove entries when a source material is missing/not ready
  - verify listed entries and diagnostics are JSON-safe
- Render-world tests:
  - apply a snapshot, prepare material descriptors, and update
    `RenderWorldObject.gpu.materialResourceKey`
  - verify `createDrawReadinessReport()` changes from blocked to ready after
    mesh and material resource keys are bound
  - verify the render world stores only string resource keys
- Boundary tests:
  - `pnpm run check:boundaries`
  - `pnpm exec tsc --noEmit -p packages/render/tsconfig.json`
  - focused render-world/prepared material store tests

## Non-Goals

- Do not move WebGPU material buffers or bind groups into
  `@aperture-engine/render`.
- Do not make the render world own source assets.
- Do not change `RenderSnapshot` shape.
- Do not add a material plugin system.
- Do not evict WebGPU prepared material cache entries in this planning slice.

## Follow-Up Task Shape

```md
### task-next - Add render prepared material store facade

Category: `render-bridge`
Package/write-scope: `packages/render`, focused tests.
Reference anchor:
`docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`,
existing prepared render asset store, material resource descriptors, render
world binding placeholders, and Bevy `RenderAssets` prepared-resource pattern.

Acceptance criteria:

- `@aperture-engine/render` exposes a renderer-independent prepared material
  store facade backed by `PreparedRenderAssetStore`.
- Preparing material handles creates/updates JSON-safe
  `PreparedMaterialResourceDescriptor` entries without WebGPU imports.
- Tests cover prepare, update, remove, clear, and render-world material resource
  key binding behavior.
```
