# Post-Cleanup Diagnostics And Material Boundary Audit

Date: 2026-05-16

## Scope

This audit reviewed the slices added after the post-proof-point boundary audit:

- WebGPU app frame scratch object and scratch-backed binding planner.
- App facade resource reuse diagnostics.
- Renderer-independent `MatcapMaterialAsset`.
- Renderer-independent material asset dependency readiness reports.

Reference anchors:

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- Bevy render asset and material readiness patterns used as conceptual
  reference for this track.

## Findings

### App Scratch And Cache Ownership

The app scratch objects are owned by `createWebGpuApp` inside the WebGPU
package and are used only to reuse transient frame-planning storage:

- packed view uniforms,
- packed world transforms,
- snapshot resource binding records,
- render-world draw packages,
- draw command descriptors,
- render-pass draw-list records,
- resolved render-pass resources,
- render-pass commands.

This does not make WebGPU authoritative for simulation or source assets.
`app.render()` still starts from an extracted `RenderSnapshot`, source assets
are still read from `AssetRegistry`, and ECS state remains owned by the world.

The app resource cache still stores renderer-owned resources and compact source
asset version keys. It does not store mutable ECS components or source asset
objects as authoritative state.

### Resource Reuse Diagnostics

`WebGpuAppRenderReport.resourceReuse` is JSON-safe count data. It records
pipeline hits/misses, mesh/material buffer creation and reuse, bind group
creation and reuse, light buffer creation and reuse, and dynamic buffer writes.

The report intentionally omits raw device, queue, pipeline, buffer, bind group,
shader module, and texture handles. Existing example status serialization stays
JSON-safe.

The current counters are app-facade diagnostics, not a full prepared-asset cache
model. They explain the proof-point app path while leaving broader render-world
cache reporting for later work.

### MatcapMaterial Source Contract

`MatcapMaterialAsset` is renderer-independent source data:

- material label,
- base color factor,
- required matcap texture/sampler binding,
- render state,
- unsupported feature list.

It participates in material validation, dependency collection, pipeline-key
feature calculation, and typed asset collections. No Matcap WGSL, WebGPU bind
group, WebGPU pipeline, or active rendering path was introduced.

This preserves the material-family order from `MEDIUM_LONG_TERM_GOALS.md`
without activating an incomplete renderer path.

### Material Asset Dependency Readiness

The new material dependency readiness helper operates on a material handle plus
`AssetRegistry`. It reports source asset readiness for texture/sampler slots and
distinguishes missing, registered, loading, failed, and ready dependencies.

The helper is intentionally separate from the existing WebGPU resource-level
material dependency readiness helper. The render-layer helper reports source
asset handles and statuses; the WebGPU helper reports prepared texture/sampler
resource availability. The render-layer type names use `MaterialAsset...` to
avoid ambiguity in umbrella package exports.

### Corrective Fixes

No architecture corrective fixes were needed during this audit.

One naming collision was caught by `pnpm run check`: the new render-layer
dependency readiness types originally collided with existing WebGPU
resource-level readiness type names through the `@aperture-engine/webgpu`
umbrella export. The render-layer types were renamed to
`MaterialAssetDependency...` while retaining the public helper
`createMaterialDependencyReadinessReport(...)`.

## Result

The implementation remains aligned with the architecture:

- ECS is authoritative.
- Rendering is still derived from snapshots.
- GPU resources remain WebGPU-owned.
- MatcapMaterial is source asset data only.
- App reuse and dependency reports are diagnostics, not authoritative renderer
  state.
- JSON-facing status avoids raw GPU handles.

## Recommended Next Work

1. `task-0574` — surface material asset dependency readiness in app render
   failures.
2. `task-0575` — add MatcapMaterial render-preparation metadata plan.
3. `task-0576` — diagnose the app facade's current single-draw resource
   limitation.

## Validation

- `pnpm run check` passed after the audited changes: 155 test files / 725 tests.
- `pnpm exec playwright test test/e2e/spinning-cube.spec.ts` passed after the
  app status/reuse-report change.
- `pnpm run test:e2e` passed: 139 Playwright tests.
