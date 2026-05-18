# Generic Route Criteria Fixture Audit

Date: 2026-05-18

## Scope

Audit the test-only route criteria fixture added in `task-1193`.

## References Inspected

- `docs/research/REAL_MATERIAL_FAMILY_APP_ROUTE_MIGRATION_CRITERIA_2026_05_18.md`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set-summary.ts`
- `docs/ARCHITECTURE.md`

## Findings

The fixture stays test-only:

- The fake `criteria-preview` family appears in a WebGPU test only.
- No source material asset type, shader, pipeline, app route, browser example,
  GLB mapping, or public product API was added.
- No `criteriaPreviewResourceSet` diagnostics field was added.

The fixture validates the intended criteria:

- Source asset contract: the fake source material is plain data.
- Queue contract: queue family and pipeline key match the route item.
- Prepare contract: prepared mesh/material resource keys match queue data.
- App route contract: source keys are preserved on the route item.
- Compatibility contract: no fake-family compatibility array exists.
- Verification contract: diagnostics remain empty and JSON-safe.

## Boundary Check

No architecture drift was found:

- ECS ownership is not touched.
- WebGPU backend resources are not created.
- Public diagnostics remain summary-shaped through
  `createQueuedMaterialFrameResourceSetSummary()`.
- The fixture does not encourage adding a real material family before
  StandardMaterial route cleanup is pinned.

## Outcome

No corrective code change was needed. StandardMaterial route cleanup
compatibility testing can proceed.
