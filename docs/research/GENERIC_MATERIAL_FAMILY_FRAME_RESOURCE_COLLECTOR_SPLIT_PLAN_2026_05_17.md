# Generic Material-Family Frame-Resource Collector Split Plan

Date: 2026-05-17

## Scope

Plan the next extraction after
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`.

This plan does not change render behavior, material families, shader features,
or app facade APIs. It identifies the smallest follow-up that moves more
renderer-owned queue/frame-resource work out of `app.ts` while preserving the
current ECS/snapshot/WebGPU boundary.

## References Inspected

- `docs/research/GENERIC_MATERIAL_FAMILY_QUEUE_MIGRATION_CHECKPOINT_2026_05_17.md`
- `packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/three.js/src/renderers/common/RenderObject.js`

## Reference Commonality

- PlayCanvas keeps draw-call preparation as renderer-owned frame work and uses a
  reusable `_drawCallList` shell for the transient per-frame result.
- three.js treats a render object as a derived draw representation tied to
  material, geometry, context, camera, lights, and render context rather than as
  the authoring object itself.
- Aperture should keep the same conceptual separation, but its input is
  `RenderSnapshot` plus prepared source assets, not a mutable scene graph.

## Current Aperture State

The latest extraction moved these responsibilities out of `app.ts`:

- source mesh/material asset indexing for queued built-in draws;
- material queue creation from prepared facade resource keys;
- built-in prepare-route adapter dispatch;
- route-report diagnostics for unsupported families and mismatched material
  assets.

`app.ts` still owns `prepareQueuedBuiltInFrameResources()`, which:

- resets per-frame pipeline/resource/bind-group scratch;
- creates or reuses the WebGPU pipeline for each queued item;
- derives pipeline layouts;
- prepares texture/sampler dependencies through the selected adapter;
- calls the family-specific frame-resource adapter;
- appends family resources to buckets;
- writes mesh/material resource-key maps;
- appends pipeline-scoped bind groups;
- returns the first pipeline, pipeline plan list, resource key maps, and a
  `CreateQueuedBuiltInFrameResourcesResult`.

## Recommended Next Split

Add a focused internal module:

```text
packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts
```

Proposed public-to-package contracts:

- `QueuedBuiltInFrameResourceScratch`: pipeline results, mesh resource maps,
  material resource maps, bind group scratch, and family buckets.
- `createQueuedBuiltInFrameResourceScratch()`: reusable scratch constructor.
- `prepareQueuedBuiltInFrameResourceSet(options)`: writes the current
  frame-resource preparation result from a `QueuedBuiltInAppResourceSet`.
- `QueuedBuiltInFrameResourcePreparationCallbacks`: injected app-specific
  callbacks for pipeline lookup, layout lookup, texture/sampler dependency
  preparation, frame-resource option creation, and frame-resource route
  diagnostics.

Keep these app-owned for now:

- WebGPU device/canvas/context access.
- Pipeline cache maps and layout cache maps.
- The concrete family adapter table that closes over `createOrReuse*` helpers.
- `renderQueuedBuiltInWebGpuAppFrame()` and boundary assembly.

This keeps the new module renderer-owned and WebGPU-specific, but avoids making
it depend on the full `WebGpuApp` object or on canvas submission details.

## Hot-Path And JSON-Safety Notes

- The split should reuse the existing scratch arrays/maps; it should not create
  new maps per frame.
- The module may return raw pipeline handles inside internal render-frame plans,
  but diagnostics and route shells must stay JSON-safe and omit `GPU*` handles.
- Failure diagnostics can allocate; valid-frame steady-state should continue to
  reuse scratch shells.

## Follow-Up Implementation Task

### task-1127 — Extract queued built-in frame-resource preparation set

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-frame-resource-set.ts`, and targeted
WebGPU route/frame-resource tests.
Reference anchor: this plan,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/engine/src/scene/renderer/forward-renderer.js`, and
`references/three.js/src/renderers/common/RenderObject.js`.

Acceptance criteria:

- Move `prepareQueuedBuiltInFrameResources()` scratch ownership and result
  assembly out of `app.ts` without changing rendered output or diagnostics.
- Keep pipeline lookup, layout lookup, and app/device-specific frame-resource
  callbacks injected from `app.ts`.
- Preserve JSON-safe frame-resource route diagnostics and resource reuse
  counters.
- Existing queued route tests and full `standard-gltf-texture` browser spec
  pass, plus a targeted test for one successful prepared frame-resource set and
  one failed frame-resource route diagnostic.
