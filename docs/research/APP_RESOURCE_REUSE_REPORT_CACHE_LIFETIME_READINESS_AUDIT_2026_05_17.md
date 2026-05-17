# App Resource Reuse Report Cache Lifetime Readiness Audit - 2026-05-17

## Scope

Audit whether `WebGpuAppResourceReuseReport` is ready to support cache-lifetime
policy work without blurring facade, backend cache, per-frame counter, and
eviction concepts.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_APP_CACHE_LIFETIME_POLICY_SURFACE_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

### Facade and backend cache fields are distinguishable

The report names the two renderer-independent facades explicitly:

- `preparedMeshFacade`
- `preparedMaterialFacade`

Backend retained cache summaries are separately named:

- `preparedMeshCache`
- `preparedMaterialCache`

This is ready for policy discussions because a future eviction policy can target
backend caches without implying that snapshot-pruned facades should be pruned or
evicted the same way.

### Per-frame counters remain separate

Creation/reuse counters are still named as frame work:

- `preparedMeshBuffersCreated`
- `preparedMeshBuffersReused`
- `preparedMaterialBuffersCreated`
- `preparedMaterialBuffersReused`
- `preparedMaterialBindGroupsCreated`
- `preparedMaterialBindGroupsReused`
- `textureResourcesCreated`
- `textureResourcesReused`
- `samplerResourcesCreated`
- `samplerResourcesReused`

These counters are useful for frame diagnostics, but they should not be treated
as retained cache summaries or eviction reports.

### Eviction reports are not surfaced yet

The report does not contain mesh or material eviction report fields. That is
appropriate because no app-level eviction pass exists yet.

If future app policy adds eviction, it should use a separate field or explicit
method return value. The existing retained-cache summary fields should remain
summary-only.

### Texture/sampler retained cache summaries are missing

Texture and sampler backend resources have per-frame creation/reuse counters,
but no retained-cache summaries analogous to `preparedMeshCache` or
`preparedMaterialCache`.

This is the main readiness gap before a generic app cache-lifetime policy can
be designed honestly. Material preparation depends on texture/sampler resources,
but material cache summaries must not absorb those resource counts.

### JSON safety remains covered for prepared cache summaries

Existing app tests assert prepared mesh/material facade summaries and prepared
mesh/material backend cache summaries do not expose representative GPU/source
payloads.

Texture/sampler summary tests should follow the same pattern once those
summaries exist.

## Result

The app report is ready for mesh/material cache-lifetime policy discussion, but
not yet for a generic app eviction API.

Add texture/sampler retained cache summaries before designing public app-level
cache policy or automatic eviction.
