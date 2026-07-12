# Render Asset Preparation

Aperture separates source asset authoring from renderer-owned prepared assets,
under Aperture's TypeScript and worker-snapshot constraints.

## Boundary

Source assets live in typed collections backed by `AssetRegistry`:

- `MeshAsset`
- `MaterialAsset` for built-ins
- `CustomWgslMaterialAsset` for data-only custom WGSL materials
- `WgslShaderAsset`
- `BufferAsset` (asset kind `"buffer"`): renderer-independent buffer sources
  with a typed element schema, element count, `read-only-storage` usage, and
  optional typed-array initial data
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
The app route supports uniform-buffer, storage-buffer, texture, and sampler
material bindings, plus existing instance-attribute layouts through the draw
path. Storage-buffer declarations reference a `BufferAsset` handle; the WebGPU
backend realizes it as a cached read-only `GPUBuffer` (keyed by handle id +
source version, `STORAGE | COPY_DST` usage) and diagnoses missing, not-ready,
and mis-sized buffer dependencies. Element strides are std430-style for
storage arrays — which is why `vec3f` element schemas are rejected at
validation (16-byte stride vs 12-byte packed data) in favor of `vec4f`. Keyed
`RuntimeBuffer` packets (extraction mirror of `RuntimeUniform`, DECISIONS.md 0022) stream element-range updates into the cached buffer via
`queue.writeBuffer` with zero pipeline rebuilds; shared-array-buffer snapshot
transports fall back to transferable snapshots when runtime-buffer packets are
present, exactly like runtime uniforms.
