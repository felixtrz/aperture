# Next-Family Route Readiness Audit

Date: 2026-05-18

## Scope

Audit whether the current generic route and bucket contracts are ready for a
test-only non-built-in material-family adapter.

This does not recommend adding product-facing material support yet.

## References Inspected

- `docs/research/GENERIC_ROUTE_SUMMARY_NEXT_FAMILY_HANDOFF_2026_05_18.md`
- `docs/research/GENERIC_BUCKET_DIAGNOSTICS_HANDOFF_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-buckets.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`

## Findings

The route is ready for a test-only adapter spike:

- `queued-material-adapter.ts` already accepts arbitrary string family keys.
- The generic frame-resource collector is parameterized by item, pipeline,
  dependency, frame-option, frame-resource, mesh-resource, and bind-group types.
- The generic bucket helper groups by family string without depending on
  built-in family names.
- Generic summaries are deterministic and JSON-safe.

What is still built-in-specific:

- App orchestration still enters the built-in resource-set path.
- Built-in compatibility arrays remain `unlit`, `matcap`, and `standard`.
- Current browser examples and app diagnostics are built around built-in
  material families.

That means a next-family spike should stay in tests and target generic helpers
directly. It should not add a product-facing material, app route, browser
example, or public diagnostics field yet.

## Boundary Check

A test-only non-built-in adapter can validate the architecture without drift if
it follows these rules:

- Use a fake family name such as `debug-preview` or `custom-preview`.
- Exercise `createQueuedMaterialAdapterRegistry()`,
  `prepareQueuedMaterialFrameResourceSet()`, and
  `createQueuedMaterialFrameResourceBuckets()`.
- Assert summaries under generic family names.
- Do not add a `customPreview` compatibility array.
- Do not add a `customPreviewResourceSet` diagnostics field.
- Do not import ECS world APIs into WebGPU helper tests.

## Next Step

`task-1181` is the smallest implementation follow-up: add a test-only
non-built-in material route adapter that exercises generic queue/resource/bucket
contracts without adding product-facing material support.

## Outcome

The route spine is ready for a test-only non-built-in adapter spike. The app
route is not ready for a real new material family until diagnostics routing uses
generic summaries and avoids new family-specific app fields.
