# Render Asset Preparation

Aperture separates source asset authoring from renderer-owned prepared assets.
This follows Bevy's `RenderAsset` pattern conceptually while keeping Aperture's
TypeScript and worker-snapshot constraints.

## Boundary

Source assets live in typed collections backed by `AssetRegistry`:

- `MeshAsset`
- `MaterialAsset`
- future texture, sampler, scene, and animation assets

Render preparation reads ready source assets and writes prepared render metadata
or backend-owned resources into prepared stores. The preparation contract records:

- the stable source asset handle
- source asset version
- dependency readiness state
- previous prepared entry, when present
- prepare outcome: prepared, unchanged, retry, failed, or skipped
- unload/removal result

The contract lives in `@aperture-engine/render`; it must not expose WebGPU
handles. WebGPU upload code can consume prepared metadata later and produce
backend resources in `@aperture-engine/webgpu`.

## Bevy Mapping

Bevy's render asset path is:

```text
Assets<T>
  -> extracted changed assets
  -> RenderAsset::prepare_asset
  -> RenderAssets<TPrepared>
  -> unload on source removal
```

Aperture's current equivalent is:

```text
AssetRegistry + typed collections
  -> prepareRenderAsset(adapter, store, handle)
  -> PreparedRenderAssetStore
  -> unloadPreparedRenderAsset
```

Aperture does not copy Bevy's Rust trait or render-world ECS shape. The borrowed
parts are the separation between source asset data, dependency readiness,
prepared render data, and unload bookkeeping.

## Current Stores

The initial prepared stores are metadata-only:

- `createPreparedMeshAssetStore()`
- `createPreparedMaterialAssetStore()`

The material metadata adapter is sufficient for the near-term StandardMaterial
proof point because it records material kind, pipeline-key inputs, source
version, dependency readiness, and texture/sampler dependency keys without raw
GPU resources.

Future WebGPU preparation should add backend-owned resources as a later stage
derived from these renderer-independent contracts.
