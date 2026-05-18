# App Diagnostics Bucket Summary Audit

Date: 2026-05-18

## Scope

Audit the app diagnostics summary after `task-1178` routed prepared
frame-resource family counts through the generic bucket summary path.

This checks that public diagnostics remain compatible, deterministic, and
JSON-safe while raw frame-resource buckets stay internal to the WebGPU backend.

## References Inspected

- `docs/research/GENERIC_BUCKET_MIGRATION_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_BUCKET_DIAGNOSTICS_HANDOFF_2026_05_18.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `packages/webgpu/src/webgpu/queued-built-in-resource-set-summary.ts`
- `test/webgpu/queued-built-in-resource-set-summary.test.ts`
- `test/webgpu/app-diagnostics-summary.test.ts`

## Findings

The diagnostics routing is aligned:

- `createQueuedBuiltInAppDiagnosticsSummary()` now passes
  `resources.byFamilySummary` into `createQueuedBuiltInResourceSetSummary()`
  after frame-resource preparation.
- The public app diagnostics field remains `routedResourceSet`.
- The public payload remains a plain
  `QueuedMaterialFrameResourceSetSummary`: `itemCount`, `byFamily`,
  `byPipeline`, and `byFamilyAndPipeline`.
- `byFamily` rows are copied and sorted by family before being returned, so app
  diagnostics do not depend on insertion order from caller-provided bucket
  summaries.
- Tests cover generic and built-in summary compatibility, deterministic family
  ordering, and JSON safety.

## Boundary Check

The raw `QueuedMaterialFrameResourceBuckets.byFamily` map is still used only as
an internal WebGPU preparation structure. It can contain backend frame-resource
objects, so it should not be serialized into app diagnostics or examples.

The diagnostics path consumes only `byFamilySummary`, which contains plain
`{ family, itemCount }` rows. This preserves the ECS/render boundary:

- ECS remains authoritative for authored world state.
- Render extraction and queueing produce derived render data.
- WebGPU preparation owns backend resources.
- App diagnostics expose summaries rather than GPU handles, app payloads, or
  source asset objects.

## Compatibility

Existing app-facing diagnostics remain compatible:

- `routedResourceSet` was not renamed.
- Built-in `unlit`, `matcap`, and `standard` compatibility arrays remain
  internal frame-resource outputs for existing callers.
- No new family-specific diagnostics field was added.
- Future material families can reuse the generic summary path without copying a
  built-in wrapper.

## Follow-Up

The next route/generalization step can stay test-only:

- Plan a non-built-in material family adapter spike that exercises generic
  queue, resource, and bucket contracts.
- Keep the spike out of product-facing material APIs.
- Do not add a family-specific app diagnostics section; use
  `routedResourceSet` summaries.

## Outcome

No corrective code change was needed after the bucket summary routing. The app
diagnostics path now consumes generic bucket summaries for family resource
counts while preserving the existing public diagnostics shape.
