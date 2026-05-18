# Generic Material-Family Prepared Route Migration Plan

Date: 2026-05-18

## Scope

Plan the next small implementation slice after generic queued material
frame-resource collection and generic resource-set summaries. The goal is to
reduce built-in-specific app route coupling before adding another material
family.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_APP_ROUTE_SUMMARY_MIGRATION_PLAN_2026_05_18.md`
- `docs/research/GENERIC_QUEUED_RESOURCE_SUMMARY_MIGRATION_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/app.ts`

## Current Shape

The generic collector owns the family-independent frame-resource loop:

- pipeline lookup and pipeline-view validation
- one pipeline plan result per pipeline key
- texture/sampler dependency preparation
- frame-resource option creation
- frame-resource creation and route diagnostics
- source mesh/material resource-key maps
- pipeline-scoped bind group collection

The built-in wrapper still owns built-in buckets:

- `QueuedBuiltInFrameResources.unlit`
- `QueuedBuiltInFrameResources.matcap`
- `QueuedBuiltInFrameResources.standard`

The app route still decides whether to enter the queued built-in path and calls
`collectQueuedBuiltInAppResourceSet()` plus
`prepareQueuedBuiltInFrameResourceSet()`. This is acceptable for current
families, but a future material family should not require another parallel
wrapper with family-specific buckets and summary code.

## Commonality To Preserve

The next generic slice should keep these concepts as generic contracts:

- each queued item has a material family, render phase, source mesh key, source
  material key, draw/pipeline key, and adapter
- adapters prepare texture/sampler dependencies
- adapters create frame resources from app-provided frame options
- adapters append family resources into caller-owned buckets or a generic
  per-family resource map
- route diagnostics summarize family, pipeline key, source version, backend
  resource keys, and diagnostic counts without raw GPU resources

## Recommended Next Implementation Slice

Add a generic queued material frame-resource bucket collector that can replace
hard-coded `unlit`/`matcap`/`standard` arrays in the wrapper.

Suggested task:

```md
### task-1173 — Add generic queued material frame-resource buckets

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu` and targeted tests.
Reference anchor:
`docs/research/GENERIC_MATERIAL_FAMILY_PREPARED_ROUTE_MIGRATION_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`, and
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`.

Acceptance criteria:

- Introduce a small generic bucket store keyed by material family.
- Built-in frame-resource appends can write through the generic bucket store
  while preserving the current `unlit`, `matcap`, and `standard` arrays for
  compatibility.
- Tests cover two families and verify JSON-safe bucket summaries without raw GPU
  handles.
```

## Non-Goals

- Do not add a new material family in the same slice.
- Do not change `routedResourceSet` JSON shape.
- Do not move WebGPU device, canvas, queue, or ECS world ownership into generic
  helpers.
- Do not remove the built-in compatibility arrays until current app tests and
  browser examples no longer consume them.

## Outcome

The next migration should be a compatibility-preserving bucket abstraction, not
a rewrite of app orchestration. That keeps the diff reviewable while making the
future material-family path less dependent on built-in names.
