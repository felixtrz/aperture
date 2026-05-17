# Prepared Mesh Backend Cache Eviction Boundary Audit - 2026-05-17

## Scope

Audit the prepared mesh backend cache eviction helper.

The goal is to verify that eviction deletes only backend WebGPU mesh cache
entries and does not mutate source assets, snapshots, render-world bindings, or
renderer-independent facade summaries.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_EVICTION_REPORT_PLAN_2026_05_17.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_EVICTION_APP_POLICY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/assets/preparation.ts`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Findings

### Eviction scope is backend-local

`evictPreparedMeshGpuResourceCacheEntries()` iterates only
`PreparedMeshGpuResourceCache.resources` and deletes entries from that map.

It does not receive or mutate:

- ECS worlds or components;
- source mesh assets;
- `AssetRegistry`;
- `RenderSnapshot`;
- `RenderWorld`;
- `PreparedMeshStore`;
- app facade state outside the passed backend cache.

### Report is JSON-safe and count-only

The eviction report exposes:

- `checked`
- `retained`
- `evicted`
- `skippedInUse`

It does not expose cache keys, source mesh keys, layout keys, source mesh
payloads, typed arrays, WebGPU buffers, devices, queues, bind groups, pipelines,
or the cache `Map`.

Focused tests assert representative GPU/source payload markers are absent from
the JSON report.

### Facade pruning remains separate

`preparedMeshFacade` remains snapshot-pruned in the app render path. Backend
eviction does not prune facade entries, and facade pruning does not delete
backend cache entries.

This distinction is now documented in the app-policy plan: `preparedMeshCache`
is retained backend cache count metadata; `preparedMeshFacade` is current
snapshot readiness metadata.

### No automatic app policy was introduced

The helper is available as a backend cache utility, but the app frame loop does
not automatically evict entries. That avoids introducing an arbitrary public
cache policy before material, texture, sampler, and pipeline cache lifetimes
share a common app-facing shape.

### Bevy anchor

Bevy's mesh allocator owns GPU memory allocation/freeing separately from ECS
source assets and render asset extraction. Aperture's helper follows that
direction: backend cache entries can be deleted without making GPU lifetime
state authoritative in ECS or render snapshots.

## Result

No ownership drift found.

The next useful work should return to the broader material/render pipeline
spine: either plan a generic app cache-lifetime policy across resource families
or continue toward material queue/report ergonomics without adding ad hoc mesh
policy APIs.
