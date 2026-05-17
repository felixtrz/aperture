# Prepared Mesh Cache Handoff Plan - 2026-05-17

## Scope

Plan the smallest WebGPU-owned prepared mesh cache handoff.

This is a planning slice only. It does not change implementation behavior.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `packages/render/src/assets/preparation.ts`
- `packages/webgpu/src/webgpu/mesh-buffer-descriptors.ts`
- `packages/webgpu/src/webgpu/mesh-buffer-resources.ts`
- `packages/webgpu/src/webgpu/unlit-frame-resources.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `test/webgpu/mesh-buffer-resources.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current State

The app frame-resource helpers still create mesh GPU buffers as part of each
family frame resource:

```text
source MeshAsset
  -> mesh upload plan
  -> WebGPU vertex/index buffers
  -> frame resources
```

This is acceptable for the proof point, but it means mesh lifetime is coupled to
the current app frame route rather than a reusable prepared mesh store.

## Smallest Prepared Mesh Contract

Add a private WebGPU prepared mesh cache:

```ts
interface PreparedMeshGpuResource {
  readonly sourceMeshKey: string;
  readonly sourceVersion: number;
  readonly layoutKey: string;
  readonly mesh: MeshGpuBufferResource;
}
```

The first cache key should include:

- source mesh handle key;
- source mesh version;
- mesh vertex/index layout key or upload-plan layout signature;
- primitive topology only if the upload path later specializes buffers by
  topology.

The current `MeshGpuBufferResource` can remain the backend resource payload.

## Ownership Rules

The prepared mesh cache owns only WebGPU backend resources derived from a ready
`MeshAsset`.

It must not own:

- ECS entities;
- render packets;
- world transforms;
- material buffers or bind groups;
- draw sorting state;
- camera/view data;
- app lifecycle or command submission.

The cache should live in the WebGPU app resource cache during the proof point
and be shaped so a future render-world resource owner can take it over.

## Invalidation

Reprepare when any of these change:

- mesh handle key;
- mesh source version;
- upload layout signature;
- index format;
- vertex stream descriptors.

Do not invalidate because of:

- transform changes;
- material changes;
- light changes;
- frame number;
- view/camera changes;
- draw count.

## Diagnostics

The cache should surface existing mesh upload diagnostics:

- invalid mesh asset data;
- unsupported/missing vertex streams;
- invalid vertex or index buffer descriptors;
- WebGPU buffer creation failures.

Diagnostics should identify the source mesh handle and layout signature without
exposing raw buffer handles.

## Suggested Integration Order

1. Add direct cache helper tests for create/reuse/source-version invalidation.
2. Wire scalar unlit app frame-resource misses through the prepared mesh cache.
3. Extend Matcap and Standard frame-resource helpers after the unlit path is
   stable.
4. Update app route reports only if existing `meshBuffersCreated` /
   `meshBuffersReused` counters cannot describe the cache behavior.

## Non-Goals

- Do not combine mesh and material caches.
- Do not cache transforms in prepared mesh resources.
- Do not move source `MeshAsset` ownership into WebGPU.
- Do not add GLB-specific behavior in this cache.
- Do not expose a public mesh plugin API.

## Next Implementation Slice

Add a direct prepared mesh cache helper and tests before app-route integration.
