# Prepared Material Facade Stale Entry Cleanup Plan - 2026-05-17

## Scope

Define whether and when renderer-independent prepared material facade entries
should be removed when no current render snapshot references them.

This is a planning slice only. It does not change runtime code or backend cache
eviction behavior.

## References Inspected

- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/snapshot-prepared-materials.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Current State

`PreparedMaterialStore` supports explicit `remove()` and `clear()` calls. It
also removes an entry when a referenced source material is missing, pending, or
failed during `prepare()`.

`prepareSnapshotMaterials()` prepares each distinct material handle referenced
by the current snapshot. It does not remove entries for materials that were
prepared in a prior frame but are no longer referenced by the current snapshot.

That means the current facade summary can include historical entries after a
material is removed from all visible renderables. This is acceptable while the
summary is only a coarse report, but it becomes misleading once the facade is
used as the first material queue contract.

## Decision

The renderer-independent prepared material facade should have snapshot-scoped
cleanup for app/frame reporting and queue handoff.

When a render path prepares facade entries from a concrete `RenderSnapshot`, it
should be able to prune facade entries whose source material keys are not
referenced by that snapshot. This keeps the facade aligned with the derived
render state that queueing consumes.

Backend WebGPU caches should not be pruned by this cleanup. Backend cache
eviction is a separate policy because those caches own GPU buffers, bind groups,
textures, samplers, and pipeline-adjacent resource identity.

## Proposed Implementation Shape

Add a render-package helper or option around `prepareSnapshotMaterials()`:

```text
prepareSnapshotMaterials(..., { pruneUnreferenced: true })
  -> collect material keys from snapshot
  -> prepare referenced materials
  -> remove PreparedMaterialStore entries not in the snapshot key set
  -> report prepared/unchanged/retry/failed/skipped/pruned counts
```

The default can remain non-pruning until the WebGPU app route switches the first
queue pass to prepared facade keys. The WebGPU app can opt into pruning when it
uses the facade summary as frame/report state.

## Report Contract

The cleanup report should expose:

- `totalMaterials`: distinct materials referenced by the current snapshot.
- `pruned`: facade entries removed because they are no longer referenced.
- Per-entry diagnostics only for preparation failures, not for normal pruning.
- A JSON-safe summary that never includes source assets or backend resource
  objects.

Pruning should not count as a backend cache miss, backend cache eviction, texture
resource deletion, sampler resource deletion, or bind group deletion.

## Backend Cache Boundary

This plan does not remove or invalidate:

- WebGPU prepared unlit/Matcap/Standard material cache entries.
- Material uniform buffers.
- Material bind groups.
- Texture or sampler GPU resources.
- Pipeline resources.
- StandardMaterial light buffers or group-3 bind groups.

Those resources need a later WebGPU cache eviction policy with different
acceptance criteria: size limits, last-used frame tracking, invalidation on
source/dependency version changes, and explicit diagnostics.

## Follow-Up Task Shape

```md
### task-next - Prune snapshot-stale prepared material facade entries

Category: `render-bridge`
Package/write-scope: `packages/render`, WebGPU app report integration only if
the helper is ready, and focused tests.
Reference anchor:
`PREPARED_MATERIAL_FACADE_STALE_ENTRY_CLEANUP_PLAN_2026_05_17.md`,
`prepareSnapshotMaterials`, `PreparedMaterialStore.remove/clear`, and Bevy
render asset removal patterns.

Acceptance criteria:

- Snapshot preparation can remove prepared material facade entries that are no
  longer referenced by the current snapshot.
- The cleanup report includes a `pruned` count without treating pruning as a
  preparation failure.
- Tests prove pruning does not affect WebGPU backend prepared material cache,
  texture/sampler resource counters, or GPU resource ownership.
```
