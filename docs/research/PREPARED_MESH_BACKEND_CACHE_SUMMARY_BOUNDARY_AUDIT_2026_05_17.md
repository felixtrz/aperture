# Prepared Mesh Backend Cache Summary Boundary Audit - 2026-05-17

## Scope

Audit the prepared mesh backend cache summary helper and WebGPU app report
integration.

The goal is to verify that backend mesh cache reporting remains separate from
snapshot-scoped prepared mesh facade reporting and does not expose WebGPU
resources.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_SUMMARY_PLAN_2026_05_17.md`
- `docs/research/APP_PREPARED_FACADE_REPORT_SHAPE_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/assets/preparation.ts`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Findings

### Backend cache summary exposes counts only

`PreparedMeshGpuResourceCacheSummary` reports:

- `totalEntries`
- `layouts[].layoutKey`
- `layouts[].entries`

It does not expose `PreparedMeshGpuResource.mesh`, `MeshGpuBufferResource`,
GPU buffers, source `MeshAsset` payloads, typed arrays, the cache `Map`, device
objects, queues, bind groups, or pipeline state.

Focused tests cover empty, populated, and cleared summaries and assert that the
JSON output does not contain representative GPU/source payload markers.

### App report keeps facade and backend scopes separate

`WebGpuAppResourceReuseReport` now has both:

- `preparedMeshFacade`: renderer-independent, snapshot-pruned logical mesh
  metadata;
- `preparedMeshCache`: WebGPU-private retained backend cache counts.

The stale-pruning app regression proves a hidden mesh is removed from
`preparedMeshFacade` while `preparedMeshCache.totalEntries` remains retained.
That is the intended distinction: current snapshot readiness is not the same as
backend GPU cache lifetime.

### Material, texture, sampler, light, and pipeline counts remain separate

The new `preparedMeshCache` field counts only entries in
`PreparedMeshGpuResourceCache.resources`. It does not include:

- `preparedMaterialCache`;
- material buffer or bind-group counters;
- texture resource counters;
- sampler resource counters;
- light buffer counters;
- pipeline hits/misses.

This keeps report consumers from interpreting one resource family as a generic
prepared-resource bucket.

### Package boundary is preserved

The helper lives in `@aperture-engine/webgpu` next to the WebGPU mesh backend
cache. The render package still owns only the renderer-independent
`PreparedMeshStore` facade and JSON-safe facade summaries.

`@aperture-engine/render` does not import WebGPU and cannot observe backend
mesh buffers or backend cache entries.

### Bevy anchor

Bevy keeps render mesh preparation and mesh allocator ownership distinct. Its
mesh allocator owns GPU buffer allocation/freeing, while render assets describe
prepared render-side mesh state.

Aperture's new report follows the same split: render facades expose logical
prepared mesh metadata, while WebGPU reports retained backend cache counts
without leaking the actual GPU resources.

## Result

No ownership drift found.

The next useful slice is to continue tightening the prepared-resource report
surface around combined helper/report ergonomics, while keeping facade
readiness, backend caches, and per-frame counters separately named.
