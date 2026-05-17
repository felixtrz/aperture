# Generic Material-Family Queue Contract Plan

Date: 2026-05-17

## Context

Aperture now routes built-in unlit, MatcapMaterial, and StandardMaterial app
frames through `MaterialQueueItem` ordering for the supported phases. The route
is still implemented with family-specific branches inside the WebGPU app. That
is acceptable for the proof path, but it should not become the long-term
material architecture.

The next step is a narrow contract that lets each material family provide its
own WebGPU resource preparation and bind-group layout behavior while the app
route remains queue-driven.

## Reference Patterns

- Bevy keeps extraction, material specialization, render-asset preparation, and
  render phases as separate boundaries. Material-specific GPU preparation does
  not make ECS own GPU resources.
- three.js and PlayCanvas both separate render-list ordering from material
  pipeline/resource state. Sorting chooses draw order; material/pipeline code
  resolves the GPU state for each draw.
- Aperture should adapt those concepts around its existing
  `RenderSnapshot`/`MaterialQueueItem` boundary instead of adding a scene graph
  or renderer-owned application state.

## Invariants

- ECS remains authoritative for authored state.
- `RenderSnapshot` stays the worker-friendly render boundary.
- `MaterialQueueItem` ordering remains the app route input for built-in
  material submission.
- WebGPU resources, bind groups, pipeline layouts, and browser validation
  concerns stay in `packages/webgpu`.
- `packages/render` may define serializable descriptors and readiness
  diagnostics, but it must not store GPU handles.
- The queue route must preserve JSON-safe diagnostics for unsupported material
  families, unsupported phases, missing assets, and stale synthetic snapshots.

## Proposed Contract

Introduce a small internal WebGPU adapter shape for queued material families.
The app route should be able to ask an adapter to:

- identify whether it supports a `MaterialQueueItem`;
- prepare texture/sampler dependencies for that item;
- create or reuse the family-specific frame resources using the current
  pipeline's bind-group layouts;
- expose prepared mesh, material, bind-group, and diagnostic data in the common
  shape needed by `writeRenderFramePlanFromSnapshot`;
- describe unsupported phase/family cases as JSON-safe diagnostics.

This contract should begin internal to `packages/webgpu/src/webgpu/app.ts` or a
nearby helper module. It should not become public API until the shape survives
unlit, MatcapMaterial, StandardMaterial, and at least one non-opaque material
family extension.

## First Implementation Slice

Start with the existing supported built-in families only. Do not add new
material behavior in the same change.

1. Define the internal adapter type.
2. Wrap the current unlit, MatcapMaterial, and StandardMaterial preparation
   branches behind adapters.
3. Keep the current optimized multi-unlit shared-mesh path separate until the
   generic path can match its reuse behavior.
4. Preserve pipeline-scoped bind-group resource keys for all non-material
   bind groups.
5. Keep focused tests on queue ordering, resource reuse, unsupported
   diagnostics, and browser WebGPU validation warnings.

## Follow-Up Tasks

- Add the generic queued material resource adapter contract.
- Audit whether single-family and mixed-family app routes can share the same
  adapter path without regressing resource reuse.
- Extend non-opaque queue support to another material family only after that
  family's shader semantics and browser pixel coverage are explicit.
- Consider explicit pipeline layouts only if auto-layout pipeline scoping keeps
  creating brittle bind-group behavior.
