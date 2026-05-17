# Render World Prepared Mesh Binding Plan - 2026-05-17

## Scope

Plan the render-package helper that binds prepared mesh facade resource keys
into `RenderWorld` objects.

This is the mesh counterpart to the existing prepared material binding helper.
It should not allocate WebGPU resources or make `RenderWorld` authoritative.

## References Inspected

- `packages/render/src/rendering/render-world-prepared-materials.ts`
- `packages/render/src/rendering/render-world.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/snapshot-prepared-meshes.ts`
- `docs/research/PREPARED_MESH_FACADE_QUEUE_KEY_HANDOFF_AUDIT_2026_05_17.md`
- `references/bevy/crates/bevy_render/src/mesh/mod.rs`
- `references/bevy/crates/bevy_render/src/mesh/allocator.rs`

## Proposed Helper

Add `render-world-prepared-meshes.ts` in `@aperture-engine/render` with:

```ts
bindPreparedMeshResourcesToRenderWorld({
  renderWorld,
  meshes,
});
```

The helper should:

- iterate `renderWorld.listObjects()`;
- look up each object's `packet.mesh` in `PreparedMeshStore`;
- write `prepared.prepared.meshResourceKey` into
  `RenderWorld.updateResourceBindings(renderId, { meshResourceKey })`;
- skip unchanged objects;
- clear stale `meshResourceKey` values when the prepared mesh entry is missing;
- emit `renderWorld.missingPreparedMeshResource` diagnostics for missing
  entries.

Add a combined convenience helper:

```ts
prepareAndBindSnapshotMeshesToRenderWorld({
  registry,
  snapshot,
  renderWorld,
  meshes,
});
```

This should apply the snapshot, call `prepareSnapshotMeshes()`, bind mesh keys,
and return apply/preparation/binding diagnostics in the same shape as the
material helper.

## Ownership Rules

The helper may store only logical strings such as:

```text
prepared-mesh:mesh:cube
```

It must not store:

- source `MeshAsset` objects;
- vertex/index arrays;
- WebGPU buffers;
- upload descriptors;
- WebGPU devices, queues, pipelines, bind groups, or cache entries.

WebGPU buffer creation remains in `prepareAppMeshResource()` and
`prepareMeshGpuResource()`.

## Tests

Add focused render-world tests mirroring material binding coverage:

- preparing a snapshot mesh and binding its `meshResourceKey`;
- preserving snapshot immutability;
- keeping draws blocked until material keys are also available;
- clearing stale mesh keys when a prepared entry is missing;
- JSON safety checks that reports and `RenderWorld` object lists do not contain
  GPU handles or typed-array source data.

## Follow-Up

`task-0892` should implement this helper in `packages/render` and targeted
render-world tests.
