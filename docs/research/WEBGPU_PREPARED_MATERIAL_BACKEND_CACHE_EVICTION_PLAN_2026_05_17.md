# WebGPU Prepared Material Backend Cache Eviction Plan - 2026-05-17

## Scope

Plan eviction for WebGPU-private prepared material backend caches.

This is separate from renderer-independent prepared material facade pruning.
Facade pruning removes JSON-safe descriptor entries that are no longer
referenced by the current snapshot. Backend eviction removes or releases
WebGPU-owned resource cache entries.

## References Inspected

- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `docs/research/PREPARED_MATERIAL_FACADE_STALE_ENTRY_CLEANUP_PLAN_2026_05_17.md`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Current State

The backend prepared material store owns three family caches:

- Unlit prepared material resources.
- Matcap prepared material resources.
- Standard prepared material resources.

Each family cache keys entries by source material key, source material version,
pipeline key, layout key, and texture/sampler dependency version segments where
applicable.

This is intentionally different from the facade:

- The facade is keyed by source material handle and is pruned to snapshot
  relevance.
- The backend caches retain old entries across source/dependency version changes
  so reuse counters and current frame resources remain stable.

## Eviction Goals

Backend eviction should eventually:

- Remove superseded entries for the same source material after they are no
  longer used by any in-flight frame.
- Remove entries for source materials that are no longer referenced for a
  configurable number of frames.
- Remove entries for materials whose source asset has been removed, failed, or
  become unavailable.
- Keep texture/sampler resource cache eviction separate from material cache
  eviction.
- Report evictions separately from cache misses, facade pruning, and texture or
  sampler resource counters.

## Required Metadata

Before eviction is implemented, backend cache entries should record:

- `sourceMaterialKey`
- `sourceVersion`
- `pipelineKey`
- `layoutKey`
- dependency cache key segments
- `lastUsedFrame`
- optional approximate byte size once buffer sizing is exposed
- resource keys for the material buffer and material bind group

The existing entries already carry most identity metadata. The missing field is
`lastUsedFrame`. Byte size can remain deferred.

## Proposed Stages

1. Add `lastUsedFrame` metadata to prepared material resource entries when an
   entry is created or reused.
2. Add a JSON-safe eviction report type with per-family counts:
   `checked`, `retained`, `evicted`, and `skippedInUse`.
3. Add a non-destructive eviction helper that removes stale cache map entries
   after a frame is submitted. If resource wrappers do not expose `destroy()`,
   this stage should only drop cache references and must document that actual
   GPU lifetime remains browser/device-managed.
4. Add superseded-entry eviction for entries with the same source material key
   but older source or dependency version segments.
5. Add optional age-based eviction once frame numbers are reliable across app
   and lower-level render paths.

## Non-Goals

- Do not make the render package own WebGPU cache eviction.
- Do not merge backend eviction counts into
  `resourceReuse.preparedMaterialFacade`.
- Do not delete texture/sampler GPU resources when evicting only a material
  buffer or bind group.
- Do not add broad memory-pressure heuristics before basic last-used tracking
  exists.

## Follow-Up Task Shape

```md
### task-next - Track last-used frames for prepared material backend caches

Category: `webgpu-render`
Package/write-scope: WebGPU prepared material cache entry types, app frame
resource preparation, and focused cache tests.
Reference anchor:
`WEBGPU_PREPARED_MATERIAL_BACKEND_CACHE_EVICTION_PLAN_2026_05_17.md`, prepared
unlit/Matcap/Standard material caches, and Bevy render asset removal patterns.

Acceptance criteria:

- Created and reused prepared material backend cache entries record the app frame
  number in `lastUsedFrame`.
- Cache summaries remain unchanged unless explicitly extended with JSON-safe
  eviction metadata.
- Tests cover created and reused entries without changing facade pruning or
  texture/sampler counters.
```

```md
### task-next - Add prepared material backend cache eviction report

Category: `webgpu-render`
Package/write-scope: WebGPU prepared built-in material store and focused tests.
Reference anchor:
`WEBGPU_PREPARED_MATERIAL_BACKEND_CACHE_EVICTION_PLAN_2026_05_17.md` and
prepared material backend cache summary helpers.

Acceptance criteria:

- A WebGPU-only eviction helper reports checked, retained, evicted, and
  skipped-in-use counts by material family.
- Eviction removes backend cache map entries only, leaving facade entries and
  texture/sampler caches untouched.
- Tests prove backend eviction counts are not mixed into
  `preparedMaterialFacade` or texture/sampler resource counters.
```
