# Standard Textured Prepared Dependency Handoff Plan - 2026-05-17

## Scope

Plan the handoff from scalar-only `StandardMaterial` prepared material caching to
textured Standard dependency keying. This is a planning slice only; it does not
change runtime behavior.

## References Inspected

- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/STANDARD_SCALAR_PREPARED_MATERIAL_CACHE_PLAN_2026_05_17.md`
- `docs/research/SCALAR_STANDARD_PREPARED_APP_ROUTE_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/standard-material-buffer.ts`
- `packages/webgpu/src/webgpu/standard-bind-group.ts`
- `test/webgpu/webgpu-app.test.ts`
- Current StandardMaterial texture resource tests for base-color,
  metallic-roughness, normal, occlusion, and emissive variants.

## Current State

The scalar Standard prepared cache keys prepared group-2 resources by:

- source material handle;
- source material version;
- Standard pipeline key;
- Standard group-2 layout key.

It intentionally skips any `StandardMaterial` with texture bindings. Textured
Standard materials still use the frame-resource path, where
`app-texture-sampler-resources.ts` prepares WebGPU texture/sampler resources from
ready source assets and includes source asset versions in texture/sampler cache
keys.

## Dependency Key Shape

Textured Standard prepared material cache entries should add dependency segments
for each populated texture family. The logical shape should stay JSON-safe and
source-version based:

```ts
type StandardTextureDependencyField =
  | "baseColorTexture"
  | "metallicRoughnessTexture"
  | "normalTexture"
  | "occlusionTexture"
  | "emissiveTexture";

interface PreparedStandardTextureDependencyVersionKey {
  readonly field: StandardTextureDependencyField;
  readonly kind: "texture" | "sampler";
  readonly handleKey: string;
  readonly version: number;
  readonly versionKey: string;
}

interface PreparedStandardTextureBindingDependencyKeys {
  readonly field: StandardTextureDependencyField;
  readonly texture: PreparedStandardTextureDependencyVersionKey;
  readonly sampler: PreparedStandardTextureDependencyVersionKey;
  readonly cacheKeySegments: readonly string[];
}
```

`versionKey` should use the same source-asset version convention as the app
texture/sampler cache, for example `texture:standard-base-color@2` or
`sampler:standard-base-color-sampler@1`. `cacheKeySegments` should include the
field name so two texture families that happen to reference the same texture and
sampler handles remain distinct:

```text
baseColorTexture:texture:texture:standard-base-color@2
baseColorTexture:sampler:sampler:standard-base-color-sampler@1
```

The final prepared cache key should concatenate the existing scalar key segments
with ordered dependency segments in bind-group binding order:

1. `baseColorTexture`
2. `metallicRoughnessTexture`
3. `normalTexture`
4. `occlusionTexture`
5. `emissiveTexture`

## Dependency Readiness

For each populated Standard texture family:

- missing texture handle should be a diagnostic with the field path;
- missing sampler handle should be a diagnostic with the field path;
- missing source texture asset should be a diagnostic with the texture handle
  key and status `missing`;
- loading or failed source texture asset should be a diagnostic with the current
  source asset status;
- missing/loading/failed sampler assets should follow the same pattern;
- ready texture and sampler assets should contribute source-version dependency
  segments.

Diagnostics should not include raw texture objects, sampler objects, GPU views,
bind groups, or device handles.

## Smallest First Slice

The first code slice should add only the dependency-key helper for
`baseColorTexture`:

- derive texture and sampler source-version keys for a ready base-color binding;
- return JSON-safe diagnostics for missing texture handles, missing sampler
  handles, missing source assets, loading textures, and loading samplers;
- leave `prepareScalarStandardMaterialResource` behavior unchanged;
- do not wire textured Standard prepared resources into the app route yet.

This matches the existing ready `task-0824` scope and mirrors the earlier
textured unlit dependency helper before expanding to more Standard texture
families.

## Later Slices

After the base-color helper is covered:

1. Extend dependency key derivation to metallic-roughness, normal, occlusion,
   and emissive bindings.
2. Add a direct prepared textured Standard material helper that accepts already
   prepared app texture/sampler GPU resources and creates/reuses group-2
   material resources.
3. Wire the app route for one textured Standard variant at a time, starting with
   base-color.
4. Add invalidation tests for source material, texture source, sampler source,
   pipeline key, and layout key changes.

## Ownership Rules

The textured Standard prepared material cache may own:

- Standard material uniform buffer;
- Standard group-2 material bind group;
- source material/version metadata;
- texture/sampler dependency source-version metadata;
- logical material, texture, sampler, and bind-group resource keys.

It must not own:

- ECS entities or components;
- source texture or sampler assets;
- mesh buffers;
- view uniform or world transform buffers;
- light buffers or group-3 light bind groups;
- render snapshots, draw queues, render passes, command encoders, or app
  lifecycle state.

Texture and sampler GPU resources should remain prepared by the existing WebGPU
texture/sampler path and passed into the material helper as dependencies. Group-3
light resources are derived from `RenderSnapshot` light packets and must stay
outside material dependency cache keys.
