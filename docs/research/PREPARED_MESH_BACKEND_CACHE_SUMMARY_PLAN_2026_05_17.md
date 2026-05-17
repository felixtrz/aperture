# Prepared Mesh Backend Cache Summary Plan - 2026-05-17

## Scope

Plan a JSON-safe WebGPU-private summary for prepared mesh GPU resources.

This is a planning slice only. It should not change app report fields until the
summary helper exists and has focused tests.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_QUEUED_PREPARED_RESOURCE_REPORT_PLAN_2026_05_17.md`
- `docs/research/APP_PREPARED_FACADE_REPORT_SHAPE_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Current State

The WebGPU mesh backend cache is
`PreparedMeshGpuResourceCache.resources: Map<string, PreparedMeshGpuResource>`.
Each cached resource records:

- `cacheKey`
- `sourceMeshKey`
- `sourceVersion`
- `layoutKey`
- `mesh`

The `mesh` field owns concrete GPU buffer resources, so it must not be exposed
through app reports or renderer-independent facades.

The app currently reports prepared mesh backend work only as per-frame counters:

- `preparedMeshBuffersCreated`
- `preparedMeshBuffersReused`

Those counters are useful, but they do not tell whether the backend cache has
retained stale entries after the snapshot-scoped `preparedMeshFacade` has been
pruned.

## Proposed Helper

Add a WebGPU-package helper next to `prepared-mesh-cache.ts` or inside that
module:

```ts
export interface PreparedMeshGpuResourceCacheSummaryLayout {
  readonly layoutKey: string;
  readonly entries: number;
}

export interface PreparedMeshGpuResourceCacheSummary {
  totalEntries: number;
  layouts: PreparedMeshGpuResourceCacheSummaryLayout[];
}

export function createPreparedMeshGpuResourceCacheSummary(): PreparedMeshGpuResourceCacheSummary;

export function writePreparedMeshGpuResourceCacheSummary(
  summary: PreparedMeshGpuResourceCacheSummary,
  cache: PreparedMeshGpuResourceCache,
): PreparedMeshGpuResourceCacheSummary;
```

The writer should:

- count `cache.resources.size`;
- group entries by `PreparedMeshGpuResource.layoutKey`;
- sort layout summaries by `layoutKey` for stable JSON/tests;
- mutate the caller-provided summary object so app reports can reuse report
  shells later;
- clear stale layout rows from a reused summary before writing new rows.

## Report Shape Boundary

The summary is backend-owned and WebGPU-private. It should report only counts
and stable logical layout keys.

Do not expose:

- `MeshGpuBufferResource`;
- GPU buffers;
- source `MeshAsset` objects or typed arrays;
- the cache `Map`;
- device, queue, command, bind group, or pipeline objects.

Do not merge this with `preparedMeshFacade`. The facade answers "which logical
mesh metadata is prepared for the current snapshot"; the backend summary
answers "what GPU mesh resources are currently retained by the backend cache."

Do not merge this with material, texture, sampler, light, or pipeline counters.
Those resources have different ownership and invalidation rules.

## Bevy Anchor

Bevy separates render mesh preparation from mesh GPU allocation. `RenderMesh`
is the render-asset representation, while `MeshAllocator` owns GPU buffer
allocation and freeing.

Aperture should keep the same conceptual split: renderer-independent prepared
mesh facade entries stay in the render package, while backend cache summaries
describe retained WebGPU mesh-buffer resources without exposing those resources.

## Implementation Follow-Up

Proceed with `task-0898`: add the summary helper and focused tests covering an
empty cache, a populated cache with multiple layout keys, and a cleared cache
summary. Keep the helper internal to `@aperture-engine/webgpu` unless a later
app-report task explicitly exports the type through a public report surface.
