# Generic App Adapter Contract Readiness Audit

Date: 2026-05-18

Task: `task-1647`

## Scope

Audit whether Aperture's current queued material app contracts are ready for a
future non-built-in material family without adding public custom material
authoring, shader code, examples, or browser fixtures.

Reference files inspected:

- `docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/render/src/materials/types.ts`

## Generic-Ready Contracts

These contracts are already shaped around route-family strings and typed
adapters rather than a hard-coded built-in material union:

- `QueuedMaterialAdapterRegistration<Kind extends string>` and
  `createQueuedMaterialAdapterRegistry()` accept arbitrary family keys, preserve
  registration order, and produce JSON-safe duplicate-family diagnostics.
- `QueuedMaterialPrepareRouteAdapter<Kind, TMaterial, TDiagnostic>` exposes
  `acceptsMaterial()`, `validateQueueItem()`, and `prepareRoute()` through
  generic material and diagnostic parameters.
- `routeQueuedMaterialPrepare()` already handles missing adapter and material
  mismatch failures before family-specific route preparation.
- `QueuedMaterialAppResourceItem<TMaterial, TAdapter>` carries source draw,
  mesh/material keys, route result, adapter, and material data without requiring
  a built-in family.
- `prepareQueuedMaterialFrameResourceSet()` is generic over item, pipeline,
  layout, texture/sampler dependencies, frame options, frame resources, mesh
  resources, and bind-group resources. It also centralizes pipeline-layout,
  dependency, frame-resource, resource-key, and bind-group collection behavior.
- The extracted frame-resource route diagnostic helper added earlier in this
  run accepts generic route shells, so app-level frame-resource failure
  reporting no longer needs a built-in-only diagnostic constructor.

This means the next implementation can be a focused type/unit-test proof around
the generic route and frame-resource contracts. It does not need a public custom
material API or a rendered WebGPU fixture yet.

## Built-In Or App Policy Boundaries

The following boundaries intentionally remain built-in-specific:

- `MaterialAsset.kind` in `packages/render/src/materials/types.ts` is the
  closed built-in union: `unlit | matcap | standard | debug-normal`.
- `BuiltInMaterialQueueRouteAdapter` narrows to `BuiltInMaterialAsset` and maps
  one route adapter per built-in queue family.
- `QueuedBuiltInAppResourceAdapter` composes built-in route adapters with
  built-in texture/sampler and frame-resource callbacks.
- `validateQueuedBuiltInAppResourceAdapterRegistry()` checks only the built-in
  families and reports `queuedBuiltInAppResourceAdapter.missingFamily`.
- `collectQueuedBuiltInAppResourceSet()` indexes source assets from the public
  asset registry and routes only the public built-in `MaterialAsset` union.
- `prepareQueuedBuiltInFrameResourceSet()` still projects generic frame-resource
  output into built-in arrays: `unlit`, `matcap`, `standard`, and
  `debugNormal`.
- `createWebGpuApp()` wires a singleton built-in adapter registry and built-in
  frame-resource caches. It does not accept app-owned material adapter
  registration yet.

These are policy boundaries, not defects. They keep Decision 0010 intact:
generic route-family strings are allowed at queue and app adapter boundaries,
but public source material kinds remain closed until Aperture records a custom
material source API decision.

## Blockers For Real Non-Built-In Rendering

Real custom-family rendering still needs separate decisions or implementation
slices:

- There is no public source material asset shape outside the built-in
  `MaterialAsset` union.
- The WebGPU app has no public option for registering app-owned route/resource
  adapters.
- The app resource cache has built-in frame-resource cache slots instead of a
  generic family-keyed resource cache.
- Pipeline selection, material bind-group layout lookup, texture/sampler
  preparation, and frame-resource creation are still selected through built-in
  family branches.
- Browser/example status surfaces currently report built-in material behavior;
  exposing custom family state would need a separate public API and diagnostics
  decision.

## Recommended Next Task

Implement a test-only generic app adapter contract proof.

Suggested task:

### task-1650 — Prove generic app adapter contract with test-only family

Category: `webgpu-render`
Package/write-scope:
`test/webgpu` plus targeted generic type/helper files only if a tiny mismatch is
found.
Reference anchor:
this audit,
`docs/research/NON_BUILT_IN_APP_MATERIAL_ADAPTER_DECOMPOSITION_2026_05_18.md`,
`packages/webgpu/src/webgpu/queued-material-adapter.ts`,
`packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
`packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`, and
`packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`.

Acceptance criteria:

- Define a test-only material-like object and family key outside public
  `MaterialAsset` exports.
- Register a test-only `QueuedMaterialPrepareRouteAdapter` and prove successful
  route preparation through `routeQueuedMaterialPrepare()`.
- Create a `QueuedMaterialAppResourceItem` for the test-only family and pass it
  through `prepareQueuedMaterialFrameResourceSet()` with fake pipeline,
  dependency, frame-resource, and bind-group callbacks.
- Assert resource-key mappings, family/pipeline grouping inputs, diagnostics,
  and JSON-safe route/frame-resource failure behavior.
- Do not add public custom material source APIs, shader code, GPU resources,
  WebGPU app options, examples, or browser fixtures.

## Decision

Proceed with the test-only generic contract proof before any app registration
policy or public custom material source API work. No decision record is needed
yet because the next slice remains internal/test-only and preserves the closed
public `MaterialKind` union.
