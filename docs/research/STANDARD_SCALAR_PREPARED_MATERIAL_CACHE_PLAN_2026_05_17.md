# Standard Scalar Prepared Material Cache Plan - 2026-05-17

## Scope

Plan the smallest StandardMaterial prepared material cache slice after prepared
mesh resources have been wired through unlit, Matcap, and Standard app routes.

This is a planning slice only. It does not change runtime behavior.

## References Inspected

- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/PREPARED_ROUTE_COUNTER_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer-resource.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current State

The StandardMaterial app route now can reuse prepared mesh GPU buffers, but it
still creates material GPU resources inside each Standard frame-resource miss:

```text
StandardMaterial source asset
  -> pack standard material
  -> material uniform buffer
  -> group-2 material bind group
  -> frame resources
```

This is correct for the proof path, but material buffer and group-2 bind-group
lifetime is still coupled to the app frame-resource helper.

## Smallest Cache Shape

The first StandardMaterial prepared material cache should handle only scalar
StandardMaterial variants, meaning no base-color, metallic-roughness, normal,
occlusion, or emissive texture bindings.

Suggested resource:

```ts
interface PreparedScalarStandardMaterialResource {
  readonly cacheKey: string;
  readonly sourceMaterialKey: string;
  readonly sourceVersion: number;
  readonly pipelineKey: string;
  readonly layoutKey: string;
  readonly materialResourceKey: string;
  readonly bindGroupResourceKey: string;
  readonly material: StandardMaterialGpuBufferResource;
  readonly bindGroup: StandardMaterialBindGroupResource;
}
```

The cache key should include:

- source material handle key;
- source material version;
- pipeline key;
- group-2 material layout key.

Texture dependency version segments should be omitted for this first scalar
slice and added later by a separate textured StandardMaterial task.

## Ownership Rules

The cache may own only WebGPU backend resources derived from a ready
StandardMaterial source asset:

- Standard material uniform buffer;
- Standard group-2 material bind group;
- stable logical resource keys and source version metadata.

It must not own:

- ECS entities or components;
- mesh buffers;
- view uniforms or world transform buffers;
- light buffers or group-3 light bind groups;
- texture/sampler GPU resources for textured StandardMaterial variants;
- draw queues, render packets, command encoders, or app lifecycle state.

## Diagnostics

Required diagnostics:

- unsupported non-Standard material kind;
- textured StandardMaterial skipped by the scalar helper;
- missing group-2 material layout;
- Standard material packing/validation failures;
- material buffer descriptor or GPU buffer creation failures;
- group-2 bind group planning/creation failures.

Diagnostics should remain JSON-safe and identify source material keys, pipeline
keys, layout keys, and logical resource keys rather than raw GPU objects.

## Integration Order

1. Add a direct WebGPU-private scalar StandardMaterial prepared cache helper and
   focused tests for create/reuse/source-version invalidation.
2. Keep textured StandardMaterial variants on the existing app frame-resource
   path.
3. Wire scalar Standard app frame-resource misses through the prepared helper
   after direct coverage is in place.
4. Add app-route counter tests that distinguish Standard frame-resource reuse
   from prepared Standard material reuse.

## Non-Goals

- Do not cache texture/sampler resources in this first Standard slice.
- Do not cache light buffers or light bind groups.
- Do not change source material ownership or typed asset collection behavior.
- Do not expose a public material plugin API.
- Do not generalize all material families before the scalar Standard helper is
  proven.

## Next Implementation Slice

Add the direct scalar StandardMaterial prepared material cache helper and tests.
