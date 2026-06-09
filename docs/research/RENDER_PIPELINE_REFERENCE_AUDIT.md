# Render Pipeline Reference Audit

Date: 2026-05-16

## Scope

This audit compares Aperture's current renderer-independent and WebGPU render
pipeline against Three.js and PlayCanvas patterns. It is a planning artifact: it
does not copy reference code and does not authorize a scene graph, WebGL
fallback, or renderer-owned ECS state.

Canonical references:

- Three.js: `./references/three.js`
- PlayCanvas: `./references/engine`

Representative reference files inspected:

- Three.js `src/renderers/common/RenderLists.js`
- Three.js `src/renderers/common/RenderList.js`
- Three.js `src/renderers/common/RenderObjects.js`
- Three.js `src/renderers/common/RenderObject.js`
- Three.js `src/renderers/common/Pipelines.js`
- Three.js `src/renderers/common/Bindings.js`
- Three.js `src/renderers/webgpu/WebGPUBackend.js`
- PlayCanvas `src/scene/frame-graph.js`
- PlayCanvas `src/scene/composition/render-action.js`
- PlayCanvas `src/scene/renderer/render-pass-forward.js`
- PlayCanvas `src/scene/renderer/forward-renderer.js`
- PlayCanvas `src/platform/graphics/bind-group-format.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-render-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-pipeline.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-bind-group.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-draw-commands.js`
- PlayCanvas `src/platform/graphics/webgpu/webgpu-graphics-device.js`

## Current Aperture Pipeline

Aperture already has a useful explicit MVP pipeline:

```text
RenderSnapshot
  -> RenderWorld.applySnapshot
  -> resource binding updates
  -> draw readiness report
  -> RenderWorldDrawPackage plan
  -> DrawCommandDescriptor plan
  -> RenderPassDrawList plan
  -> render pass resource resolution
  -> RenderPassCommand plan
  -> command execution / frame report
```

Strengths:

- Rendering is derived from snapshots and render-world data, not authoritative
  ECS state.
- Pipeline stages are testable plain TypeScript data transforms.
- Diagnostics are JSON-safe and omit raw GPU handles.
- Command planning is explicit enough for inspection and future agent tooling.

Main drift risks:

- Stage vocabulary is still mixed between render bridge and WebGPU helpers.
- Pipeline cache keys are too narrow for future PBR, render targets, and
  multi-pass rendering.
- Bind group layout contracts are implied by unlit helpers instead of expressed
  as reusable layout/slot metadata.
- Render queues do not yet model view/pass/opaque/transparent phase boundaries.
- GPU resource lifetime/version tracking is not formalized.

## Comparison Matrix

| Area                        | Three.js Pattern                                                                                                   | PlayCanvas Pattern                                                                                                                                           | Aperture Decision                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Render object identity      | `RenderObject` is cached from object, material, render context, and lights.                                        | `MeshInstance` and renderer draw-call lists carry per-draw state.                                                                                            | **Adapt**: keep `renderId` from extracted ECS, but add explicit queued draw/pass/material context so renderer cache keys do not collapse unrelated draws.                                           |
| Render lists / queues       | Per scene/camera render lists split opaque, transparent, transparent double-pass, and bundles with stable sorting. | Layer/camera `RenderAction`s identify target, clear flags, transparency, and pass ordering.                                                                  | **Adapt**: add Aperture render queues with view/pass id, queue kind, stable sort key, and material/pipeline grouping.                                                                               |
| Pipeline caching            | Pipelines depend on render object shader/material/context state and shader program reuse.                          | WebGPU pipeline hash includes primitive, shader, cull, depth, blend, vertex format, target, bind group formats, stencil, strip index format, and front face. | **Adopt/Adapt**: expand Aperture pipeline keys to cover render target, bind group layouts, vertex layout, primitive state, depth/stencil/blend/cull/frontFace, shader family, and material variant. |
| Bind group contracts        | Bindings manager creates and updates render-object bind groups from typed binding objects.                         | `BindGroupFormat` explicitly describes resource names, slots, visibility, texture/sampler/storage/uniform types.                                             | **Adopt**: add explicit Aperture bind group layout metadata and validation before more material families or lighting shaders.                                                                       |
| Render passes / frame graph | Render contexts and optional render-pipeline/post pipeline modules separate output concerns.                       | `FrameGraph` owns pass ordering, before/after passes, target clear/store behavior, and pass merge opportunities.                                             | **Adapt later**: add a small Aperture pass descriptor model first; defer full frame graph until multiple views/targets/post passes require it.                                                      |
| Resource lifetime           | Renderer managers track versions and dispose/update associated pipelines, bindings, geometry, textures.            | WebGPU device tracks submit versions, deferred destruction, dynamic buffers, and debug labels.                                                               | **Adopt**: add resource lifetime/version inspection and deferred-destroy planning before advanced pipeline work.                                                                                    |
| Draw command execution      | Draws are submitted from render objects through backend-specific renderer paths.                                   | WebGPU path supports direct state submission and indirect draw command buffers.                                                                              | **Already covered for MVP**: Aperture direct command planning is clear; indirect/multi-draw can be a later optimization.                                                                            |
| Diagnostics / metrics       | Renderer info tracks memory/render/program metrics.                                                                | Debug labels, trace ids, validation asserts, and submit-version guards make GPU failures explainable.                                                        | **Adopt**: keep JSON-safe reports but add phase-level cache/resource metrics and stable debug labels.                                                                                               |

## Best-of-Both Direction

Aperture should take Three.js' separation of render lists, render objects,
pipeline managers, bindings, and resource managers, plus PlayCanvas' explicit
WebGPU layout descriptors, frame pass/action model, detailed pipeline cache key,
and submit/lifetime discipline.

The Aperture-specific version should be:

- ECS/snapshot-first: render queues are derived from `RenderSnapshot` and
  prepared render assets.
- Package-safe: renderer-independent contracts live in `@aperture-engine/render`;
  raw WebGPU handles stay in `@aperture-engine/webgpu`.
- Data-first: phase outputs are serializable or JSON-inspectable where possible.
- Allocation-conscious: frame-loop APIs should write into reusable scratch
  buffers or stable pools; allocating report builders should remain diagnostic
  or setup surfaces.
- Incremental: add typed contracts and diagnostics before introducing a full
  frame graph, transparency system, or PBR shaders.

## Immediate Follow-Up Tasks

1. Add a render frame phase model and phase report that names
   apply/prepare/queue/resolve/command/submit boundaries.
2. Expand the WebGPU pipeline cache key to include the render-target, bind group
   layout, vertex layout, primitive, depth/stencil/blend/cull/front-face, shader
   family, and material variant dimensions.
3. Add explicit bind group layout metadata and validation for group names,
   binding slots, resource types, visibility, and skipped-group errors.
4. Introduce view/pass-scoped render queue records with opaque and transparent
   queue kinds, while preserving current unlit behavior.
5. Add renderer resource lifetime/version inspection so stale resources,
   deferred destruction, and cache counts are visible before PBR work.

## Rejected For Now

- A three.js-style scene graph or mutable object hierarchy as render source of
  truth.
- WebGL compatibility layers or backend abstraction that weakens WebGPU-only
  constraints.
- A full PlayCanvas-style frame graph before Aperture has multiple render
  targets, post-processing, shadow passes, or XR views.
- Indirect draw command buffers as an immediate goal; they should wait until
  batching/instancing pressure justifies the complexity.
