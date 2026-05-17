# Textured Unlit Prepared Dependency Handoff Plan - 2026-05-17

## Scope

Plan how textured `UnlitMaterial` should move from app-route texture/sampler
preparation into the internal prepared unlit material cache.

This is a planning slice only. It does not change implementation behavior.

## References Inspected

- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/UNLIT_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
- `docs/research/SCALAR_UNLIT_PREPARED_CACHE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/materials/prepared-resource.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/texture-resources.ts`
- `packages/webgpu/src/webgpu/unlit-bind-group.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`

## Current State

The scalar cache prepares only:

- material uniform buffer;
- group-2 material bind group;
- source material key/version;
- pipeline key;
- group-2 layout key.

Textured unlit materials are intentionally skipped and continue through the
existing app path:

```text
source material
  -> app texture/sampler resources by source handle/version
  -> frame-resource helper
  -> material buffer + textured group-2 bind group
```

This keeps behavior correct while scalar cache ownership is proven.

## Target Handoff

The textured unlit prepared material cache should prepare the same group-2
material bind group, but with texture and sampler entries included:

```text
PreparedMaterialResourceDescriptor
  + texture/sampler source handle versions
  + WebGPU texture/sampler resources
  -> material buffer
  -> textured group-2 bind group
```

The cache remains WebGPU-private. Source texture and sampler assets remain in
`AssetRegistry` / typed collections. The render package descriptor continues to
record logical dependency keys and readiness only; it must not hold texture
views, samplers, bind groups, or buffers.

## Dependency Key Shape

Extend the prepared unlit material cache key with dependency source versions:

```text
material:<id>
version:<materialVersion>
pipeline:<pipelineKey>
layout:<group2LayoutKey>
texture:<textureKey>@<textureVersion>
sampler:<samplerKey>@<samplerVersion>
```

For scalar unlit, the texture/sampler segments are omitted.

For textured unlit, both texture and sampler segments are required. Partial
bindings should not create prepared resources.

## Preparation Inputs

The textured prepared helper should receive:

- source `AssetRegistry`;
- unlit material handle and source version;
- source `UnlitMaterialAsset`;
- `PreparedMaterialResourceDescriptor`;
- WebGPU device;
- group-2 material layout;
- existing app texture/sampler GPU resource cache;
- existing texture/sampler reuse report counters;
- prepared unlit material cache.

Texture/sampler GPU resources can continue to be produced by the existing
`app-texture-sampler-resources.ts` helpers at first. The prepared material cache
should consume the resulting WebGPU texture view and sampler resources plus
their source-version cache keys.

## Diagnostics

Required diagnostics:

- material source missing/not ready;
- material dependency readiness failure from the render descriptor;
- unlit material has a texture without a sampler;
- unlit material has a sampler without a texture;
- texture source missing/not ready;
- sampler source missing/not ready;
- texture GPU resource creation failure;
- sampler GPU resource creation failure;
- group-2 bind group creation failure.

Diagnostics should remain JSON-safe and should identify logical dependency keys
instead of raw GPU objects.

## Invalidation

Reprepare textured unlit resources when any of these change:

- material source version;
- pipeline key;
- group-2 layout key;
- base-color texture handle;
- base-color texture source version;
- base-color sampler handle;
- base-color sampler source version.

Do not invalidate because of:

- frame number;
- view uniform data;
- world transform data;
- mesh handle/version;
- draw count;
- light packets.

## App Integration Order

1. Add a helper that computes texture/sampler dependency version keys from the
   registry and existing prepared app texture/sampler resources.
2. Extend the prepared unlit cache resource shape to allow optional texture and
   sampler resource keys.
3. Prepare textured group-2 bind groups through the cache when both dependencies
   are ready.
4. Keep scalar behavior unchanged and covered by existing scalar tests.
5. Add an app regression that changes only the texture or sampler source version
   and proves the prepared unlit material resource invalidates.

## Non-Goals

- Do not cache view uniform, world transform, mesh, or light resources here.
- Do not move texture/sampler source assets into WebGPU-owned state.
- Do not add Matcap or StandardMaterial support in this slice.
- Do not add a public material plugin API.
- Do not change user-facing app authoring APIs.

## Next Implementation Slice

Add texture/sampler dependency key extraction for unlit prepared resources and
cover it with direct tests before changing the app route.
