# Prepared Material Texture/Sampler Dependency Input Audit - 2026-05-17

## Scope

Audit the runtime slice that introduced
`PreparedMaterialTextureSamplerDependencies` for WebGPU material app-frame
helpers. The goal is to verify the new input clarifies dependency direction
without moving texture/sampler cache ownership into prepared material stores.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/RENDER_ASSET_PREPARATION.md`
- `docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/prepared-material-texture-sampler-dependencies.ts`
- `packages/webgpu/src/webgpu/unlit-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/matcap-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-unlit-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-matcap-material-cache.ts`
- `packages/webgpu/src/webgpu/prepared-standard-material-cache.ts`
- `references/bevy/crates/bevy_render/src/render_asset.rs`

## Reference Pattern

Bevy keeps image preparation and material preparation as separate render-asset
steps. Material preparation can depend on prepared image resources and retry
when they are missing, but the material render asset does not own the image
asset store.

Aperture's matching shape after this slice is:

```text
source texture/sampler assets
  -> WebGPU app texture/sampler resource cache
  -> PreparedMaterialTextureSamplerDependencies
  -> WebGPU prepared material cache lookup/creation
  -> frame material bind group resources
```

## Findings

### Texture/Sampler Ownership

No ownership drift found.

- `AppTextureSamplerResourceCache` still owns texture and sampler GPU resource
  maps.
- `PreparedMaterialTextureSamplerDependencies` is a readonly handoff shape over
  already prepared texture/sampler resources, versioned dependency keys, and
  diagnostics.
- Unlit, Matcap, and Standard app-frame helpers now consume
  `textureSamplerDependencies` instead of a generic `textures` field, but they
  still do not receive or mutate texture/sampler cache maps.
- Prepared material caches receive ready texture/sampler resource arrays only
  when creating material bind resources; they do not own texture/sampler
  lifetime or eviction.

### Invalidation And Summary Separation

No summary coupling drift found.

- Frame-resource cache keys still compare texture and sampler source-version
  keys supplied by app texture/sampler preparation.
- Source texture and sampler version changes continue to invalidate prepared
  material cache entries through dependency keys.
- Texture/sampler resource counters remain in the app texture/sampler reuse
  report fields.
- Prepared material cache summaries remain separate family entry counts and do
  not include texture/sampler cache maps.

### Diagnostics And JSON Safety

No JSON-safety drift found.

- Missing source texture/sampler assets are still diagnosed by
  `app-texture-sampler-resources.ts` before frame-resource helpers run.
- Missing prepared texture/sampler resources still produce sanitized prepared
  material fallback diagnostics.
- App summary regressions verify prepared material cache counts across mixed
  unlit, Matcap, and Standard frames without exposing raw GPU handles.
- The new dependency input file exports only readonly data types and a pass-
  through helper; it does not expose WebGPU cache maps or public app state.

## Decision

The `PreparedMaterialTextureSamplerDependencies` input is a valid boundary
tightening. It makes the material helper dependency direction explicit while
preserving WebGPU ownership of texture/sampler resources and keeping reports
JSON-safe.

## Follow-Ups

- No corrective backlog wording is required for this slice.
- The next ready task should continue the material/render-world bridge by
  moving from prepared material metadata and summaries toward generic
  render-world prepared-resource queue integration.
