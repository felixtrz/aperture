# Generic Material-Family Frame-Resource Adapter Readiness Audit

Date: 2026-05-18

## Scope

Audit whether the current generic queue and prepared-resource contracts are
ready for the next material-family frame-resource adapter migration slice.

## References Inspected

- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/webgpu-app.test.ts`

## Findings

Ready for one more targeted route/prepared-resource regression before broad
migration.

What is already pinned:

- `createQueuedMaterialAdapterRegistry()` accepts arbitrary family keys,
  preserves first-match behavior, and reports duplicate registrations through
  JSON-safe diagnostics.
- `createQueuedMaterialAppResourceItem()` can carry a test-only material family
  without adding built-in compatibility fields.
- `prepareQueuedMaterialFrameResourceSet()` is already generic over items,
  pipeline results, dependency results, frame-resource options, frame-resource
  results, mesh resources, and bind groups.
- Generic frame-resource tests cover a test-only non-built-in adapter,
  duplicate pipeline-key reuse, injected frame-resource failure diagnostics, and
  texture/sampler dependency failures before frame-resource creation.
- App-level route tests cover valid but unregistered route keys and material
  family/source asset mismatches without fallback rendering.

Remaining boundary risk:

- The built-in app route collector still owns source asset indexing, adapter
  selection, route diagnostics, and built-in frame-resource compatibility arrays
  in one module.
- Dependency failures currently return dependency diagnostics directly from the
  generic collector, while frame-resource failures also get an injected route
  diagnostic. That is acceptable today, but the app-level migration should
  explicitly decide which failures need route-shell diagnostics and which should
  remain source/dependency readiness diagnostics.
- The migration should not accept broad app objects such as `WebGpuApp` in a
  generic adapter contract when it only needs prepared data, injected callbacks,
  layout access, and caller-owned scratch.

Smallest coherent next implementation:

Add a focused WebGPU unit regression that pins the route/prepared-resource
failure contract before migration:

- use the existing generic frame-resource collector with a test-only family;
- fail texture/sampler dependency preparation;
- assert frame-resource creation and append callbacks are not called;
- assert diagnostics remain JSON-safe and do not include raw GPU handles,
  source asset payloads, or app objects;
- assert the result still records the planned pipeline key but no mesh/material
  resource keys or bind groups.

This is intentionally a regression over the existing generic surface, not a new
public app-level non-built-in material route. Once this is pinned, the following
migration can extract a built-in adapter/sink wrapper with less ambiguity.

Boundary checks:

- ECS remains authoritative; no source components, source assets, or snapshots
  change.
- Render extraction remains unchanged.
- WebGPU resources remain backend-owned and are not exposed in JSON diagnostics.
- App-level non-built-in rendering, binary GLB loading, IBL, shadows, GLB viewer
  behavior, and rendered material behavior remain deferred.

## Recommendation

Add the dependency-failure route/prepared-resource regression next. Do not start
the broader built-in wrapper migration until that failure contract is pinned.

## Validation

- Audit backed by existing route/prepared-resource tests:
  `test/webgpu/queued-material-app-resource-item.test.ts`
  `test/webgpu/queued-material-frame-resource-set.test.ts`
  `test/webgpu/webgpu-app.test.ts`
