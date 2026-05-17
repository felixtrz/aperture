# App Prepared Facade Report Shape Audit - 2026-05-17

## Scope

Audit the WebGPU app report shape after adding renderer-independent prepared
mesh and prepared material facade summaries.

The goal is to verify that facade readiness reports, WebGPU backend cache
reports, and raw per-frame reuse counters are named honestly and remain
JSON-safe.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_QUEUED_PREPARED_RESOURCE_REPORT_PLAN_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/assets/preparation.ts`
- `test/webgpu/webgpu-app.test.ts`
- `docs/research/RENDER_WORLD_PREPARED_MESH_BINDING_AUDIT_2026_05_17.md`

## Findings

### Facade summaries are separated from backend resources

`WebGpuAppResourceReuseReport` exposes `preparedMeshFacade` and
`preparedMaterialFacade` as renderer-independent summaries. Those fields are
populated from `PreparedMeshStore` and `PreparedMaterialStore` after snapshot
preparation and pruning.

The same report keeps WebGPU backend reuse under separate fields:

- `preparedMeshBuffersCreated`
- `preparedMeshBuffersReused`
- `preparedMaterialBuffersCreated`
- `preparedMaterialBuffersReused`
- `preparedMaterialBindGroupsCreated`
- `preparedMaterialBindGroupsReused`
- `preparedMaterialCache`

This naming makes it clear that facade entries describe prepared logical
metadata, not proof that the backend currently has a GPU buffer or bind group.

### Material backend cache scope is honest

`preparedMaterialCache` reports only built-in prepared material backend cache
entries by material family. It does not include mesh buffers, texture resources,
sampler resources, light resources, bind groups outside the material cache, or
pipeline cache entries.

Texture and sampler counters remain separate, which is important because
prepared Standard and Matcap materials depend on those backend resources without
owning them.

### Mesh backend cache is intentionally counter-only for now

Prepared mesh backend resources currently surface as per-frame
creation/reuse counters. There is no JSON-safe prepared mesh backend cache
summary yet, so the report does not imply one.

The next ready tasks plan and implement that summary as WebGPU-private report
metadata, separate from `preparedMeshFacade`.

### JSON helpers do not expose handles or payloads

`preparedMeshStoreSummaryToJsonValue()` emits scalar metadata: asset key, source
version, label, logical `meshResourceKey`, vertex stream count, submesh count,
index-buffer presence, and diagnostic count.

`preparedMaterialStoreSummaryToJsonValue()` emits scalar metadata: asset key,
source version, label, material family/kind, pipeline key, logical prepared
resource keys, dependency count, texture binding count, and diagnostic count.

The helpers do not expose source mesh arrays, source material payload values,
registry entries, `Map` instances, WebGPU buffers, textures, samplers, bind
groups, or devices. Existing WebGPU app tests assert the JSON output excludes
representative source/GPU payload markers.

### Snapshot pruning semantics are visible

The app prunes `preparedMeshFacade` and `preparedMaterialFacade` against the
current snapshot after each render, while backend material cache counts and
prepared mesh buffer reuse counters can remain retained.

That distinction matches the architecture: the facade describes current
snapshot readiness, while the backend may retain WebGPU resources for reuse.

## Result

No report-shape ownership drift found.

The backlog should continue with a focused prepared mesh backend cache summary
so the app can report retained backend mesh cache entries without overloading
`preparedMeshFacade` or the per-frame mesh buffer counters.
