# Generic Queued Prepared Resource Report Plan - 2026-05-17

## Scope

Plan a stable app report shape for queued prepared resources after adding both
prepared mesh and prepared material facades.

This is a planning slice only. It does not change runtime report fields.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/assets/preparation.ts`
- `packages/render/src/rendering/snapshot-prepared-meshes.ts`
- `packages/render/src/rendering/snapshot-prepared-materials.ts`
- `packages/webgpu/src/webgpu/prepared-mesh-cache.ts`
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts`
- `docs/research/PREPARED_MESH_FACADE_QUEUE_KEY_HANDOFF_AUDIT_2026_05_17.md`
- `docs/research/RENDER_WORLD_PREPARED_MESH_BINDING_AUDIT_2026_05_17.md`

## Current Report Surfaces

`WebGpuAppResourceReuseReport` currently separates:

- pipeline cache hits/misses;
- source mesh GPU buffer creation/reuse;
- prepared mesh GPU buffer creation/reuse;
- source material buffer creation/reuse;
- prepared material buffer and bind group creation/reuse;
- WebGPU-private prepared material cache counts;
- renderer-independent prepared mesh facade summary;
- renderer-independent prepared material facade summary;
- texture and sampler GPU resource creation/reuse;
- bind group creation/reuse;
- light buffer creation/reuse;
- dynamic buffer writes.

This is directionally correct because facade readiness and backend GPU resource
reuse are different questions.

## Proposed Naming Direction

Keep the current split rather than merging everything into one generic
`preparedResources` object immediately.

Recommended near-term shape:

```ts
resourceReuse: {
  preparedMeshFacade,
  preparedMaterialFacade,
  preparedMaterialCache,
  preparedMeshBuffersCreated,
  preparedMeshBuffersReused,
  preparedMaterialBuffersCreated,
  preparedMaterialBuffersReused,
  preparedMaterialBindGroupsCreated,
  preparedMaterialBindGroupsReused,
  textureResourcesCreated,
  textureResourcesReused,
  samplerResourcesCreated,
  samplerResourcesReused,
}
```

Reasons:

- Existing tests and app users can distinguish renderer-independent facade
  metadata from WebGPU backend resource reuse.
- Mesh backend cache entries currently have only creation/reuse counters, not a
  JSON-safe cache summary.
- Material backend cache counts are family-specific and should not be implied to
  include mesh buffers, texture resources, sampler resources, or light buffers.
- A future generic summary can be added once mesh/material/texture/sampler
  prepared-resource lifetimes share a common reporting vocabulary.

## Guardrails

Do:

- Keep `preparedMeshFacade` and `preparedMaterialFacade` JSON-safe.
- Keep facade summaries snapshot-scoped.
- Keep backend prepared mesh buffer counters separate from facade entry counts.
- Keep backend prepared material cache counts separate from texture/sampler and
  light resource counters.
- Add new backend cache summaries only when they can report resource ownership
  honestly.

Do not:

- Treat facade entries as proof that GPU resources exist.
- Merge texture/sampler cache reuse into material cache counts.
- Put raw WebGPU handles or source asset objects into facade summaries.
- Rename report fields broadly without a compatibility-focused task.

## Follow-Up

No immediate report-shape implementation is required. The next implementation
work should continue the render-world/prepared-resource handoff and add audits
after each boundary change.
