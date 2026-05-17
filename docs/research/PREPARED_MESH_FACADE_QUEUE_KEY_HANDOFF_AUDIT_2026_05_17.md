# Prepared Mesh Facade Queue-Key Handoff Audit - 2026-05-17

## Scope

Audit the prepared mesh facade and first WebGPU app queue-key handoff.

This verifies that logical mesh resource keys now come from a
renderer-independent facade while WebGPU vertex/index buffers and backend cache
state remain WebGPU-owned.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/PREPARED_MESH_FACADE_QUEUE_KEY_HANDOFF_PLAN_2026_05_17.md`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/prepared-mesh-queue-resolver.ts`
- `packages/render/src/rendering/snapshot-prepared-meshes.ts`
- `packages/render/src/rendering/prepared-material-queue-resolver.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Findings

### Render package remains renderer-independent

`PreparedMeshStore` stores `PreparedMeshAssetMetadata` only:

- source mesh key
- logical prepared mesh resource key
- label
- vertex stream count
- submesh count
- index-buffer presence

The metadata is derived from source `MeshAsset` validation and shape. It does
not include source vertex arrays, index arrays, WebGPU buffers, upload
descriptors, bind groups, devices, queues, or cache entries.

`preparedMeshStoreSummaryToJsonValue()` emits counts and stable string keys
only. Tests assert the summary omits raw typed arrays and GPU/backend handles.

### First queue pass now uses facade mesh keys

The queued built-in WebGPU route prepares snapshot meshes through
`prepareSnapshotMeshes()` before building the material queue. The first
`writeMaterialQueueFromSnapshot()` pass now resolves:

- `meshResourceKey` from `createPreparedMeshQueueResourceKeyResolver()`
- `materialResourceKey` from `createPreparedMaterialQueueResourceKeyResolver()`

Queue items therefore carry logical render-package keys such as
`prepared-mesh:mesh:mesh-1` and `prepared-material:material:standard-material-1`
before WebGPU frame-resource preparation.

### WebGPU mesh buffers remain backend-owned

The route still indexes ready source mesh assets separately and passes the
source-version cache key into WebGPU frame-resource helpers. Those helpers still
call `prepareAppMeshResource()` and `prepareMeshGpuResource()` in the WebGPU
package to create or reuse vertex/index buffers.

Backend mesh buffer counters remain `preparedMeshBuffersCreated` and
`preparedMeshBuffersReused`. The new `preparedMeshFacade` report is separate
JSON-safe facade metadata and does not replace the WebGPU backend cache.

### Material and mesh facade summaries are parallel but separate

The app report now has:

- `preparedMeshFacade`: renderer-independent mesh metadata summary
- `preparedMaterialFacade`: renderer-independent material metadata summary
- `preparedMaterialCache`: WebGPU-private backend material cache counts
- existing WebGPU mesh/material/texture/sampler resource counters

This keeps facade readiness and backend resource reuse inspectable without
mixing ownership.

### Bevy anchor

Bevy separates prepared mesh asset data and mesh allocation work. `RenderMesh`
is prepared from extracted mesh assets, while `MeshAllocator` processes removed
and newly extracted meshes to allocate or free GPU buffer ranges.

Aperture's facade is intentionally smaller, but the boundary matches the same
direction: renderer-independent mesh metadata and logical keys sit ahead of
WebGPU-owned buffer allocation.

## Result

No architecture drift found.

The next useful slice is to bind prepared mesh facade keys into `RenderWorld`
objects the same way prepared material facade keys are already bound, then
audit that render-world binding still stores only logical string resource keys.
