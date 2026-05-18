# Generic Queued Resource Summary Migration Audit

Date: 2026-05-18

## Scope

Audit the successful queued resource-set summary migration after `task-1162`.
The goal is to confirm the public app diagnostics field remains stable while
the internal helper is generic enough for future material families.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`

## Findings

The migration preserves the public diagnostics shape:

- `createWebGpuAppDiagnosticsSummary()` still exposes the field name
  `routedResourceSet`.
- The field type is now `QueuedMaterialFrameResourceSetSummary`.
- The summary JSON shape is unchanged: item count, buckets by family, buckets
  by pipeline, and buckets by family plus pipeline.
- Existing app diagnostics tests still assert the full summary object under
  `routedResourceSet`.

The generic helper has no app or GPU ownership:

- `queued-material-frame-resource-set-summary.ts` accepts only plain items with
  `materialFamily`, `pipelineKey`, and `renderPhase`.
- It does not import `WebGpuApp`, ECS world APIs, devices, queues, canvases,
  pipelines, bind groups, buffers, textures, samplers, or asset registries.
- It returns sorted plain-object arrays and is JSON-safe by construction.

The built-in helper is now a compatibility wrapper:

- `queued-built-in-resource-set-summary.ts` preserves built-in item typing for
  callers that already use `MaterialQueueFamily` and `RenderQueue`.
- It delegates directly to `createQueuedMaterialFrameResourceSetSummary()`.
- It does not reintroduce built-in-specific counting logic.

## Remaining Coupling

The successful app diagnostics assembly still happens in `app.ts` by mapping
queued built-in app resource items into the generic summary item shape. That is
acceptable for this migration slice because app orchestration owns the final
report assembly. The next larger seam is not the summary helper; it is the
route/preparation path that still names built-in adapters and built-in resource
sets.

## Outcome

No corrective code change was needed. The summary migration is aligned with the
generic material-family direction: the public report remains compatible, and
the generic helper stays free of renderer-owned resource handles or ECS/app
state.
