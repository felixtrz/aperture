# Prepared Texture Sampler Cache Summary Boundary Audit - 2026-05-17

## Scope

Audit the WebGPU app texture/sampler retained-cache summary helpers.

The goal is to verify that texture/sampler summaries remain backend-owned,
JSON-safe, and separate from prepared material cache ownership.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/PREPARED_TEXTURE_SAMPLER_CACHE_SUMMARY_BOUNDARY_PLAN_2026_05_17.md`
- `docs/research/PREPARED_TEXTURE_SAMPLER_DEPENDENCY_STORE_BOUNDARY_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/webgpu/app-texture-sampler-resources.test.ts`

## Findings

### Summary is count-only

`AppTextureSamplerResourceCacheSummary` reports:

- `textureEntries`
- `samplerEntries`
- `totalEntries`

It does not expose texture cache keys, sampler cache keys, source texture or
sampler payloads, dependency bindings, GPU textures, texture views, samplers,
devices, queues, bind groups, or cache `Map` instances.

Focused tests insert fake GPU/source payload markers into the cache and verify
the JSON summary does not include them.

### Backend ownership stays in WebGPU

The helper lives in `app-texture-sampler-resources.ts`, alongside the WebGPU app
texture/sampler cache. It does not move texture/sampler state into
`@aperture-engine/render`, ECS, snapshots, or render-world bindings.

### Prepared material cache ownership remains separate

Prepared material cache summaries still count only prepared material backend
entries by material family.

Texture/sampler summaries are intentionally separate because prepared materials
may depend on texture/sampler GPU resources without owning those adjacent
resources.

### App report integration is not added yet

The helper exists, but `WebGpuAppResourceReuseReport` has not been extended with
a texture/sampler retained-cache field in this slice.

That keeps the change narrow. A follow-up can add app report integration and
app JSON regressions now that the helper boundary is covered.

## Result

No ownership drift found.

The next useful implementation slice is to expose the texture/sampler retained
cache summary in app `resourceReuse`, separately from texture/sampler per-frame
creation/reuse counters and prepared material cache counts.
