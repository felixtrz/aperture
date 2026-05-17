# Combined Render World Prepared Resource Binding Audit - 2026-05-17

## Scope

Audit the combined render-world prepared resource binding helper added after
the mesh/material facade handoff work.

The goal is to verify that the helper composes existing render-package stages
without changing ECS authority, package boundaries, snapshot semantics, or GPU
resource ownership.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/COMBINED_RENDER_WORLD_PREPARED_RESOURCE_BINDING_PLAN_2026_05_17.md`
- `packages/render/src/rendering/render-world-prepared-resources.ts`
- `packages/render/src/rendering/render-world-prepared-meshes.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/render/src/rendering/render-world.ts`
- `test/rendering/render-world-prepared-resources.test.ts`
- `references/bevy/crates/bevy_render/src/erased_render_asset.rs`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Findings

### Snapshot application is centralized, not duplicated

`prepareAndBindSnapshotPreparedResourcesToRenderWorld()` calls
`renderWorld.applySnapshot(snapshot)` once, then prepares mesh and material
facade stores against the same immutable snapshot.

The helper does not call the family-specific high-level helpers that each apply
the snapshot. It composes the lower-level `prepareSnapshot...` and
`bindPrepared...` helpers instead.

### RenderWorld stores logical resource keys only

The combined helper delegates binding to the existing mesh and material
render-world binders. Those binders write only:

- `RenderWorldObject.gpu.meshResourceKey`
- `RenderWorldObject.gpu.materialResourceKey`

Both fields are strings or `null`. No WebGPU buffers, bind groups, textures,
samplers, devices, queues, pipelines, source mesh arrays, source material
payloads, or backend cache entries are stored in `RenderWorld`.

### ECS authority remains unchanged

The helper consumes a `RenderSnapshot` and an `AssetRegistry`. It does not read
or mutate the ECS world, create entities/components, author source assets, or
make render-world state authoritative.

This stays aligned with the North Star: ECS remains the source of truth and
rendering remains a derived view.

### Snapshot immutability is preserved

Focused tests assert source draw packets do not gain `meshResourceKey` or
`materialResourceKey` fields after combined binding.

The helper prepares facade metadata into `PreparedMeshStore` and
`PreparedMaterialStore`, then writes logical placeholders into `RenderWorld`;
the `RenderSnapshot` remains serializable and worker-boundary safe.

### Diagnostics remain family-specific

Missing source assets still report `renderAsset.sourceMissing`. Missing
prepared facade entries still report:

- `renderWorld.missingPreparedMeshResource`
- `renderWorld.missingPreparedMaterialResource`

The combined helper returns both family reports and a concatenated diagnostic
list, so callers can inspect the precise stage/family without losing the
simple aggregate path.

### Package boundary is preserved

The new module lives in `@aperture-engine/render` and imports only simulation
and render-package modules. It does not import `@aperture-engine/webgpu`.

WebGPU backend caches and app report counters remain in the WebGPU package.

## Result

No ownership or package-boundary drift found.

The next useful slice is to plan prepared mesh backend cache `lastUsedFrame`
metadata so backend mesh cache lifetime reporting can eventually match the
prepared material cache route without changing facade semantics.
