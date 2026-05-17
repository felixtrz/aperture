# Prepared Texture/Sampler Dependency Store Boundary Plan - 2026-05-17

## Scope

Plan how prepared material stores should depend on WebGPU texture and sampler
resources without owning those resources. This is a planning task only; it does
not change runtime code.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/texture-resources.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `docs/research/PREPARED_BUILT_IN_MATERIAL_STORE_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/GENERIC_RENDER_WORLD_PREPARED_MATERIAL_STORE_API_PLAN_2026_05_17.md`
- `references/bevy/crates/bevy_render/src/render_asset.rs`
- `references/bevy/crates/bevy_pbr/src/material.rs`

## Current Boundary

WebGPU app texture/sampler preparation currently owns backend GPU resources:

- `AppTextureSamplerResourceCache.textures`
- `AppTextureSamplerResourceCache.samplers`
- `TextureGpuResource`
- `SamplerGpuResource`

Prepared material caches do not own those caches. They receive:

- source material asset and source version
- prepared texture/sampler GPU resources for the current material route
- texture/sampler dependency version keys derived from source asset registry
  entries
- diagnostics when source or prepared dependencies are missing

This is the correct ownership direction. Material cache keys can include
texture/sampler source versions, but material stores should not own texture or
sampler GPU objects.

## Reference Pattern

Bevy material preparation depends on prepared images and can retry when those
dependencies are not available. The material prepared asset stores material
bindings and shader-facing resources, while image preparation owns image GPU
resources.

Aperture should use the same dependency direction:

```text
source texture/sampler asset
  -> WebGPU texture/sampler resource cache
  -> prepared material dependency version key
  -> WebGPU prepared material cache entry
  -> draw-time material bind group
```

The material path may read dependency keys and prepared GPU resources, but it
must not mutate or own the texture/sampler caches.

## Proposed Dependency Contract

Add a small internal dependency input shape before moving more material
preparation into render-world/store layers:

```ts
interface PreparedMaterialTextureSamplerDependencies {
  readonly textures: readonly TextureGpuResource[];
  readonly samplers: readonly SamplerGpuResource[];
  readonly textureKeys: readonly string[];
  readonly samplerKeys: readonly string[];
  readonly diagnostics: readonly WebGpuAppTextureSamplerPreparationDiagnostic[];
}
```

This can initially be an alias or wrapper around
`PreparedAppTextureSamplerResources`, but the name should clarify that these are
dependencies supplied to material preparation, not material-store-owned state.

## Boundary Rules

Prepared material stores may use:

- texture and sampler source asset handles
- texture and sampler source version keys
- logical dependency keys in JSON-safe reports
- ready `TextureGpuResource`/`SamplerGpuResource` inputs supplied by WebGPU
  preparation for bind group creation
- diagnostics for missing source or prepared dependencies

Prepared material stores must not own:

- texture/sampler resource maps
- GPU texture/sampler lifetime or eviction
- texture upload descriptors as material cache internals
- fallback texture resources
- source texture/sampler asset mutation

## Invalidation Rules

- Source material version changes should produce a new prepared material backend
  cache entry or update the renderer-independent descriptor entry.
- Texture source version changes should invalidate prepared material backend
  entries that include the texture dependency version key.
- Sampler source version changes should invalidate prepared material backend
  entries that include the sampler dependency version key.
- Texture/sampler GPU resource cache summaries should remain separate from
  prepared material cache summaries.
- Removing/not-ready texture or sampler sources should block prepared material
  resource creation with JSON-safe diagnostics; expected skipped material routes
  should remain silent.

## Tests For The First Runtime Slice

- Direct dependency-key tests:
  - unlit texture/sampler source version keys change after registry updates
  - Matcap texture/sampler source version keys change after registry updates
  - Standard base-color, metallic-roughness, normal, occlusion, and emissive
    dependency keys change by field
- App-level dependency tests:
  - texture source-version change increments prepared material cache summary
    counts but only texture resource counters in texture/sampler reports
  - sampler source-version change increments prepared material cache summary
    counts but only sampler resource counters in texture/sampler reports
  - transform/light-only changes do not change prepared material cache summary
    counts
- Diagnostics tests:
  - missing prepared texture/sampler GPU resources produce
    `missing-prepared-dependency` fallback diagnostics
  - missing source texture/sampler assets produce source-readiness diagnostics
    before frame resources are created
  - JSON reports do not expose raw texture, sampler, buffer, bind group, or map
    internals

## Non-Goals

- Do not merge texture/sampler caches into prepared material stores.
- Do not move texture/sampler GPU resources into `@aperture-engine/render`.
- Do not add fallback textures as a hidden success path.
- Do not change `RenderSnapshot`.
- Do not expose WebGPU texture/sampler handles through public app reports.

## Follow-Up Task Shape

```md
### task-next - Extract prepared material texture/sampler dependency input

Category: `webgpu-render`
Package/write-scope: WebGPU material app-frame helpers and focused tests.
Reference anchor:
`docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`,
current app texture/sampler resource preparation, prepared material dependency
key helpers, and Bevy material/image preparation retry pattern.

Acceptance criteria:

- Material preparation helpers consume an explicitly named texture/sampler
  dependency input instead of treating those resources as material store fields.
- Tests prove source texture/sampler version changes affect material cache keys
  while texture/sampler cache summaries remain separate.
- Diagnostics remain JSON-safe and do not expose raw GPU handles.
```
