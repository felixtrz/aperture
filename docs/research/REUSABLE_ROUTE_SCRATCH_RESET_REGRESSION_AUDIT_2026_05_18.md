# Reusable Route Scratch Reset Regression Audit

Date: 2026-05-18

## Scope

Audit the `task-1235` reusable route scratch reset regression for the built-in
app resource collector.

## References Inspected

- `docs/ARCHITECTURE.md`
- `docs/research/NEXT_GENERIC_MATERIAL_ROUTE_CLEANUP_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/reusable-route-collector.ts`
- `test/webgpu/queued-built-in-app-resource-set.test.ts`

## Findings

Pass. The regression is generic route hygiene and does not add
StandardMaterial-specific product behavior.

The test reuses one `QueuedBuiltInAppRouteCollectorScratch` and one
`MaterialQueueScratch` across two collections:

- an unsupported `debug-normal` collection that produces route diagnostics;
- a valid StandardMaterial collection that should start from clean route
  scratch.

The valid collection is asserted to have no diagnostics, one routed
StandardMaterial item, no stale unsupported-family text, no stale
`webGpuApp.materialQueueRouteReport`, and no raw GPU-handle serialization.

The change is test-only. It does not change app route structure, material
families, WebGPU resource ownership, source assets, IBL, shadows, binary GLB
loading, or rendering behavior.

## Validation

- `pnpm exec vitest run test/webgpu/queued-built-in-app-resource-set.test.ts`
- `pnpm exec tsc --noEmit -p tsconfig.test.json`

## Recommendation

Next work should plan a fresh slice. Prefer either a focused generic
material-family route migration criterion or another StandardMaterial/glTF
fidelity diagnostic that can be verified without adding IBL, shadows, binary
GLB viewer behavior, or broad route rewrites.
