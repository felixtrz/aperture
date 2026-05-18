# Generic Bucket Diagnostics Handoff

Date: 2026-05-18

## Scope

Plan how generic material-family bucket summaries should flow into app
diagnostics after `task-1173`.

This note keeps diagnostics compatibility explicit: use summary rows, do not
expose raw bucket maps, and do not rename `routedResourceSet` casually.

## References Inspected

- `docs/research/GENERIC_BUCKET_MIGRATION_AUDIT_2026_05_18.md`
- `docs/research/GENERIC_QUEUED_RESOURCE_SUMMARY_MIGRATION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`

## Recommended Diagnostics Shape

Keep the existing top-level app diagnostics sections:

- `materialQueue`
- `materialQueueRoute`
- `routedResourceSet`
- `renderFrameQueue`

Do not add a new family-specific diagnostics section for generic buckets. If app
diagnostics need prepared frame-resource family counts, the data should be
folded into the existing route/resource diagnostics as plain summary rows.

The safe payload is:

```ts
readonly byFamilySummary: readonly {
  readonly family: string;
  readonly itemCount: number;
}[];
```

The unsafe payload is the raw `byFamily` bucket map, because it contains backend
frame-resource objects. That map can stay internal to WebGPU preparation but
should not be copied into app diagnostics.

## Compatibility Guidance

Keep for now:

- `routedResourceSet` as the public app diagnostics field.
- Built-in compatibility arrays on `QueuedBuiltInFrameResources`.
- The generic bucket summary helper name and shape, because it is family-neutral
  and deterministic.

Avoid:

- A new `builtInResourceSet`, `standardResourceSet`, or
  `<family>ResourceSet` diagnostics field.
- Serializing the raw `byFamily` `Map`.
- Adding a second summary helper that duplicates
  `createQueuedMaterialFrameResourceBucketSummary()` with built-in naming.

## Implementation Follow-Up

`task-1178` is the smallest implementation follow-up:

- Route app diagnostics that need family resource counts through
  `createQueuedMaterialFrameResourceBucketSummary()`.
- Preserve the public `routedResourceSet` section name.
- Assert deterministic family ordering and JSON-safe output.

`task-1176` should remain focused on generic bucket summary coverage if more
coverage is needed before app routing changes.

## Outcome

The next diagnostics migration should use generic bucket summaries as public
data and leave raw bucket maps as internal WebGPU preparation state.
