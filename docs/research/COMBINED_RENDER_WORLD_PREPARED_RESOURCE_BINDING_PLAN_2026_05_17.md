# Combined Render World Prepared Resource Binding Plan - 2026-05-17

## Scope

Plan the smallest render-package helper that prepares and binds prepared mesh
and material facade resource keys into `RenderWorld` together.

This is a planning slice only. It should not change runtime behavior until the
implementation task adds tests.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `packages/render/src/rendering/render-world-prepared-meshes.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/render/src/rendering/render-world.ts`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_SUMMARY_BOUNDARY_AUDIT_2026_05_17.md`
- `references/bevy/crates/bevy_render/src/erased_render_asset.rs`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Current State

The render package already has separate helpers:

- `prepareAndBindSnapshotMeshesToRenderWorld()`
- `bindPreparedMeshResourcesToRenderWorld()`
- `prepareAndBindSnapshotMaterialsToRenderWorld()`
- `bindPreparedMaterialResourcesToRenderWorld()`

Each `prepareAndBind...` helper applies the snapshot to `RenderWorld` before
preparing and binding its own resource family. Calling both high-level helpers
would apply the same snapshot twice.

That is acceptable for tests but is not the intended shape for a combined
render-world preparation stage. A combined helper should apply the snapshot
once, prepare both facade stores, bind both logical resource-key families, and
return distinct reports.

## Proposed Helper

Add a new render module, for example
`packages/render/src/rendering/render-world-prepared-resources.ts`.

Proposed API:

```ts
export interface PrepareAndBindSnapshotPreparedResourcesToRenderWorldOptions {
  readonly registry: AssetRegistry;
  readonly snapshot: RenderSnapshot;
  readonly renderWorld: RenderWorld;
  readonly meshes: PreparedMeshStore;
  readonly materials: PreparedMaterialStore;
}

export interface PrepareAndBindSnapshotPreparedResourcesToRenderWorldReport {
  readonly apply: RenderWorldApplyReport;
  readonly meshes: {
    readonly preparation: PrepareSnapshotMeshesReport;
    readonly binding: BindPreparedMeshResourcesToRenderWorldReport;
  };
  readonly materials: {
    readonly preparation: PrepareSnapshotMaterialsReport;
    readonly binding: BindPreparedMaterialResourcesToRenderWorldReport;
  };
  readonly diagnostics: readonly RenderDiagnostic[];
}
```

The helper should:

1. call `renderWorld.applySnapshot(snapshot)` once;
2. call `prepareSnapshotMeshes()` and `prepareSnapshotMaterials()` against the
   same snapshot;
3. call `bindPreparedMeshResourcesToRenderWorld()` and
   `bindPreparedMaterialResourcesToRenderWorld()` after preparation;
4. concatenate diagnostics in stage order: apply, mesh preparation, material
   preparation, mesh binding, material binding.

## Boundary Rules

The combined helper must stay in `@aperture-engine/render` and remain
WebGPU-free.

It may write only logical string placeholders to `RenderWorldObject.gpu`:

- `meshResourceKey`
- `materialResourceKey`

It must not store or expose:

- source `MeshAsset` or material asset payloads;
- WebGPU buffers, textures, samplers, bind groups, devices, queues, pipelines,
  command encoders, or backend cache entries;
- renderer-owned ECS/game state.

The helper must not mutate `RenderSnapshot`. Snapshot packets should remain
serializable and worker-boundary safe.

Missing resource diagnostics should remain family-specific:

- `renderWorld.missingPreparedMeshResource`
- `renderWorld.missingPreparedMaterialResource`

Do not collapse them into a generic missing-resource diagnostic unless a later
diagnostic taxonomy task proves the generic code is more actionable.

## Tests

The implementation follow-up should add focused render tests covering:

- successful combined mesh/material preparation and binding;
- single snapshot application count with both resource keys populated;
- missing mesh and missing material behavior with distinct diagnostics;
- stale mesh/material key clearing through the existing family-specific binders;
- no mutation of `RenderSnapshot.meshDraws`.

## Bevy Anchor

Bevy render app stages separate extraction, preparation, queueing, and GPU
resource ownership. Multiple resource families are prepared in the render app,
but ECS source state remains authoritative and GPU buffers remain backend-owned.

Aperture's combined helper should follow that shape at a smaller scale:
centralize render-world facade binding order without changing ownership.

## Implementation Follow-Up

Proceed with `task-0902`: add the combined helper, export it from the render
package rendering index, and cover it with focused tests. Keep existing mesh
and material helpers intact; the combined helper should compose them rather
than replacing the family-specific APIs.
