# Render Asset Preparation

Aperture separates source asset authoring from renderer-owned prepared assets,
under Aperture's TypeScript and worker-snapshot constraints.

## Boundary

Source assets live in typed collections backed by `AssetRegistry`:

- `MeshAsset`
- `MaterialAsset` for built-ins
- `CustomWgslMaterialAsset` for data-only custom WGSL materials
- `WgslShaderAsset`
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

## Preparation Pipeline

Aperture's render asset path is:

```text
AssetRegistry + typed collections
  -> prepareRenderAsset(adapter, store, handle)
  -> PreparedRenderAssetStore
  -> unloadPreparedRenderAsset
```

The contract draws a clear line between source asset data, dependency readiness,
prepared render data, and unload bookkeeping.

## Current Stores

The initial prepared stores are metadata-only:

- `createPreparedMeshAssetStore()`
- `createPreparedMaterialAssetStore()`

The material metadata adapter now prepares a renderer-independent material
resource descriptor. It records the source material key, material family, stable
pipeline key, pipeline-key inputs, logical material/bind-group resource keys,
dependency readiness, and texture/sampler dependency keys without raw GPU
resources. The logical resource keys are suitable for material queue resource
resolution; the WebGPU backend still owns the actual buffers, textures, samplers,
bind groups, and pipeline handles.

Custom WGSL material preparation uses the same contract with a separate prepared
metadata shape. The adapter validates `customMaterialSource.*` source-shape
rules, resolves inline WGSL or a ready `WgslShaderAsset`, and writes JSON-safe
prepared metadata: source material key, family key, shader source key, shader
hash-derived module key, entry points, render state, binding layout, logical
material resource key, bind-group resource key, and dependency diagnostics.
Shader source assets are mirrored by handle/version; `GPUShaderModule` creation
remains in `@aperture-engine/webgpu`.

The WebGPU app route consumes prepared custom WGSL metadata to create
renderer-owned shader modules, pipelines, uniform buffers, and bind groups.
V1 supports uniform-buffer, texture, and sampler material bindings in the app
route, plus existing instance-attribute layouts through the draw path.
Storage-buffer declarations remain renderer-independent source data and must
produce clear unsupported-resource diagnostics until a renderer-independent
buffer source asset exists.
