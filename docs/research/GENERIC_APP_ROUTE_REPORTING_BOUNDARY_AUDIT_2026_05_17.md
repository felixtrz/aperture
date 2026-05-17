# Generic App Route Reporting Boundary Audit - 2026-05-17

## Scope

Audit `task-0971`, which routed WebGPU app built-in material queue reporting
through `routeQueuedMaterialPrepare()` before built-in family frame resource
preparation.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/research/GENERIC_MATERIAL_ROUTE_CONTRACT_BOUNDARY_AUDIT_2026_05_17.md`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`
- `packages/webgpu/src/webgpu/built-in-material-queue-adapter.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `test/webgpu/webgpu-app.test.ts`
- `references/bevy/crates/bevy_pbr/src/material.rs`
- `references/bevy/crates/bevy_render/src/render_phase/mod.rs`

## Findings

### App Facade Ownership

The WebGPU app now calls `routeQueuedMaterialPrepare()` while collecting queued
built-in app resource items. The call receives:

- the existing adapter registry
- the queued `MaterialQueueItem`
- the ready source `MaterialAsset`
- the material source version
- the snapshot frame

The app still does not mutate or own ECS/source material state. It indexes ready
source assets from the registry for this frame, validates the route, and then
passes the source asset into the existing WebGPU-private resource preparation
helpers.

### GPU Handle Boundary

The route contract result is used as validation/reporting data. The app does
not expose raw GPU handles through route diagnostics or route reports. The route
report continues to include plain queue counts, family/phase buckets, and
diagnostics.

The implementation intentionally preserves two key families:

- Facade queue keys from `MaterialQueueItem.meshResourceKey` and
  `MaterialQueueItem.materialResourceKey`.
- Source-version backend preparation keys from indexed source mesh/material
  assets.

A targeted regression initially caught the risk of feeding facade queue keys
into frame resource preparation, which would have changed backend cache reuse.
The final code keeps frame preparation on source-version keys while using the
generic route result for validation/reporting.

### Diagnostic Compatibility

The generic helper emits generic missing-adapter and material-mismatch
diagnostics. The app maps those back to the established app-facing route codes:

- `webGpuApp.unsupportedMaterialQueueFamily`
- `webGpuApp.materialQueueAssetMismatch`

Existing phase and blend diagnostics already use app-facing codes and pass
through unchanged. Existing route report tests continue to assert JSON-safe
diagnostics for unsupported family, alpha-test, transparent, blend, mismatch,
and route shell reset cases.

### Retained Cache Summary Separation

The new path only affects current-frame route collection diagnostics. It does
not write to `resourceReuse`, prepared mesh/material backend cache summaries, or
texture/sampler cache summaries. Successful frame resource reuse counts remain
unchanged in targeted app tests.

## Result

The `task-0971` wiring stays within the intended boundary. It moves app route
validation/reporting onto the generic contract without moving GPU resource
ownership, changing successful frame output, or merging current-frame route
diagnostics with retained backend cache reporting.

## Follow-Up

`task-0974` should plan the next migration slice: moving more built-in family
frame-resource preparation behind the generic route/adapter contract while
preserving the source-version backend cache key distinction documented here.
