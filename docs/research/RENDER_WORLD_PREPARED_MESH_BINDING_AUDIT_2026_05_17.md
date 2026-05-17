# Render World Prepared Mesh Binding Audit - 2026-05-17

## Scope

Audit the render-world prepared mesh binding helper added after the prepared
mesh facade queue-key handoff.

The goal is to verify that `RenderWorld` stores only logical mesh resource
keys, leaves snapshots immutable, and does not own WebGPU mesh buffers.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/RENDER_WORLD_PREPARED_MESH_BINDING_PLAN_2026_05_17.md`
- `packages/render/src/rendering/render-world-prepared-meshes.ts`
- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/render/src/rendering/render-world.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Findings

### RenderWorld stores logical strings only

`bindPreparedMeshResourcesToRenderWorld()` writes only
`PreparedMeshAssetMetadata.meshResourceKey` strings into
`RenderWorld.updateResourceBindings()`.

`RenderWorldObject.gpu.meshResourceKey` remains a `string | null` placeholder.
No source `MeshAsset`, typed vertex/index arrays, upload descriptors, WebGPU
buffers, devices, queues, bind groups, or prepared backend cache entries are
stored in `RenderWorld`.

### Snapshot immutability is preserved

`prepareAndBindSnapshotMeshesToRenderWorld()` applies the snapshot into
`RenderWorld`, prepares mesh facade metadata, then updates render-world resource
bindings. It does not mutate `RenderSnapshot.meshDraws`.

Focused tests assert source draw packets do not gain a `meshResourceKey` field.

### Missing prepared meshes clear stale keys

When a render-world object has no matching prepared mesh facade entry, the
helper:

- clears an existing stale `gpu.meshResourceKey`;
- preserves any material binding;
- reports `renderWorld.missingPreparedMeshResource`;
- leaves draw readiness blocked on `missing-mesh-resource`.

This mirrors the material binding helper and keeps stale logical keys from
making draw readiness look valid.

### WebGPU backend cache remains separate

Prepared mesh GPU resources still live in
`packages/webgpu/src/webgpu/prepared-mesh-cache.ts`. That backend cache owns
source-version/layout cache keys and concrete mesh buffer resources.

The render-world helper does not import the WebGPU package and cannot create,
reuse, evict, or destroy WebGPU buffers.

### Bevy anchor

Bevy's mesh path separates render asset preparation from GPU allocation and
freeing. `RenderMesh` is prepared from extracted mesh assets, while
`MeshAllocator` owns buffer allocation and freeing for extracted/removed
meshes.

Aperture's render-world mesh binding follows the same direction: logical
prepared mesh identity can be stored in render-world objects, while buffer
allocation remains backend-owned.

## Result

No ownership drift found.

The next useful test slice is to add app-level stale-pruning regressions proving
`preparedMeshFacade` is snapshot-scoped while WebGPU prepared mesh buffer
counters remain backend reuse counters.
