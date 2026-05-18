# Test-Only Adapter Spike Audit

Date: 2026-05-18

## Scope

Audit the `task-1181` non-built-in material adapter spike before any real
material-family work.

This checks that the spike stayed test-only, avoided product-facing APIs, and
did not add a family-specific diagnostics field or built-in-style compatibility
array.

## References Inspected

- `docs/research/NEXT_FAMILY_ROUTE_READINESS_AUDIT_2026_05_18.md`
- `docs/research/TEST_ONLY_NON_BUILT_IN_MATERIAL_ADAPTER_SPIKE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`
- `packages/webgpu/src/webgpu/app-diagnostics-summary.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`

## Findings

The spike stayed inside the test surface:

- The fake `custom-preview` family appears only in docs and WebGPU tests.
- No package export, material asset, shader, pipeline descriptor, bind group
  layout, example, ECS authoring component, GLB mapping, or app facade route was
  added for the fake family.
- No `customPreview` compatibility array was added.
- No `customPreviewResourceSet` or other family-specific app diagnostics field
  was added.
- The test uses the generic adapter registry, generic frame-resource collector,
  generic bucket helper, and generic routed-resource summary shape directly.

## Boundary Check

The tested route validates the intended generic spine:

- A non-built-in family key can be registered and looked up through
  `createQueuedMaterialAdapterRegistry()`.
- Fake frame resources can be prepared through
  `prepareQueuedMaterialFrameResourceSet()` without entering the built-in app
  resource-set wrapper.
- Successful resources are grouped through
  `appendQueuedMaterialFrameResourceBucket()` and summarized through
  `createQueuedMaterialFrameResourceBucketSummary()`.
- The public-style summary still uses the existing `routedResourceSet` shape:
  `itemCount`, `byFamily`, `byPipeline`, and `byFamilyAndPipeline`.

This does not make a new material family product-ready. It only proves that the
generic helpers can support one without copying the built-in wrapper pattern.

## Readiness For Real Family Work

A real material-family implementation is closer, but should still wait for a
small app-route planning step.

Ready now:

- Generic adapter registration by family string.
- Generic frame-resource preparation callbacks.
- Generic family buckets and JSON-safe bucket summaries.
- App diagnostics that can consume generic bucket family counts under the
  existing `routedResourceSet` field.

Still not ready for product work:

- App orchestration still has a built-in resource-set entry path.
- Built-in compatibility arrays still exist for current app callers.
- There is no app-level contract for registering product material-family
  adapters without introducing family-specific route wrappers.

## Recommended Next Step

Plan the real material-family route boundary before adding a product-facing
family. The next slice should define how app orchestration accepts generic
material adapters while keeping built-in compatibility wrappers transitional and
preserving `routedResourceSet` diagnostics.

## Outcome

No corrective implementation change was needed. The spike validates the generic
route and bucket contracts in tests without adding product-facing material
support.
