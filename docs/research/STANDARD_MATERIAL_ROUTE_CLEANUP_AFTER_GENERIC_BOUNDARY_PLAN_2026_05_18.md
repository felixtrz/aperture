# StandardMaterial Route Cleanup After Generic Boundary Plan

Date: 2026-05-18

## Scope

Plan a StandardMaterial route/preparation cleanup made possible by the generic
app route item boundary.

This is not a shader, PBR, IBL, shadow, or GLB viewer plan.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/REAL_MATERIAL_FAMILY_ROUTE_CRITERIA_AUDIT_2026_05_18.md`
- `docs/research/BUILT_IN_WRAPPER_GENERIC_BOUNDARY_COMPATIBILITY_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/standard-app-frame-resources.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`

## Current Standard Route Shape

The StandardMaterial route is functional but still mixed with built-in app
orchestration:

- `collectQueuedBuiltInAppResourceSet()` routes Standard queue items as
  built-in app resource items.
- `createOrReuseStandardAppFrameResources()` handles Standard app frame-resource
  reuse, prepared mesh reuse, scalar/base-color/metallic-roughness/normal/
  occlusion/emissive prepared material resources, texture/sampler dependency
  keys, view/transform/light dynamic writes, and fallback diagnostics.
- `createStandardFrameGpuResources()` owns Standard backend resource creation,
  including material buffers, material bind groups, light GPU buffers, and light
  bind groups.

This is acceptable today, but compatibility tests should pin the Standard route
before any further generic app-route extraction.

## Selected Cleanup Slice

Add a StandardMaterial route compatibility test that verifies the route item and
frame-resource path agree on the same generic route data.

Recommended assertions:

- A collected Standard item has `queueItem.materialFamily === "standard"` and a
  `prepareRoute.family === "standard"`.
- `prepareRoute.pipelineKey`, `meshResourceKey`, and `materialResourceKey`
  match the queue item.
- App diagnostics summaries still use `routedResourceSet` and do not add a
  `standardResourceSet` field.
- Existing Standard frame-resource reuse behavior remains covered by existing
  app tests; the new test should not duplicate pixel or shader coverage.

## Non-Goals

Do not change:

- Standard WGSL.
- PBR texture feature support.
- Light shader behavior.
- GLB material mapping.
- Browser examples.
- Prepared material cache eviction.

Do not add:

- New StandardMaterial visual features.
- New app diagnostics fields.
- A new product material family.

## Acceptance Criteria For Implementation

- The test runs in `test/webgpu` and validates route/preparation identity only.
- It passes alongside existing app diagnostics and Standard route tests.
- It does not alter public app report JSON or prepared resource behavior.

## Outcome

The next implementation should be a focused compatibility test for the
StandardMaterial route identity across generic route item and built-in
frame-resource preparation boundaries. Broader StandardMaterial PBR work should
wait until this route spine is pinned.
