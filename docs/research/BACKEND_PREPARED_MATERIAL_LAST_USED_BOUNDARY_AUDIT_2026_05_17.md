# Backend Prepared Material Last-Used Boundary Audit - 2026-05-17

## Scope

Audit the `lastUsedFrame` metadata added to WebGPU-private prepared material
backend cache entries.

This audit verifies that last-used tracking and future eviction stay backend
concerns and do not leak into renderer-independent prepared material facade
summaries, source asset state, or adjacent texture/sampler resource counters.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/WEBGPU_PREPARED_MATERIAL_BACKEND_CACHE_EVICTION_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/assets/preparation.ts`
- `references/bevy/crates/bevy_render/src/erased_render_asset.rs`

## Findings

### Metadata stays WebGPU-private

`lastUsedFrame` is stored only on WebGPU backend resource entries:

- `PreparedScalarUnlitMaterialResource`
- `PreparedMatcapMaterialResource`
- `PreparedScalarStandardMaterialResource`
- Standard textured prepared material resource variants inherited from the
  scalar resource shape

Those entries also retain WebGPU-owned resource handles through their material
buffer and bind group resource fields. They live behind
`PreparedBuiltInMaterialStore`, which is not exported from the public WebGPU
package surface.

The renderer-independent `PreparedMaterialStore` in `@aperture-engine/render`
stores `PreparedMaterialAssetMetadata` only. Its JSON helper emits source
version, family/kind, pipeline key, string resource keys, dependency counts,
texture binding counts, and diagnostic counts. It does not include
`lastUsedFrame`, cache map identity, raw buffers, bind groups, textures, or
samplers.

### Created and reused resources update last-used metadata

The unlit, Matcap, and Standard material preparation helpers set
`lastUsedFrame` when creating backend cache entries and update it when reusing
entries. The cache key still includes source material key, source version,
pipeline key, layout key, and texture/sampler dependency version segments when
applicable. This means source or dependency version changes create distinct
backend entries while older entries retain their older last-used frame until
they are reused or evicted.

This matches the eviction plan's first-stage goal and preserves the ability to
test stale backend retention separately from facade pruning.

### Backend cache counts and facade summaries remain separate

The WebGPU app report exposes two different prepared-material surfaces:

- `resourceReuse.preparedMaterialCache` is written from the WebGPU-private
  `PreparedBuiltInMaterialStore` and reports only per-family backend entry
  counts.
- `resourceReuse.preparedMaterialFacade` is written from
  `preparedMaterialStoreSummaryToJsonValue()` after snapshot-scoped facade
  preparation and pruning.

The backend summary helper counts map entries only. It does not expose
`lastUsedFrame` or eviction state. The facade summary is populated from the
render package store and remains snapshot-scoped.

### Texture and sampler counters remain separate

Prepared material backend cache keys can include texture and sampler dependency
version segments, and entries can record texture/sampler resource keys for bind
group creation. That does not transfer texture/sampler ownership into the
material cache.

The WebGPU app still reports texture and sampler resource reuse through
separate `textureResourcesCreated`, `textureResourcesReused`,
`samplerResourcesCreated`, and `samplerResourcesReused` counters. The eviction
helper in `prepared-built-in-material-store.ts` deletes prepared material cache
map entries only; it does not touch prepared texture or sampler caches.

### Bevy anchor

Bevy's render asset path keeps extracted/removed source asset events separate
from render-world prepared asset storage. `ErasedRenderAssets` owns GPU-facing
prepared assets and exposes removal from that render-side store, while
`prepare_erased_assets` handles removed assets and calls the render asset's
unload hook.

Aperture's current shape is smaller, but the ownership direction is aligned:
source assets and renderer-independent facade metadata stay outside WebGPU
cache eviction, while backend cache removal is a WebGPU-side concern.

## Result

No architecture drift found.

The next tests should focus on proving that source material and dependency
version changes create retained stale backend entries with older
`lastUsedFrame` values while the prepared material facade remains
snapshot-scoped and texture/sampler counters remain separate.
