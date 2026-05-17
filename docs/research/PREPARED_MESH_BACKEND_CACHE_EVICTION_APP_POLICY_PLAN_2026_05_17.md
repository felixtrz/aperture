# Prepared Mesh Backend Cache Eviction App Policy Plan - 2026-05-17

## Scope

Plan how prepared mesh backend cache eviction should relate to the WebGPU app
facade and app reports.

This is a planning slice only. It does not add automatic eviction to the frame
loop.

## References Inspected

- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_EVICTION_REPORT_PLAN_2026_05_17.md`
- `docs/research/PREPARED_MESH_BACKEND_CACHE_LAST_USED_BOUNDARY_AUDIT_2026_05_17.md`
- `test/webgpu/prepared-mesh-cache.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Current State

Prepared mesh backend eviction is now available as a WebGPU cache helper. It
deletes entries from `PreparedMeshGpuResourceCache.resources` according to
`lastUsedFrame`, `currentFrame`, and `maxUnusedFrames`.

The app facade currently:

- owns the internal prepared mesh backend cache;
- reports retained backend cache counts through `preparedMeshCache`;
- prunes `preparedMeshFacade` against the current snapshot;
- does not expose a cache-eviction method or automatic eviction policy.

## Policy Decision

Keep eviction manual/internal for now.

Do not add automatic per-frame eviction yet. The app frame loop currently has
no user-facing cache budget, eviction interval, or frame-age policy. Adding one
now would be arbitrary and could hide useful cache reuse while the resource
lifetime model is still being shaped.

Do not expose a public `app.evictPreparedMeshes()` method yet. That would make
cache lifetime a public app API before the material, texture, sampler, and
pipeline cache policies share a coherent shape.

The next app-facing step should be a test-only or explicitly scoped helper only
if a future task needs to prove report behavior across eviction. Until then,
the focused backend cache tests are the right coverage surface.

## Report Boundary

`preparedMeshCache` should keep reporting retained backend cache counts.

Eviction reports should remain separate from:

- `preparedMeshFacade`, which is snapshot-pruned logical readiness metadata;
- per-frame `preparedMeshBuffersCreated` and `preparedMeshBuffersReused`
  counters;
- material, texture, sampler, light, bind group, and pipeline counters.

If an app policy later surfaces eviction, use a separate field such as
`preparedMeshCacheEviction` or an explicit method return value. Do not overload
`preparedMeshCache` with the last eviction report.

## Follow-Up Shape

The best immediate follow-up is an audit of the backend eviction helper
boundary. A later implementation task can add app-level policy only after
answering:

- whether eviction is user-triggered or app-frame automatic;
- how users configure `maxUnusedFrames`;
- where eviction reports should appear;
- whether material, texture, sampler, and pipeline caches need equivalent
  policy knobs first.

## Result

No app API change is recommended yet.

Keep `task-0910` as the next audit. Add app/report regression tasks only after
an explicit app eviction policy is accepted.
