# Generic Material-Family Queue Contract Plan - 2026-05-17

## Scope

Plan the next narrow step from Aperture's current built-in material queue route
toward a generic material-family queue contract.

This is a planning slice only. It does not change runtime behavior, shader code,
pipeline creation, bind group creation, render passes, or public app APIs.

## References Inspected

- `docs/NORTH_STAR.md`
- `docs/ARCHITECTURE.md`
- `docs/MEDIUM_LONG_TERM_GOALS.md`
- `packages/render/src/rendering/material-queue.ts`
- `packages/webgpu/src/webgpu/queued-material-adapter.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `packages/webgpu/src/webgpu/material-pipeline-selection.ts`
- `packages/webgpu/src/webgpu/pipeline-cache.ts`
- `references/three.js/src/renderers/webgl/WebGLRenderLists.js`
- `references/engine/src/scene/layer.js`

## Reference Pattern

Three.js collects render items into phase-like opaque/transmissive/transparent
lists, reuses item objects, and sorts opaque draws by render order, material,
variant, depth, and stable id while sorting transparent draws back-to-front.
That architecture is scene-graph-based, but the useful pattern is the separation
between a compact queued item and later material/pipeline handling.

PlayCanvas keeps per-layer visible opaque and transparent draw-call arrays and
sorts them by manual order, material/mesh sort keys, or camera-relative depth.
That system is also scene-object based, but the useful pattern is again the
explicit render phase plus sort mode before command submission.

Aperture's version must stay ECS/snapshot-first:

- ECS extraction produces `MeshDrawPacket`s.
- `writeMaterialQueueFromSnapshot` converts draw packets into sorted
  `MaterialQueueItem`s using prepared mesh/material resource keys.
- WebGPU code owns prepared GPU resources, bind groups, pipelines, and command
  submission.
- Material-family adapters should route queue items into prepared resources and
  draw buckets without reading ECS or becoming a scene graph.

## Current Aperture Shape

Current strengths:

- `MaterialQueueItem` already contains render phase, material family,
  `pipelineKey`, source mesh/material keys, prepared resource keys, mesh layout,
  topology, depth, and a stable sort key.
- `writeMaterialQueueFromSnapshot` has a scratch writer and item pool, aligning
  with the no steady-state allocation decision.
- `createQueuedMaterialAdapterRegistry` already maps material-family strings to
  adapter registrations.
- WebGPU app routing already dispatches unlit, matcap, and StandardMaterial
  texture/sampler preparation, frame-resource creation, and bucket insertion
  through adapters.

Current limitations:

- `QueuedBuiltInMaterialAdapter` is private to `app.ts` and shaped around the
  current built-in frame resource buckets.
- Unknown material-family handling lives at the app route instead of the adapter
  registry/report surface.
- Phase support is hard-coded in `createUnsupportedQueuedBuiltInPhaseDiagnostic`.
- The adapter contract mixes several concerns that should eventually become
  explicit stages: source asset readiness, texture/sampler preparation,
  pipeline/layout selection, frame resource creation, bind group readiness, and
  bucket insertion.
- Adapter output is still built around unlit/matcap/standard bucket arrays
  rather than a generic queued draw resource.

## Minimal Contract Direction

Introduce the next implementation slice as a small WebGPU-owned contract, not a
new ECS or render-bridge abstraction:

```ts
interface MaterialFamilyQueueAdapter {
  readonly family: MaterialQueueFamily;
  validateQueueItem(item: MaterialQueueItem): MaterialQueueDiagnostic | null;
  isSourceMaterial(asset: MaterialAsset): boolean;
  prepareDependencies(
    input: MaterialFamilyDependencyInput,
  ): MaterialFamilyDependencyResult;
  createFrameResources(
    input: MaterialFamilyFrameResourceInput,
  ): MaterialFamilyFrameResourceResult;
  appendDraw(input: MaterialFamilyDrawAppendInput): void;
}
```

The names can change during implementation. The important contract is the stage
split:

1. **Source material assets** remain renderer-independent `MaterialAsset`s in
   `AssetRegistry` / typed asset collections.
2. **Readiness diagnostics** explain missing source material, mismatched
   material kind, unsupported phase, missing texture/sampler dependencies, or
   unsupported render state before GPU work is attempted.
3. **Queue items** remain `MaterialQueueItem`s derived from `RenderSnapshot`,
   not ECS queries.
4. **Prepared WebGPU resources** are created or reused only in
   `@aperture-engine/webgpu`.
5. **Pipeline keys** stay data-driven through `pipelineKey`,
   `materialPipelineKey`, mesh layout, topology, bind group layout keys, and
   material variant state.
6. **Bind groups** are validated/created from renderer-owned resources and
   pipeline layouts.
7. **Draw submission** consumes adapter-produced frame resources or generic draw
   records after queueing and sorting.

## Hot-Path Allocation Notes

The adapter registry may allocate during setup. Frame routing should not allocate
on the success path once caches and scratch buffers are warm.

Implementation implications:

- Keep `writeMaterialQueueFromSnapshot` as the allocation-conscious queue writer.
- Prefer caller-owned arrays/scratch for diagnostics and queued resource items.
- Adapter validation should return stable diagnostic objects only on failure.
- Avoid creating one closure or descriptor wrapper per queue item in the frame
  loop once the generic path replaces the current built-in route.
- Tests may use allocation-friendly convenience helpers.

## Non-Goals

This plan does not add:

- Custom shader authoring.
- Shader graphs.
- New material families.
- IBL, shadows, or new lighting behavior.
- A public material plugin API.
- A scene graph or renderer-owned ECS state.
- Render extraction changes.
- WebGL fallback.

## Proposed Task Sequence

1. Add focused tests around the current adapter registry and app-route
   diagnostics for unknown material families, phase support, and duplicate
   adapter registration behavior. This gives the next refactor a safety net.
2. Extract the built-in adapter type and registry helpers from `app.ts` into a
   WebGPU module without changing behavior.
3. Add a JSON-safe route report for adapter selection failures and successful
   queue item counts by family/phase.
4. Replace the built-in bucket-specific append path with a generic queued draw
   resource shape only after tests prove parity for unlit, matcap, and standard.
5. Audit the new route before adding broader StandardMaterial PBR texture
   support.

## Acceptance For This Plan

- The current family-specific route is identified.
- The minimal generic queue contract is documented.
- Source assets, readiness diagnostics, queue items, prepared resources,
  pipeline keys, bind groups, and draw submission are distinct stages.
- Hot-path allocation constraints and non-goals are explicit.
