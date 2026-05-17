# Generic App Cache Lifetime Policy Surface Plan - 2026-05-17

## Scope

Plan how WebGPU app-facing cache lifetime policy should evolve across backend
resource families.

This is a planning slice only. It should not add public eviction APIs or
automatic frame-loop eviction.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `packages/webgpu/src/webgpu/prepared-app-material-resource.ts`
- `packages/webgpu/src/webgpu/app-texture-sampler-resources.ts`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_EVICTION_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_EVICTION_APP_POLICY_PLAN_2026_05_17.md`

## Current Resource Families

The app already reports several backend resource families:

- pipeline hits/misses;
- source mesh buffers;
- prepared mesh backend cache counts;
- prepared material backend cache counts;
- prepared material buffer and bind-group reuse counters;
- texture resource creation/reuse counters;
- sampler resource creation/reuse counters;
- bind group counters;
- light buffer counters.

Only prepared mesh and prepared material backend caches currently have retained
cache summary fields. Prepared material caches have eviction helpers; prepared
mesh caches now have `lastUsedFrame` and an eviction helper. Texture and sampler
caches still expose only per-frame creation/reuse counters.

## Policy Direction

Do not add a public generic eviction API yet.

The app should first make retained backend cache summaries consistent enough
that a future policy can be explained across resource families. Otherwise a
generic app method would imply that mesh, material, texture, sampler, pipeline,
light, and bind-group caches all share one lifetime model, which is not true
yet.

Near-term policy:

- Keep backend cache eviction helpers manual/internal.
- Keep app frame-loop eviction off by default and unimplemented.
- Keep app reports descriptive, not policy-driving.
- Add missing retained-cache summaries before adding public policy controls.

## Manual vs Opt-In vs Automatic

Manual helper APIs are appropriate inside backend modules when tests or future
policy code need direct cache control.

App-facade opt-in APIs become appropriate only after:

- cache families have coherent summary fields;
- policy inputs have stable names, such as `maxUnusedFrames`;
- reports can distinguish eviction counts from retained cache counts;
- material, texture, sampler, and mesh cache ownership boundaries are audited.

Automatic frame-loop eviction should wait longer. It needs user-facing defaults
and budget reasoning, and it should avoid surprising cache churn during the
proof-point phase.

## Report Direction

Keep these concepts separate:

- facade summaries: current snapshot readiness metadata;
- backend cache summaries: retained backend cache counts;
- per-frame reuse counters: work done during this frame;
- eviction reports: work done by an explicit eviction pass.

If app-facade eviction is added later, prefer an explicit method return value
or separate report field such as `preparedMeshCacheEviction`. Do not overload
`preparedMeshCache` or `preparedMaterialCache` with last-eviction details.

## Immediate Follow-Ups

1. Audit whether `WebGpuAppResourceReuseReport` is ready for cache-lifetime
   policy discussions without blurring facade/backend scopes.
2. Plan texture/sampler retained cache summaries, because texture and sampler
   caches are currently visible only through per-frame counters.
3. Add texture/sampler summary helpers before considering a generic app-level
   eviction policy.

## Result

No public app cache-lifetime API should be added yet.

The next implementation direction should improve retained backend cache
visibility for texture/sampler resources while preserving the existing
prepared-material dependency boundary.
