# Prepared Mesh Backend Cache Last-Used Boundary Audit - 2026-05-17

## Scope

Audit the prepared mesh backend cache `lastUsedFrame` metadata added to the
WebGPU mesh cache.

The goal is to verify that frame-use metadata remains backend-private lifetime
state and does not leak into renderer-independent facades, render world, or app
JSON reports.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_LAST_USED_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/assets/preparation.ts`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Findings

### Metadata is backend-private

`lastUsedFrame` lives only on `PreparedMeshGpuResource`, the WebGPU backend
cache entry type. It is updated by `prepareMeshGpuResource()` on creation and
reuse.

The metadata is not added to:

- `PreparedMeshStore`;
- `PreparedMeshAssetMetadata`;
- `PreparedMeshStoreJsonValue`;
- `RenderWorldObject.gpu`;
- `RenderSnapshot`;
- ECS components or source mesh assets.

### App preparation passes frame context without changing authority

`prepareAppMeshResource()` accepts an optional `frame` and passes it to the
WebGPU mesh cache. The unlit, Matcap, and Standard app frame-resource helpers
thread their existing frame context into that call.

This updates backend lifetime metadata while leaving ECS state, source assets,
snapshots, and render facades unchanged.

### JSON reports remain count-only

`preparedMeshCache` still reports only total entries and per-layout counts.
Tests assert the app/cache JSON summaries do not contain `lastUsedFrame`.

This keeps frame-use metadata available for backend lifetime decisions without
turning app reports into a per-resource lifetime dump.

### Stale retained entries are covered

Focused cache tests prove:

- default `lastUsedFrame` is `0`;
- creation stores the supplied frame number;
- reuse updates `lastUsedFrame` without changing cache identity;
- source-version changes create a new retained entry while the older entry keeps
  its previous frame metadata.

### Bevy anchor

Bevy's mesh allocator owns GPU memory lifetime independently from source assets
and render asset extraction. Aperture's `lastUsedFrame` metadata follows the
same direction: cache lifetime decisions belong to the WebGPU backend cache, not
the ECS world or renderer-independent facade.

## Result

No ownership drift found.

The next useful slice is to plan a prepared mesh backend cache eviction report
that consumes `lastUsedFrame`, mirrors the prepared material cache eviction
shape, and remains separate from facade pruning.
