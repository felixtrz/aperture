# Generic Material-Family Queue Migration Checkpoint

Date: 2026-05-17

## Scope

This checkpoint identifies the smallest next step from the current built-in
material route toward a generic material-family preparation contract. It does
not change rendering behavior, shader features, or supported material families.

## Reference Patterns Inspected

- `references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`
  keeps pipeline lookup keyed by explicit render state, shader, vertex layout,
  render target, and bind group layouts before issuing WebGPU objects.
- `references/engine/src/scene/renderer/forward-renderer.js` keeps draw-call
  assembly and material/shader switching as renderer-owned frame work, separate
  from source scene data.
- `references/three.js/src/renderers/common/RenderObject.js` treats a render
  object as a derived draw representation tied to material, geometry, context,
  lights, and camera rather than the authoring object itself.
- `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`
  derives WebGPU pipeline descriptors from render object, material, geometry,
  context, and bind group layouts, and avoids redundant pass pipeline changes.

Commonality: the renderer prepares explicit draw-time records and GPU resources
from source objects, but the GPU-facing route is keyed by render-state/material
families and caches, not by mutating authoring state.

## Aperture State

- `packages/render/src/rendering/material-queue.ts` already produces
  deterministic `MaterialQueueItem` records from immutable render snapshots and
  prepared resource key resolvers.
- `packages/webgpu/src/webgpu/queued-material-prepare-route.ts`,
  `queued-material-frame-resource-route.ts`,
  `built-in-material-queue-adapter.ts`, and
  `built-in-material-app-resource-adapter.ts` define adapter-shaped routing and
  frame-resource shells for `unlit`, `matcap`, and `standard`.
- `packages/webgpu/src/webgpu/app.ts` still owns the orchestration loop that
  indexes source assets, builds the queue, routes each item, prepares frame
  resources, and emits route-report diagnostics.
- `packages/webgpu/src/webgpu/prepared-built-in-material-store.ts` keeps family
  caches explicit for the current built-in families.

The useful next migration is therefore not a new queue. It is extracting the
generic built-in queue-to-frame-resource route out of `app.ts` into a focused
module with typed inputs, reusable scratch ownership, and JSON-safe diagnostics.

## Proposed Contract

Add a `queued-built-in-app-resource-set` module in `packages/webgpu/src/webgpu`
that owns the current queue/resource-set collection flow.

Inputs:

- WebGPU app asset registry access for source mesh/material lookup.
- `RenderSnapshot`.
- frame scratch with reusable source-asset maps, route collector, material queue
  scratch, and route report shell.
- prepared mesh/material facade stores.
- built-in app resource adapter registry.

Outputs:

- `valid: boolean`.
- `resourceSet: QueuedBuiltInAppResourceSet | null`.
- diagnostics as JSON-safe route, material, and frame-resource diagnostics.
- no `GPU*` handles in public diagnostics.

Hot-path constraints:

- Reuse the existing scratch maps, material queue scratch, route collector, and
  route report shell.
- Preserve sorted queue order from `writeMaterialQueueFromSnapshot`.
- Avoid per-frame adapter registry construction.
- Do not allocate backend GPU resources inside the queue-route module; frame
  resources remain produced through existing family adapters.

Diagnostics:

- Preserve existing missing adapter, material mismatch, unsupported phase, and
  material queue route report messages.
- Keep route report summaries by material family and render phase.
- Keep skipped routes explicit enough that unsupported future families fail
  with a route diagnostic instead of falling back to a first-material path.

## Smallest Implementation Step

Move the helper types and functions currently embedded in `app.ts` around
`collectQueuedBuiltInAppResourceSet` into a new internal module:

- `QueuedBuiltInAppResourceItem`
- `QueuedBuiltInAppResourceSet`
- route scratch helpers if they can move without pulling broad app internals
- queue item to route-report summary conversion
- unknown diagnostic normalization for route reports

Keep `app.ts` as the caller and keep the existing render path selection logic
unchanged. This makes the material-family preparation boundary reviewable before
adding more glTF/StandardMaterial texture coverage.

## Follow-Up Task

### task-1112 — Extract queued built-in resource-set collector

Category: `webgpu-render`
Package/write-scope: `packages/webgpu/src/webgpu/app.ts`,
`packages/webgpu/src/webgpu/queued-built-in-app-resource-set.ts`, and targeted
WebGPU route tests.
Reference anchor: this checkpoint, `packages/render/src/rendering/material-queue.ts`,
`packages/webgpu/src/webgpu/built-in-material-app-resource-adapter.ts`,
`references/engine/src/platform/graphics/webgpu/webgpu-render-pipeline.js`, and
`references/three.js/src/renderers/common/RenderObject.js`.

Acceptance criteria:

- The queue-to-resource-set collection flow is moved out of `app.ts` without
  changing rendered output or route diagnostics.
- The new module exposes typed input/output contracts and keeps GPU handles out
  of JSON summaries.
- Existing route-report and material-family tests pass, with a targeted test
  covering one successful built-in route and one unsupported-family diagnostic.
- Validation runs `pnpm exec vitest run test/webgpu/material-queue-route-report.test.ts test/webgpu/queued-material-frame-resource-route.test.ts`
  plus `pnpm run build`.
