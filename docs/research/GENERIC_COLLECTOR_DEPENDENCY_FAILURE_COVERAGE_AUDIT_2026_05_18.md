# Generic Collector Dependency-Failure Coverage Audit

Date: 2026-05-18

## Scope

Audit generic queued material frame-resource collector coverage after adding
invalid texture/sampler dependency tests.

## References Inspected

- `docs/research/GENERIC_FRAME_RESOURCE_COLLECTOR_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`

## Coverage Matrix

The generic collector now has direct coverage for:

- success path with generic material resources and no built-in family buckets
- failed frame-resource result with injected route diagnostic
- invalid texture/sampler dependency preparation before frame-resource options
  or resources are created

The dependency-failure test verifies:

- `createFrameResourceOptions()` is not called
- `createFrameResources()` is not called
- `appendFrameResources()` is not called
- mesh/material resource maps remain empty
- bind groups remain empty
- diagnostics stay JSON-safe and do not expose raw GPU handles

The built-in wrapper tests still cover wrapper compatibility over the generic
collector.

## Boundary Check

The generic collector remains inside the intended WebGPU frame-resource
boundary. It still does not import or accept `WebGpuApp`, ECS world access,
canvas/context/queue submission objects, or built-in material-family bucket
names.

Dependency preparation remains adapter/callback-owned. The collector only
short-circuits on the callback result and carries JSON-safe diagnostics forward.

## Remaining Gaps

No corrective code change was needed for this audit.

The next useful generic-summary cleanup is already tracked as `task-1162`: move
the successful queued resource-set summary behind a generic material helper while
keeping the public `routedResourceSet` diagnostics field stable.

Future collector tests may add multi-item mixed success/failure coverage once a
second material family exists. Adding that now would mostly duplicate the
current single-family route behavior.
