# Retained Backend Cache Summary Grouping Plan - 2026-05-17

## Scope

Plan whether retained backend cache summaries in app reports should remain flat
fields or move into a grouped object.

This is a planning slice only. It should not rename report fields.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/app.ts`
- `docs/research/GENERIC_QUEUED_PREPARED_RESOURCE_REPORT_PLAN_2026_05_17.md`
- `docs/research/APP_RESOURCE_REUSE_REPORT_CACHE_LIFETIME_READINESS_AUDIT_2026_05_17.md`
- `docs/research/APP_TEXTURE_SAMPLER_CACHE_SUMMARY_REPORT_BOUNDARY_AUDIT_2026_05_17.md`

## Current Flat Fields

`WebGpuAppResourceReuseReport` currently exposes retained backend cache
summaries as flat fields:

- `preparedMeshCache`
- `preparedMaterialCache`
- `textureSamplerCache`

It also exposes facade summaries as flat fields:

- `preparedMeshFacade`
- `preparedMaterialFacade`

Per-frame counters remain flat as well.

## Recommendation

Keep the flat fields for now.

Reasons:

- Existing tests and downstream report consumers already use these names.
- The fields are explicit about resource-family ownership.
- A grouped object such as `backendCaches` would require compatibility planning
  and could obscure the distinction between prepared material caches and
  texture/sampler caches.
- Eviction reports are not app-facing yet, so a larger cache-lifetime report
  namespace would be premature.

## Future Grouping Option

If grouping becomes useful later, add it compatibly before removing flat fields:

```ts
resourceReuse: {
  preparedMeshCache,
  preparedMaterialCache,
  textureSamplerCache,
  retainedBackendCaches: {
    preparedMesh,
    preparedMaterial,
    textureSampler,
  },
}
```

The grouped names should avoid implying that facades, per-frame counters, and
eviction reports are part of the same concept.

Do not use a generic `preparedResources` group for texture/sampler caches.
Texture/sampler resources are backend dependencies used by prepared materials,
but they are not prepared material entries.

## Follow-Up

The next useful coverage is a single app JSON regression that exercises mesh,
material, texture, and sampler retained backend cache summaries together. That
test can lock down the current flat report shape without forcing a broader
rename.

## Result

No report shape change is recommended now.

Keep flat retained cache summary fields and add cross-family JSON coverage.
