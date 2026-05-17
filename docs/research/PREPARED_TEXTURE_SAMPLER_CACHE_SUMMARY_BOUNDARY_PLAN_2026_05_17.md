# Prepared Texture Sampler Cache Summary Boundary Plan - 2026-05-17

## Scope

Plan JSON-safe retained-cache summaries for WebGPU app texture and sampler
resources.

This is a planning slice only. It should not change app report fields until the
summary helpers exist and have focused tests.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `docs/research/GENERIC_APP_CACHE_LIFETIME_POLICY_SURFACE_PLAN_2026_05_17.md`
- `docs/research/APP_RESOURCE_REUSE_REPORT_CACHE_LIFETIME_READINESS_AUDIT_2026_05_17.md`
- `docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`

## Current State

`AppTextureSamplerResourceCache` owns two backend maps:

- `textures: Map<string, TextureGpuResource>`
- `samplers: Map<string, SamplerGpuResource>`

The app report currently exposes per-frame counters:

- `textureResourcesCreated`
- `textureResourcesReused`
- `samplerResourcesCreated`
- `samplerResourcesReused`

There is no retained-cache summary for texture or sampler resources. That is a
gap for future cache lifetime policy because prepared materials can retain
material cache entries that depend on texture/sampler backend resources, but
the material cache summary should not include those adjacent resources.

## Proposed Helpers

Add JSON-safe helpers in `app-texture-sampler-resources.ts`:

```ts
export interface AppTextureSamplerResourceCacheSummary {
  textureEntries: number;
  samplerEntries: number;
  totalEntries: number;
}

export function createAppTextureSamplerResourceCacheSummary(): AppTextureSamplerResourceCacheSummary;

export function writeAppTextureSamplerResourceCacheSummary(
  summary: AppTextureSamplerResourceCacheSummary,
  cache: AppTextureSamplerResourceCache,
): AppTextureSamplerResourceCacheSummary;
```

Keep the first version count-only. Texture and sampler cache keys include source
asset keys and versions, but exposing per-entry keys would make app reports more
detailed than the current mesh/material retained-cache summaries need.

## Report Direction

A later app integration task can add:

```ts
resourceReuse: {
  textureSamplerCache,
  textureResourcesCreated,
  textureResourcesReused,
  samplerResourcesCreated,
  samplerResourcesReused,
}
```

Do not fold these counts into `preparedMaterialCache`. Prepared materials depend
on texture/sampler GPU resources but do not own them.

Do not merge texture/sampler summaries into `preparedMeshCache` or a generic
`preparedResources` object yet. A generic object can wait until all relevant
resource families share a stable vocabulary.

## Boundary Rules

The summary must not expose:

- `TextureGpuResource`;
- `SamplerGpuResource`;
- GPU textures, texture views, or samplers;
- source `TextureAsset` or `SamplerAsset` payloads;
- dependency objects or material bindings;
- cache `Map` instances.

The helper may mutate a caller-provided summary shell, matching the existing
prepared material cache summary pattern.

## Tests

The implementation follow-up should cover:

- empty cache summary;
- populated cache with texture-only, sampler-only, and mixed entries;
- cleared cache summary;
- JSON output excludes representative GPU/source payload markers.

## Result

Add count-only texture/sampler retained-cache summary helpers next. App report
integration can follow after the helper boundary is covered.
