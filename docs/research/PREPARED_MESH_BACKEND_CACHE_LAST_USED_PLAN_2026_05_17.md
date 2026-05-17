# Prepared Mesh Backend Cache Last-Used Plan - 2026-05-17

## Scope

Plan `lastUsedFrame` metadata for WebGPU prepared mesh backend cache entries.

This is a planning slice only. It should not change runtime behavior until the
implementation task adds focused cache tests.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Current State

`PreparedMeshGpuResource` currently records:

- `cacheKey`
- `sourceMeshKey`
- `sourceVersion`
- `layoutKey`
- `mesh`

The app reports per-frame `preparedMeshBuffersCreated` and
`preparedMeshBuffersReused`, and now reports retained backend cache counts via
`preparedMeshCache`.

Unlike prepared material backend cache entries, mesh backend cache entries do
not yet record which frame most recently used each retained entry.

## Proposed Metadata

Add `lastUsedFrame: number` to `PreparedMeshGpuResource`.

Extend `PrepareMeshGpuResourceOptions` with:

```ts
readonly frame?: number;
```

Rules:

- new resources set `lastUsedFrame` to `options.frame ?? 0`;
- reused resources update `cached.lastUsedFrame = options.frame ?? 0` before
  returning the cached entry;
- cache identity remains keyed by `sourceMeshKey`, `sourceVersion`, and
  `layoutKey`;
- source-version changes still create a new retained cache entry, leaving the
  older entry with its previous `lastUsedFrame`.

This mirrors the prepared material cache route while keeping mesh cache
metadata WebGPU-private.

## Report Boundary

Do not add `lastUsedFrame` to `PreparedMeshStore`, `preparedMeshFacade`, or
render-world resource bindings.

The facade remains snapshot-scoped logical metadata. The backend cache entry
remains the only owner of backend lifetime metadata.

`preparedMeshCache` can continue reporting counts only. A later task may add
age/eviction reporting if the app needs it, but that should stay separate from
facade summaries and per-frame creation/reuse counters.

## Tests

The implementation follow-up should cover:

- created entries receive the supplied frame number;
- reused entries update `lastUsedFrame` without changing object identity;
- source-version changes create a new cache entry while the stale retained
  entry keeps its older `lastUsedFrame`;
- default frame metadata is `0` when no frame is provided;
- the metadata is not exposed through `preparedMeshFacade` JSON summaries.

## Bevy Anchor

Bevy's mesh allocator owns GPU buffer allocation/freeing separately from render
asset extraction/preparation. Aperture should likewise keep mesh backend cache
lifetime metadata in the WebGPU backend cache, not in ECS, snapshots, render
facades, or render world.

## Implementation Follow-Up

Proceed with `task-0905`: add the optional `frame` input, `lastUsedFrame`
metadata, and focused prepared mesh cache tests. Do not add eviction behavior
in the same slice; eviction should be a separate task after the metadata is
covered.
