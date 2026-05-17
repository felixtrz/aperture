# Material Queue Phase Summary Boundary Audit - 2026-05-17

## Scope

Audit `createMaterialQueuePhaseSummary()` after adding the renderer-independent
material queue summary helper and focused tests.

The goal is to verify that the summary describes derived queue items only, stays
separate from backend resource cache reports, and does not mutate ECS,
snapshots, or WebGPU state.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/NORTH_STAR.md`
- `docs/DECISIONS.md`
- `docs/research/MATERIAL_QUEUE_PHASE_SUMMARY_PLAN_2026_05_17.md`
- `docs/research/STABLE_MATERIAL_QUEUE_ORDERING_BOUNDARY_AUDIT_2026_05_17.md`
- `docs/research/RETAINED_BACKEND_CACHE_SUMMARY_GROUPING_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/render/src/rendering/index.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `test/rendering/material-queue.test.ts`

## Findings

### Summary describes derived queue items

`createMaterialQueuePhaseSummary()` accepts only
`readonly MaterialQueueItem[]`. It counts `renderPhase` and `materialFamily`
fields that were already derived by `writeMaterialQueueFromSnapshot()`.

It does not read ECS worlds, asset registries, source assets, render-world
objects, prepared stores, WebGPU resources, or browser objects.

### Snapshot and ECS ownership are unchanged

The helper does not write to queue items, `RenderSnapshot.meshDraws`, ECS
components, render-world state, or prepared-resource stores. Existing material
queue tests still prove queue sorting does not mutate source snapshots, and the
new summary tests build summaries from derived queue items only.

### Report shape is JSON-safe

The summary contains only scalar strings and counts:

- total item count;
- counts by render phase;
- counts by material family;
- counts by render phase and material family.

Focused tests stringify the summary and verify it omits source mesh/material
keys, GPU-like markers, render IDs, and entity refs.

### Backend cache reports remain separate

No WebGPU app report fields were changed. The helper is exported from
`@aperture-engine/render` through the existing render package barrel, but it is
not wired into `WebGpuAppResourceReuseReport`, prepared mesh/material cache
summaries, texture/sampler cache summaries, pipeline counters, bind group
counters, or draw package counts.

This preserves the distinction between:

- queue summaries: derived render queue item counts;
- resource reuse reports: backend GPU/cache behavior;
- facade summaries: renderer-independent prepared asset readiness;
- app counts: frame-level draw package/command/call totals.

## Result

No ownership or report-shape drift found.

The helper is safe as a renderer-independent diagnostics utility. If a future
task wires material queue phase summaries into app/frame reports, that task
should decide whether a caller-owned summary scratch is needed before using it
on the successful frame hot path.
