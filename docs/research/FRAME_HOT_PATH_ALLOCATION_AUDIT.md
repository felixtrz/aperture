# Frame Hot-Path Allocation Audit

Date: 2026-05-16

## Scope

This audit applies decision 0009: render-pipeline APIs that run every frame
should avoid steady-state heap allocation on the successful path. Diagnostic,
setup, asset-preparation, and one-shot inspection helpers may allocate, but
runtime frame loops need reusable writer/scratch APIs.

References:

- `docs/DECISIONS.md` decision 0009.
- `docs/research/RENDER_PIPELINE_REFERENCE_AUDIT.md`.
- Three.js render-list reuse and renderer manager separation.
- PlayCanvas render action, WebGPU pipeline, and resource lifetime discipline.

## Current Inventory

| Area                                      | Current classification                                       | Allocation status                                           | Notes                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| ECS extraction and snapshot creation      | Hot path, future worker boundary                             | Allocates snapshot arrays/packets today                     | Acceptable for current MVP, but should eventually gain snapshot/scratch reuse or delta transport.                                                |
| Transform packing                         | Hot path                                                     | Reusable writer added                                       | `writePackedSnapshotTransforms` reuses source-offset lookup, offset records, diagnostics, result shell, and backing storage when capacity holds. |
| Draw package planning                     | Hot path                                                     | Reusable writer added                                       | `writeRenderWorldDrawPackages` reuses package records, diagnostics, and result shell; the convenience planner still allocates.                   |
| View/pass render queue records            | Hot path                                                     | Reusable writer exists                                      | `writeRenderQueueRecords` reuses records, diagnostics, and result shell; convenience planner is one-shot.                                        |
| Draw command descriptor planning          | Hot path                                                     | Reusable writer added                                       | `writeDrawCommandDescriptors` reuses the mesh lookup map, descriptor records, descriptor arrays, and per-descriptor vertex-buffer key arrays.    |
| Render pass draw-list planning            | Hot path                                                     | Reusable writer added                                       | `writeRenderPassDrawList` reuses pipeline key sets, resolved bind group scratch, draw records, and per-draw key arrays.                          |
| Render pass resource resolution           | Hot path                                                     | Reusable writer added                                       | `writeResolveRenderPassResources` reuses resource lookup maps, resolved draw records, nested bind group/vertex/index records, and result shells. |
| Render pass command planning              | Hot path                                                     | Reusable writer added                                       | `writeRenderPassCommands` reuses command records, diagnostics, sorted bind-group scratch, and result shells.                                     |
| Pipeline cache keys and pipeline creation | Prepare/setup path                                           | Allocates JSON keys and descriptors                         | Acceptable outside the draw loop; future pipeline-specialization cache should avoid recomputing keys every draw.                                 |
| Bind group layout metadata and validation | Prepare/setup path                                           | Allocates maps and diagnostics                              | Acceptable during resource preparation, not every frame.                                                                                         |
| Resource inspection and summaries         | Diagnostic/reporting path                                    | Allocates sorted records and reports                        | Keep out of the successful frame hot path or run at sampled/debug cadence.                                                                       |
| Render-frame summary reports              | Diagnostic/reporting path today, likely runtime status later | Reusable writer added for top-level result and phase shells | `writeRenderFramePlanFromSnapshot` reuses the top-level result shell, phase diagnostics, phase reports, and draw command/draw-list scratch.      |

## Extraction And Packing Findings

The remaining allocation-heavy areas sit before the WebGPU planner:

- `extractRenderSnapshot` builds fresh packet arrays, transform arrays, view
  matrix arrays, diagnostics, and typed arrays every snapshot. That is currently
  acceptable because the snapshot is the explicit worker-friendly copy boundary,
  but a future runtime should decide whether the steady-state API reuses a
  snapshot builder/scratch or emits deltas.
- `packSnapshotTransforms` remains the allocation-friendly convenience helper,
  while `writePackedSnapshotTransforms` is the scratch-backed hot-path API. The
  writer avoids `slice`/spread and only grows the backing `Float32Array` when the
  caller's existing capacity is insufficient.
- `packSnapshotViewUniforms` builds a fresh `Set`, valid-view array, view record
  array, diagnostics, and output `Float32Array`. This should follow the
  transform packer once view/camera work becomes per-frame.
- `planInjectedRenderFrameSnapshotResourceBindings` builds binding arrays,
  diagnostics, a duplicate-id `Set`, and sorted output. It is still used by
  injected/example runners, so runtime orchestration should either avoid it on
  the hot path or add a reusable binding-plan writer.
- `RenderWorld.applySnapshot` still creates `Set`/`Map` instances and
  replacement render objects. This keeps render-world mutation simple for now,
  but a future render world should grow in-place update paths if it becomes a
  true frame-loop runtime object.

## Changes Landed In This Audit

- `createRenderWorldDrawPackageScratch` and `writeRenderWorldDrawPackages` now
  provide a non-allocating steady-state writer for draw package planning.
- The writer avoids the old per-call `Map`, package array, diagnostics array,
  package records, and result object on valid steady-state calls.
- Existing `planRenderWorldDrawPackages` remains as an allocation-friendly
  convenience wrapper for tests, diagnostics, and one-shot use.
- Tests verify draw package record and result object identity are reused across
  repeated successful writes.
- `createRenderFramePlanScratch` and `writeRenderFramePlanFromSnapshot` reuse
  the top-level frame-plan result shell and phase summary shells.
- `createDrawCommandDescriptorScratch` / `writeDrawCommandDescriptors` and
  `createRenderPassDrawListScratch` / `writeRenderPassDrawList` remove the
  obvious successful-path descriptor and draw-list planning allocations.
- `createResolveRenderPassResourcesScratch` /
  `writeResolveRenderPassResources` and `createRenderPassCommandScratch` /
  `writeRenderPassCommands` remove the obvious resource-resolution and
  command-planning allocations.
- `RenderFramePlanScratch` now owns draw-package, draw-command, draw-list,
  resource-resolution, command-plan, and phase-summary scratch objects.
- The extraction/packing audit identified transform packing, view packing,
  resource-binding planning, and render-world snapshot application as the next
  allocation-sensitive boundaries.
- `createPackedSnapshotTransformsScratch` and `writePackedSnapshotTransforms`
  remove the obvious successful-path allocations from transform packing when the
  scratch capacity is already large enough.

## Remaining Risks

- `planRenderFrameFromSnapshot` remains the allocation-friendly convenience
  helper; hot-path callers should use `writeRenderFramePlanFromSnapshot`.
- The snapshot, binding-plan, binding-update result aggregation, and view
  packing layers remain allocation-heavy, which is acceptable for the prototype
  but not for the eventual steady-state runtime.
- Render pass command pooling uses mutable command records. If command shapes
  vary heavily between frames, a future typed per-kind command pool may be
  cleaner than one generic pool.

## Recommended Follow-Up

Add a view-uniform pack scratch writer and then audit whether runtime examples
should use the scratch-backed APIs directly or hide them behind a higher-level
runtime scratch object.
