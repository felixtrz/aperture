# Prepared Mesh Facade Queue-Key Handoff Plan - 2026-05-17

## Scope

Plan whether a renderer-independent prepared mesh facade should exist before
the first WebGPU app material queue pass stops using source mesh cache keys.

This is a planning slice only. It does not change queue behavior or GPU resource
ownership.

## References Inspected

- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/prepared-app-mesh-resource.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Current State

The first queued built-in app material pass now resolves material resource keys
from `PreparedMaterialStore` facade descriptors. Mesh resource keys still come
from source mesh asset cache keys such as `mesh:foo@version`.

The WebGPU backend already has prepared mesh GPU caches:

- `prepareAppMeshResource()` parses the source-version cache key.
- `prepareMeshGpuResource()` creates or reuses vertex/index GPU buffers.
- Concrete WebGPU mesh resource keys are used for the second queue pass and
  frame-plan assembly.

The render package has `PreparedMeshAssetMetadata`, but it does not yet expose a
`PreparedMeshStore` facade, a snapshot preparation helper, or a material queue
mesh resource key resolver matching the material facade path.

## Decision

Add a renderer-independent prepared mesh facade before replacing source mesh
cache keys in the first queue pass.

The facade should describe mesh metadata and logical resource identity only. It
must not own vertex buffers, index buffers, upload buffers, or WebGPU resource
objects.

## Proposed Shape

1. Add `PreparedMeshStore` in `@aperture-engine/render`, backed by
   `PreparedRenderAssetStore<"mesh", PreparedMeshAssetMetadata>`.
2. Add `prepareSnapshotMeshes()` that prepares each distinct mesh handle in a
   `RenderSnapshot`.
3. Add a JSON-safe summary helper for prepared mesh facade entries.
4. Add `createPreparedMeshQueueResourceKeyResolver()` for
   `MaterialQueueResourceKeyResolvers["meshResourceKey"]`.
5. Keep WebGPU `prepareMeshGpuResource()` and `PreparedMeshGpuResourceCache`
   backend-owned.
6. Only after the facade exists, switch the first WebGPU queue pass to resolve
   both mesh and material resource keys from render-package prepared facades.

## Logical Keys

The render facade should emit stable logical keys such as:

```text
prepared-mesh:mesh:box
```

The WebGPU backend should bridge that logical key to concrete GPU buffer
resources:

```text
prepared-mesh:mesh:box
  -> WebGPU prepared mesh cache entry
  -> vertex/index buffer resource keys
```

## Backend-Owned State

These remain WebGPU-owned:

- Vertex buffers.
- Index buffers.
- Upload/write-buffer behavior.
- Mesh layout to GPU buffer descriptors.
- Prepared mesh GPU cache keys.
- Cache eviction and last-used metadata.

## Follow-Up Task Shape

```md
### task-next - Add renderer-independent prepared mesh store facade

Category: `render-bridge`
Package/write-scope: `packages/render` and focused tests.
Reference anchor:
`PREPARED_MESH_FACADE_QUEUE_KEY_HANDOFF_PLAN_2026_05_17.md`,
`PreparedRenderAssetStore`, `PreparedMeshAssetMetadata`, and Bevy
`RenderAssets<RenderMesh>` patterns.

Acceptance criteria:

- `PreparedMeshStore` can prepare, list, remove, and clear mesh metadata entries.
- A JSON-safe prepared mesh summary omits source asset objects and backend
  buffers.
- Tests cover create/update/remove/clear and invalid mesh diagnostics.
```

```md
### task-next - Resolve first queue mesh keys from prepared mesh facade

Category: `webgpu-render`
Package/write-scope: WebGPU app queue collection and focused material queue/app
tests.
Reference anchor:
`PREPARED_MESH_FACADE_QUEUE_KEY_HANDOFF_PLAN_2026_05_17.md`,
`createPreparedMeshQueueResourceKeyResolver`, and current prepared material
facade queue-key route.

Acceptance criteria:

- The first WebGPU app queue pass resolves mesh and material resource keys from
  renderer-independent prepared facades.
- WebGPU vertex/index buffers remain backend-owned and are still resolved before
  frame-plan assembly.
- Tests prove backend mesh buffer counters remain separate from facade summaries.
```
