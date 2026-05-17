# Built-In Material Adapter Route Extraction Plan - 2026-05-17

## Scope

Plan the smallest safe extraction of built-in material adapter routing out of
`packages/webgpu/src/webgpu/app.ts`.

This is a planning slice only. It does not move code, change runtime behavior,
change pipeline creation, change bind group creation, or alter draw submission.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_CONTRACT_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_APP_MATERIAL_QUEUE_ROUTE_REPORT_PLAN_2026_05_17.md`
- `docs/research/WEBGPU_MATERIAL_QUEUE_ROUTE_REPORT_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/material-queue-route-report.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Current Coupling In `app.ts`

The current built-in route keeps these concerns in one file:

- `QueuedBuiltInMaterialAsset`
- `QueuedBuiltInAppResourceItem`
- `QueuedBuiltInAppResourceSet`
- source mesh/material asset indexing structures
- queue route scratch maps/arrays
- `QueuedBuiltInMaterialAdapter`
- `QUEUED_BUILT_IN_MATERIAL_ADAPTERS`
- unsupported phase/blend diagnostics
- queue item to source asset validation
- texture/sampler preparation dispatch
- frame-resource creation dispatch
- family bucket append
- pipeline/layout preparation and draw resource collection

This shape works for the proof path, but it makes the next material family or
route report harder to add without editing the large app facade.

## Smallest Extraction Step

Do not start by moving GPU resource creation. First extract the pure adapter
contract and built-in adapter registration factory:

```ts
// proposed module name
packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts

export type BuiltInMaterialQueueFamily = "unlit" | "matcap" | "standard";

export interface BuiltInMaterialQueueAdapter extends
  QueuedMaterialAdapterRegistration<BuiltInMaterialQueueFamily> {
  readonly kind: BuiltInMaterialQueueFamily;
  isMaterialAsset(material: MaterialAsset): material is BuiltInMaterialAsset;
  validateQueueItem(item: MaterialQueueItem): WebGpuAppUnsupportedMaterialQueueDiagnostic | null;
}

export function createBuiltInMaterialQueueAdapterRegistry(...): QueuedMaterialAdapterRegistry<BuiltInMaterialQueueAdapter>;
```

The first extraction should move only:

- built-in family names
- material asset type guards
- queue item phase/blend validation
- duplicate-family registry diagnostics
- JSON-safe registry inspection

Keep these in `app.ts` for the first extraction:

- `WebGpuApp`
- `WebGpuAppResourceCache`
- texture/sampler preparation functions
- frame resource creation functions
- WebGPU pipeline/layout preparation
- concrete unlit/matcap/standard frame resource buckets
- draw submission and render report assembly

Reason: those functions depend heavily on app/cache/scratch types, concrete
resource caches, and pipeline layout handles. Moving them first would create a
large mechanical refactor without improving the contract boundary.

## Validation Required

Before and after extraction, keep focused tests around:

- unknown material family diagnostics
- alpha-test and transparent family diagnostics
- StandardMaterial unsupported blend diagnostics
- material kind mismatch diagnostics when available
- queued adapter duplicate-family diagnostics
- route report JSON safety
- unlit/matcap/standard successful frame paths

Broad validation should include:

- `pnpm exec vitest run test/webgpu/queued-material-adapter.test.ts test/webgpu/queued-material-adapter-json.test.ts`
- `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/material-queue-route-report-json.test.ts test/webgpu/material-queue-route-report-diagnostics.test.ts`
- Focused `test/webgpu/webgpu-app.test.ts` material queue diagnostics cases.
- `pnpm exec tsc --noEmit -p tsconfig.test.json`
- `pnpm run check:boundaries`

## Non-Goals

The first extraction should not:

- Change supported material families.
- Change queue sorting or phase ordering.
- Change shader, pipeline, bind group, or resource cache behavior.
- Move frame resource creation out of `app.ts`.
- Introduce a public plugin API.
- Move routing into ECS or render extraction.
- Add new PBR, IBL, shadow, or GLB viewer behavior.

## Follow-Up Implementation Slice

The next implementation task should move the built-in family type guards and
phase validation into a new WebGPU module, export the built-in adapter registry
factory, update `app.ts` to import it, and prove with focused tests that queue
diagnostics and successful built-in material rendering behavior are unchanged.
