# Prepared Mesh Backend Cache Eviction Report Plan - 2026-05-17

## Scope

Plan a WebGPU-private prepared mesh backend cache eviction helper and
JSON-safe report.

This is a planning slice only. It should not add an automatic app eviction
policy.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_LAST_USED_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `test/webgpu/prepared-built-in-material-store.test.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Proposed API

Add a helper to `prepared-mesh-cache.ts`:

```ts
export interface PreparedMeshGpuResourceCacheEvictionOptions {
  readonly currentFrame: number;
  readonly maxUnusedFrames: number;
}

export interface PreparedMeshGpuResourceCacheEvictionReport {
  readonly checked: number;
  readonly retained: number;
  readonly evicted: number;
  readonly skippedInUse: number;
}

export function evictPreparedMeshGpuResourceCacheEntries(
  cache: PreparedMeshGpuResourceCache,
  options: PreparedMeshGpuResourceCacheEvictionOptions,
): PreparedMeshGpuResourceCacheEvictionReport;
```

Use the same semantics as the prepared built-in material cache eviction helper:

- entries with `lastUsedFrame >= currentFrame` are counted as `skippedInUse`;
- entries where `currentFrame - lastUsedFrame <= maxUnusedFrames` are retained;
- older entries are deleted and counted as evicted;
- every entry considered increments `checked`.

## Boundary Rules

The helper is backend-owned and should remain in `@aperture-engine/webgpu`.

It must not mutate:

- source mesh assets;
- ECS state;
- `RenderSnapshot`;
- `PreparedMeshStore`;
- `preparedMeshFacade`;
- `RenderWorld` resource bindings.

The report should expose only counts. It should not expose:

- cache keys;
- `layoutKey`;
- source mesh keys;
- `MeshGpuBufferResource`;
- GPU buffers;
- typed arrays;
- cache `Map` instances.

Do not wire automatic eviction into every app frame in this task. A later app
policy task can decide when eviction should run and how its report should be
surfaced.

## Tests

The implementation follow-up should cover:

- empty cache reports all zero counts;
- entries used in the current/future frame are skipped as in-use;
- entries within the unused threshold are retained;
- entries older than the threshold are evicted;
- mixed cache entries produce correct counts and cache size;
- JSON output does not expose buffers or source mesh payloads.

## Bevy Anchor

Bevy's mesh allocator owns GPU memory lifetime and freeing separately from
render assets and source ECS state. Aperture should keep eviction similarly
backend-local: it can delete retained WebGPU mesh cache entries, but it must not
prune renderer-independent facade metadata or mutate extracted snapshots.

## Implementation Follow-Up

Proceed with `task-0908`: add the eviction helper and focused prepared mesh
cache tests. Keep app/report integration and automatic eviction policy out of
that slice unless a later task explicitly scopes them.
