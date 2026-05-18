# Generic Frame-Resource Collector Audit

Date: 2026-05-18

## Scope

Audit the generic queued material frame-resource collector introduced after the
built-in frame-resource set split. The goal is to verify the new collector keeps
the app/ECS/render ownership boundary intact before adding more material-family
routes.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/research/GENERIC_MATERIAL_FAMILY_FRAME_RESOURCE_ADAPTER_INTERFACE_PLAN_2026_05_18.md`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`
- `packages/webgpu/src/webgpu/queued-material-frame-resource-route.ts`
- `test/webgpu/queued-material-frame-resource-set.test.ts`
- `test/webgpu/queued-built-in-frame-resource-set.test.ts`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/common/RenderObject.js`

## Findings

The generic collector stays inside the intended WebGPU frame-resource boundary:

- It imports only pipeline-scoped bind group helpers, not `WebGpuApp`, ECS world
  types, `AssetRegistry`, canvas/context objects, device/queue submission, or
  browser globals.
- Its inputs are routed items, caller-owned scratch, and injected callbacks.
  App-owned state can still be closed over by callbacks, but the generic
  contract does not require or accept the broad app facade.
- Scratch reuse is explicit. `resetQueuedMaterialFrameResourceScratch()` clears
  maps, arrays, and pipeline-scoped bind group scratch in place. The built-in
  wrapper additionally clears the `unlit`, `matcap`, and `standard` buckets.
- Built-in material behavior remains adapter/sink-owned. The generic collector
  does not branch on `unlit`, `matcap`, or `standard`; those buckets are only in
  `queued-built-in-frame-resource-set.ts`.
- Pipeline handles remain internal to preparation so bind group layouts can be
  queried, while returned inspection surfaces expose stable keys, resource-key
  maps, diagnostics, and pipeline plan records rather than canvas or queue
  objects.
- The shape follows the reference commonality without importing a scene graph:
  PlayCanvas prepares transient draw/material state before submission, and
  three.js render objects combine material/geometry/context into renderer-owned
  draw state. Aperture's collector does the same kind of derived preparation
  from queued snapshot items and prepared resources.

## Gaps

No corrective code change was needed for this audit.

The remaining coverage gap is already tracked as `task-1152`: the generic
collector has a success-path test and the built-in wrapper has failed-route
coverage, but the generic collector itself still needs a direct failed
frame-resource result test that asserts the injected route diagnostic is
appended and remains JSON-safe.

The route shell can carry arbitrary family diagnostics by design. Family
adapters must continue to keep those diagnostics JSON-safe and avoid raw GPU
handles or source asset payloads.

## Recommendation

Run `task-1152` next before adding more collector behavior. It is the smallest
test-only slice that closes the audit gap without changing the app render loop
or material-family contracts.
