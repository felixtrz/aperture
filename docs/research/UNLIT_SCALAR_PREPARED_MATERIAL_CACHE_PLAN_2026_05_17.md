# Unlit Scalar Prepared Material Cache Plan - 2026-05-17

## Scope

Plan the smallest internal WebGPU prepared material cache slice for scalar
`UnlitMaterial`.

This is a planning slice only. It does not change implementation behavior.

## References Inspected

- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/PREPARED_MATERIAL_RESOURCE_CACHE_HANDOFF_PLAN_2026_05_17.md`
- `docs/research/APP_LOCAL_MATERIAL_RESOURCE_RENDER_WORLD_AUDIT_2026_05_17.md`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/webgpu/src/webgpu/unlit-material-buffer.ts`
- `packages/webgpu/src/webgpu/unlit-material-buffer-resource.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `test/webgpu/unlit-material-buffer-resource.test.ts`
- `test/webgpu/unlit-bind-group.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Smallest Contract

Add a private WebGPU cache for scalar unlit material resources:

```text
PreparedMaterialResourceDescriptor
  -> scalar unlit material uniform buffer
  -> scalar unlit group-2 bind group
  -> app frame resource assembly
```

Initial scope is deliberately scalar:

- `material.kind === "unlit"`;
- `baseColorTexture === null`;
- no texture or sampler dependencies;
- material uniform buffer and material bind group only;
- existing frame-owned mesh, view uniform, and world transform resources stay
  unchanged.

The cache should not become a public material plugin API. It should be an
internal WebGPU module that can later move from app ownership to render-world
ownership.

## Proposed Types

Suggested private module:

```text
packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts
```

Suggested resource:

```ts
interface PreparedScalarUnlitMaterialResource {
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: UnlitMaterialGpuBufferResource;
  readonly bindGroup: UnlitBindGroupResource;
}
```

Suggested cache:

```ts
interface PreparedScalarUnlitMaterialCache {
  readonly resources: Map<string, PreparedScalarUnlitMaterialResource>;
}
```

The cache key should include:

- `sourceMaterialKey`;
- `sourceVersion`;
- `pipelineKey`;
- selected material bind group `layoutKey`.

Using the layout key keeps the cached bind group tied to the selected pipeline
layout without making the cache own pipeline selection.

## Preparation Inputs

The preparation helper should receive explicit dependencies:

- source `AssetRegistry`;
- material handle and source version;
- `PreparedMaterialResourceDescriptor` or descriptor creation result;
- source `UnlitMaterialAsset`;
- WebGPU-like device;
- unlit material bind group layout resource for group 2;
- caller-owned cache and reuse/report counters.

The helper should reject or skip:

- missing/not-ready material source assets;
- non-unlit material family;
- invalid material validation;
- non-scalar unlit materials with texture/sampler dependencies;
- missing group-2 material layout;
- descriptor pipeline key/layout mismatch when detectable.

The render package descriptor remains renderer-independent. The WebGPU cache
owns only raw backend resources.

## Invalidation Keys

Reprepare when any of these change:

- material handle key;
- material source version;
- material family;
- pipeline key;
- group-2 material layout key.

Do not include view uniform data, world transform data, light packets, camera
data, frame number, or mesh handles in the prepared material cache key.

Texture and sampler dependency versions are out of scope for this scalar slice.
The textured unlit follow-up should extend the key with dependency handle/version
pairs after scalar behavior is covered.

## Report Fields

Add internal app/resource reuse counters first, keeping public report JSON-safe:

- `preparedMaterialResourcesCreated`;
- `preparedMaterialResourcesReused`;
- `preparedMaterialResourcesInvalidated` or `preparedMaterialResourceMisses`
  only if the implementation can report this without ambiguity;
- diagnostics from descriptor creation, scalar-scope validation, material buffer
  creation, and bind group creation.

If adding new public report counters would expand too much API surface, keep the
first implementation assertions inside focused tests and reuse existing
`materialBuffersCreated`, `materialBuffersReused`, `bindGroupsCreated`, and
`bindGroupsReused` counters.

## App Integration

The unlit app frame helper should consume a prepared scalar material resource
when available:

```text
frame view buffer + frame transform buffer
  + prepared scalar unlit material buffer/group-2 bind group
  -> full unlit frame resources
```

Group 0 and group 1 bind groups remain frame resources because they reference
view and world-transform buffers. Only group 2 should come from the prepared
material cache in the scalar slice.

`createUnlitFrameGpuResources` can remain as the cache-miss/setup convenience
path while the app route moves to a more explicit assembly path for prepared
material resources.

## Non-Goals

- Do not cache view uniform buffers, world transform buffers, mesh buffers, or
  light buffers in this material cache.
- Do not support textured unlit, Matcap, or StandardMaterial in the first cache.
- Do not move WebGPU handles into `@aperture-engine/render`.
- Do not add a public material plugin API.
- Do not change public app authoring APIs.
- Do not introduce module-global caches.

## Suggested Tests

- First scalar unlit frame creates the prepared material buffer and group-2 bind
  group.
- Second frame with unchanged source material/version/pipeline/layout reuses the
  prepared material resource.
- Updating the source material version invalidates and recreates the prepared
  material resource.
- A textured unlit material is skipped or diagnosed by the scalar prepared cache
  and continues through the existing app path until textured cache support is
  added.
- View uniform and world transform buffers are still written/reused as frame
  resources, not material prepared resources.

## Next Slice

Implement the internal scalar unlit prepared material cache and wire only the
scalar unlit app route through it. Keep the diff private to `@aperture-engine/webgpu`
and focused app tests.
