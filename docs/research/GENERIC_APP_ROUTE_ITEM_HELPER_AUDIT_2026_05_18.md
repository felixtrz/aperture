# Generic App Route Item Helper Audit

Date: 2026-05-18

## Scope

Audit the generic app material route item helper added in `task-1184`.

This checks package boundaries, public API shape, built-in compatibility, and
whether the helper accidentally introduced product-facing fake material support.

## References Inspected

- `docs/research/APP_LEVEL_GENERIC_MATERIAL_ADAPTER_ROUTE_BOUNDARY_PLAN_2026_05_18.md`
- `docs/research/TEST_ONLY_ADAPTER_SPIKE_AUDIT_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-app-resource-item.ts`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/index.ts`
- `test/webgpu/queued-material-app-resource-item.test.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `docs/ARCHITECTURE.md`

## Findings

The helper is scoped correctly:

- It lives in `@aperture-engine/webgpu`, where app-level WebGPU route item
  composition belongs.
- It imports render package data contracts and generic queued material adapter /
  prepare-route types.
- It does not import `EcsWorld`, `AssetRegistry`, canvas/context/device/queue
  state, raw GPU buffer/texture/bind group types, or app facade state.
- It does not mention `unlit`, `matcap`, `standard`, or `custom-preview`.
- The built-in app resource-set collector can now construct built-in route
  items through the generic helper while keeping existing built-in route output
  shape intact.

The fake `custom-preview` family remains test-only:

- It appears only in docs and WebGPU tests.
- No product-facing material asset, shader, pipeline, bind group layout,
  example, GLB mapping, or app facade route was added.
- No `customPreview` compatibility array was added.
- No `customPreviewResourceSet` diagnostics field was added.

## Boundary Check

The helper is a plain data-construction seam. It does not prepare GPU resources,
route queue items, resolve ECS assets, or own renderer state.

That keeps the architecture aligned:

- ECS and source assets remain authoritative outside the helper.
- Render queue items and prepare routes remain derived data.
- WebGPU frame-resource preparation still owns backend resources.
- Public diagnostics can continue to use `routedResourceSet` summaries rather
  than raw route items or bucket maps.

## Migration Readiness

Built-in route migration can proceed in a narrow compatibility slice:

- Keep `collectQueuedBuiltInAppResourceSet()` as the app-facing built-in
  collector for now.
- Add tests proving built-in wrapper output remains stable when delegating
  through the generic route item helper.
- Do not add a product-facing material family until app route registration and
  compatibility rules are explicit.

## Outcome

No corrective code change was needed. The generic app route item helper is ready
for a built-in wrapper compatibility test slice, but not yet a real material
family route migration.
