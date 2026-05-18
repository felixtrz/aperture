# Test-Only Non-Built-In Material Adapter Spike Plan

Date: 2026-05-18

## Scope

Define the smallest non-built-in material-family adapter spike that can exercise
the generic route, frame-resource, and bucket contracts without adding
product-facing material support.

This is a test plan for `task-1181`; it is not a material feature plan.

## References Inspected

- `docs/research/GENERIC_ROUTE_SUMMARY_NEXT_FAMILY_HANDOFF_2026_05_18.md`
- `docs/research/GENERIC_BUCKET_DIAGNOSTICS_HANDOFF_2026_05_18.md`
- `docs/research/NEXT_FAMILY_ROUTE_READINESS_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`

## Selected Spike Shape

Add test-only coverage in `test/webgpu`, using a fake family name such as
`custom-preview`.

The spike should compose existing generic helpers directly:

- `createQueuedMaterialAdapterRegistry()` with a fake adapter registration.
- `prepareQueuedMaterialFrameResourceSet()` with fake queue items and fake
  backend resources.
- `appendQueuedMaterialFrameResourceBucket()` and
  `createQueuedMaterialFrameResourceBucketSummary()` inside the test callback
  path.
- `createQueuedMaterialFrameResourceSetSummary()` with the bucket summary folded
  into the existing `routedResourceSet` shape.

The fake adapter should be minimal: a `kind` string plus any test-local callback
functions needed to produce fake frame resources. It should not be exported from
`@aperture-engine/webgpu`.

## What To Prove

The implementation test should verify:

- A non-built-in family key can be registered and looked up through the generic
  adapter registry.
- Generic frame-resource preparation can prepare two fake `custom-preview`
  items without built-in `unlit`, `matcap`, or `standard` arrays.
- The generic bucket summary reports `custom-preview` deterministically.
- The folded `routedResourceSet` summary keeps the existing public shape:
  `itemCount`, `byFamily`, `byPipeline`, and `byFamilyAndPipeline`.
- JSON output does not contain `GPUDevice`, `GPUBuffer`, `GPUTexture`,
  `bindGroup`, `WebGpuApp`, raw app payloads, or source asset objects.

## Wrappers To Avoid Copying

Do not copy or add equivalents of these built-in compatibility surfaces:

- `createQueuedBuiltInAppResourceAdapterRegistry()`
- `createQueuedBuiltInAppResourceFamilyAdapterTable()`
- `createSingleQueuedBuiltInAppResourceItem()`
- `prepareQueuedBuiltInFrameResourceSet()`
- `createQueuedBuiltInResourceSetSummary()`
- Any `customPreview` compatibility array.
- Any `customPreviewResourceSet` app diagnostics field.

The spike should prove the generic route works without a family-specific app
route wrapper.

## Non-Goals

Do not add:

- A real material asset type.
- A real shader, pipeline descriptor, bind group layout, or browser example.
- A public runtime API for the fake family.
- ECS authoring components.
- GLB material mapping.
- App orchestration for non-built-in families.

## Acceptance Criteria For `task-1181`

- The test-only fake family exercises the generic adapter registry,
  frame-resource preparation, bucket summary, and folded routed-resource
  summary.
- No product-facing material API or built-in-style compatibility array is added.
- No family-specific app diagnostics field is added.
- Targeted WebGPU tests and TypeScript validation pass.

## Outcome

The next implementation slice should stay in tests and use the generic helpers
directly. If that passes, a follow-up audit can decide whether the route is
ready for a real material-family implementation or still needs app-level
generalization.
