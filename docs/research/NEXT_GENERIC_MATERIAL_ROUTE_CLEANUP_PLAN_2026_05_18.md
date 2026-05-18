# Next Generic Material Route Cleanup Plan

Date: 2026-05-18

## Scope

Plan a narrow generic material route cleanup after the StandardMaterial
format/color-space browser diagnostic fixture.

This is a planning slice. It does not implement the cleanup, change app route
structure, add shader features, add IBL or shadows, add GLB viewer behavior, or
introduce a new material family.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_ROUTE_PREPARED_RESOURCE_PRESSURE_AUDIT_2026_05_18.md`
- `docs/research/STANDARD_MATERIAL_ROUTE_PREPARED_RESOURCE_CLEANUP_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`

## Selected Slice

Add a reusable route-scratch regression for the built-in app resource collector.

The current collector intentionally uses caller-owned route scratch and resets
its reusable route collector on each call. A focused cleanup test should prove
that an unsupported-material collection followed by a valid StandardMaterial
collection with the same route scratch does not leak stale diagnostics,
route-report state, skipped counts, or unsupported-family state into the valid
result.

This is generic route hygiene rather than StandardMaterial feature work. It
exercises the existing built-in route collector with the same scratch object
across calls and asserts the second result is clean and JSON-safe.

## Follow-Up Task

### task-1235 - Add reusable route scratch reset regression

Category: `webgpu-render`
Package/write-scope: `test/webgpu/queued-built-in-app-resource-set.test.ts`
only unless a tiny implementation fix is required.
Reference anchor:
`docs/research/NEXT_GENERIC_MATERIAL_ROUTE_CLEANUP_PLAN_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and
`packages/webgpu/src/webgpu/reusable-route-collector.ts`.

Acceptance criteria:

- Reuse one `QueuedBuiltInAppRouteCollectorScratch` across an unsupported
  material collection and a valid StandardMaterial collection.
- Assert the second collection is valid, has no diagnostics, has one routed
  StandardMaterial item, and does not serialize stale unsupported-family or
  route-report diagnostics.
- Preserve the existing generic route item shape and JSON-safe boundary.
- Do not add app route structure changes, IBL, shadows, binary GLB loading, or
  a new material family.

## Deferred Alternatives

- Real material-family route migration remains larger than this cleanup test.
- StandardMaterial shader/PBR feature work should wait until the route scratch
  reuse boundary is pinned.
- IBL, shadows, and GLB viewer behavior remain deferred.
