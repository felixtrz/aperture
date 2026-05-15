# Render Extraction, Render World, Diagnostics, And WebGPU Boundary Coverage

This note records the reference-engine coverage for `task-0025` and turns it into an Aperture MVP extraction and renderer-boundary direction. It is a planning artifact only; it does not introduce runtime source changes.

## Scope

The goal is to define how authored ECS state becomes flat render data, how the renderer consumes that data, and which state belongs to a renderer-owned `RenderWorld`.

MVP coverage should include:

- `RenderPacket` and `RenderSnapshot` schemas.
- View, camera, light, mesh draw, material, and asset-readiness packet data.
- Structured skip diagnostics and frame reports.
- Renderer-owned GPU resource lifecycle boundaries.
- Sort keys, batching compatibility, and stable ordering.
- Worker-thread compatibility notes.

## Reference Engine Source Anchors

### three.js

Representative files inspected:

- `src/renderers/common/Renderer.js`
- `src/renderers/common/RenderList.js`
- `src/renderers/common/RenderLists.js`
- `src/renderers/common/RenderObject.js`
- `src/renderers/common/RenderObjects.js`
- `src/renderers/common/RenderContext.js`
- `src/renderers/common/RenderContexts.js`
- `src/renderers/common/Geometries.js`
- `src/renderers/common/Pipelines.js`
- `src/renderers/common/Bindings.js`
- `src/renderers/common/Textures.js`
- `src/renderers/common/Background.js`
- `src/renderers/common/Info.js`
- `src/renderers/webgpu/WebGPUBackend.js`
- `src/renderers/webgpu/WebGPURenderer.js`
- `src/renderers/webgpu/utils/WebGPUAttributeUtils.js`
- `src/renderers/webgpu/utils/WebGPUBindingUtils.js`
- `src/renderers/webgpu/utils/WebGPUPipelineUtils.js`
- `src/renderers/webgpu/utils/WebGPUTextureUtils.js`

Findings:

- `Renderer._projectObject` walks the object hierarchy, filters by visibility and layers, applies frustum checks, splits geometry groups into render items, and pushes lights and renderables into a `RenderList`.
- `RenderList` separates opaque, transparent, and transparent-double-pass items, tracks lights, keeps occlusion-query counts, and applies stable sorting by group order, render order, depth, and object ID.
- `RenderObject` is the renderer-side draw representation. It depends on object, material, geometry, camera, scene, lighting, render context, clipping context, and pass ID. This reinforces that Aperture's renderer cache should be keyed by extracted packet state rather than authoring objects.
- `RenderObjects` caches render objects by object, material, render context, and lights node, and invalidates when material/cache keys change.
- `RenderContext` and `RenderContexts` cache framebuffer, target, viewport, scissor, clear, MRT, depth/stencil, sample-count, and occlusion-query state.
- `Geometries`, `Pipelines`, `Bindings`, and `Textures` are renderer-owned resource managers. They turn CPU-side geometry/material/texture state into GPU buffers, pipelines, bind groups, and texture resources.
- `Info` tracks frame metrics such as draw calls, primitive counts, memory counts, programs, textures, buffers, and render targets.
- `WebGPUBackend` owns adapter/device setup, canvas context configuration, command encoders, render pass descriptors, draw submission, pipeline creation, bind groups, texture utilities, timestamp queries, and device lost/error handling.
- three.js still starts from a mutable object graph. Aperture should retain the render-list/render-object lessons while replacing object traversal with ECS extraction.

### Babylon.js

Representative files inspected:

- `packages/dev/core/src/Rendering/renderingManager.ts`
- `packages/dev/core/src/Rendering/renderingGroup.ts`
- `packages/dev/core/src/Rendering/objectRenderer.ts`
- `packages/dev/core/src/FrameGraph/frameGraph.ts`
- `packages/dev/core/src/FrameGraph/frameGraphObjectList.ts`
- `packages/dev/core/src/FrameGraph/frameGraphRenderContext.ts`
- `packages/dev/core/src/FrameGraph/frameGraphRenderTarget.ts`
- `packages/dev/core/src/FrameGraph/Passes/renderPass.ts`
- `packages/dev/core/src/FrameGraph/Passes/objectListPass.ts`
- `packages/dev/core/src/FrameGraph/Tasks/Rendering/objectRendererTask.ts`
- `packages/dev/core/src/FrameGraph/Tasks/Misc/cullObjectsTask.ts`
- `packages/dev/core/src/Engines/webgpuEngine.ts`
- `packages/dev/core/src/Engines/thinWebGPUEngine.ts`
- `packages/dev/core/src/Engines/renderTargetWrapper.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuRenderTargetWrapper.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuCacheRenderPipeline.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuCacheBindGroups.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuDrawContext.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuMaterialContext.ts`
- `packages/dev/core/src/Engines/WebGPU/webgpuTextureManager.ts`

Findings:

- `RenderingManager` dispatches submeshes, sprites, and particles into rendering groups per frame unless state persistence is explicitly enabled.
- `RenderingGroup` splits submeshes into opaque, alpha-test, transparent, and depth-only queues. Transparent rendering sorts by alpha index and distance, while opaque/alpha-test queues can use custom sort functions or material/geometry grouping.
- `ObjectRenderer` builds pass-local object lists with camera, render-list predicates, particle/sprite toggles, bounding-box and outline options, depth pre-pass control, layer-mask checks, and clustered-light options.
- `FrameGraph` records tasks into passes, validates pass readiness, allocates/reuses textures, waits for resource readiness, and executes passes through render contexts.
- `FrameGraphRenderPass` binds render targets and validates that a pass has color or depth output. `FrameGraphObjectListPass` validates that object lists were produced before use.
- `RenderTargetWrapper` and `WebGPURenderTargetWrapper` own render-target textures, depth/stencil textures, sample counts, layer/face indices, read-only flags, and optional GPU timing counters.
- `WebGPUEngine` requests adapters/devices, records upload/render encoders, begins and ends render passes, flushes command buffers, tracks device loss/errors, and resets per-frame caches.
- `WebGPUCacheRenderPipeline` encodes shader, raster, depth/stencil, MRT, texture, vertex, and render-target state into pipeline cache keys.
- `WebGPUCacheBindGroups` caches bind groups from uniform/storage buffers, samplers, textures, and material/draw contexts, with debug errors for missing resources.
- Babylon's frame graph is more feature-rich than Aperture's MVP needs, but it validates the need for explicit pass resources, object-list validity, readiness checks, and renderer-owned resource caches.

### PlayCanvas

Representative files inspected:

- `src/scene/mesh-instance.js`
- `src/scene/layer.js`
- `src/scene/composition/layer-composition.js`
- `src/scene/composition/render-action.js`
- `src/scene/frame-graph.js`
- `src/scene/renderer/renderer.js`
- `src/scene/renderer/render-pass-forward.js`
- `src/scene/renderer/frame-pass-update-clustered.js`
- `src/scene/renderer/shadow-renderer.js`
- `src/scene/renderer/shadow-renderer-directional.js`
- `src/scene/renderer/shadow-renderer-local.js`
- `src/scene/renderer/world-clusters-allocator.js`
- `src/framework/components/render/component.js`
- `src/framework/components/render/system.js`
- `src/framework/components/camera/component.js`
- `src/platform/graphics/webgpu/webgpu-graphics-device.js`
- `src/platform/graphics/webgpu/webgpu-render-target.js`
- `src/platform/graphics/webgpu/webgpu-render-pipeline.js`
- `src/platform/graphics/webgpu/webgpu-bind-group.js`
- `src/platform/graphics/webgpu/webgpu-texture.js`
- `src/platform/graphics/webgpu/webgpu-buffer.js`
- `src/platform/graphics/webgpu/webgpu-draw-commands.js`

Findings:

- `MeshInstance` is the draw-facing representation of a mesh, material, transform node, bounds, shader variants, skin/morph state, instancing, indirect draw state, and picker ID. Aperture should split these into ECS components, asset handles, extraction packets, and renderer resources.
- `Layer` stores mesh instances, lights, cameras, shadow casters, visible instances per camera, sorting modes, clear flags, and light splits.
- `LayerComposition` produces ordered `RenderAction` entries from cameras and sublayers, including opaque/transparent passes, render targets, clear behavior, camera priority, post-processing boundaries, and camera stacking behavior.
- `Renderer.cullComposition` updates cameras/frustums, culls lights and mesh instances per camera/layer, records visible opaque/transparent buckets, prepares shadow culling, and tracks stats.
- `RenderPassForward` executes render actions by binding camera/layer/target state, firing pre/post events, choosing shader pass, applying clears, and calling `renderForwardLayer`.
- `FrameGraph` records render passes, compiles them, merges compatible adjacent passes, preserves attachments when later passes do not clear, and delays cubemap mipmap generation when possible.
- `WebgpuGraphicsDevice` owns command encoders, deferred resource destruction, pipeline and compute caches, bind group formats, draw submission, indirect draw buffers, queue submit, and frame statistics.
- `WebgpuRenderPipeline` hashes primitive topology, shader, cull/depth/blend state, vertex formats, render target key, bind group layouts, stencil state, index format, and front face to cache pipelines.
- `WebgpuBindGroup` validates and creates GPUBindGroups from uniform buffers, textures, samplers, storage textures, and storage buffers.
- PlayCanvas has a mature render-action model that maps well to Aperture's future render passes, but Aperture's first boundary should be a flat snapshot rather than mutable `MeshInstance` objects.

## Aperture Extraction Model

### Render Extraction System

`RenderExtractSystem` should run after transform resolution, asset status updates, visibility/layer updates, animation pose extraction, and light extraction. It reads ECS authoring data and asset registry metadata, then writes a flat `RenderSnapshot`.

Rules:

- Extraction is the only first-class boundary between ECS simulation and rendering.
- The renderer consumes immutable snapshot data for a frame.
- The renderer must not read ECS components directly during draw submission.
- Snapshot fields must be serializable or transferable enough for future worker-mode simulation.
- Extraction should copy only IDs, handles, numeric flags, matrix columns, bounds, and packet indices. GPU objects, DOM objects, closures, and mutable math classes are forbidden in packets.

### Render Snapshot

Recommended shape:

```ts
interface RenderSnapshot {
  frameId: number;
  worldVersion: number;
  views: ViewPacket[];
  meshDraws: MeshDrawPacket[];
  lights: LightPacket[];
  environments: EnvironmentPacket[];
  shadowRequests: ShadowRequestPacket[];
  worldTransforms: Float32Array;
  bounds: BoundsPacket[];
  skinPalettes: SkinPalettePacket[];
  morphWeights: MorphWeightsPacket[];
  diagnostics: RenderDiagnostic[];
  report: RenderSnapshotReport;
}
```

Worker compatibility:

- Use numeric entity IDs plus generations, not object references.
- Use handles as branded strings or small numeric IDs that can cross worker boundaries.
- Use `Float32Array`/`Uint32Array` for matrices, bounds, sort keys, and packed flags.
- Avoid references from packets back into ECS storage.

### View Packets

Recommended shape:

```ts
interface ViewPacket {
  viewId: number;
  cameraEntity: Entity;
  viewMatrixOffset: number;
  projectionMatrixOffset: number;
  viewProjectionMatrixOffset: number;
  frustumIndex: number;
  viewport: NormalizedViewport;
  scissor?: NormalizedViewport;
  clear: ClearState;
  layerMask: number;
  priority: number;
  target: RenderTargetHandle | "canvas";
  sampleCount: number;
}
```

Worker compatibility:

- Matrices live in packed snapshot arrays.
- Render targets are handles, not GPU textures.
- Viewport/scissor values are normalized or integer logical pixels, with backend conversion to physical pixels.

### Mesh Draw Packets

Recommended shape:

```ts
interface MeshDrawPacket {
  packetId: number;
  stableRenderId: number;
  entity: Entity;
  mesh: MeshHandle;
  submeshIndex: number;
  material: MaterialHandle;
  materialSlot: number;
  worldTransformIndex: number;
  boundsIndex: number;
  layerMask: number;
  renderQueue: "opaque" | "alpha-test" | "transparent";
  sortKey: RenderSortKey;
  batchKey: BatchCompatibilityKey;
  skinPaletteIndex?: number;
  morphWeightsIndex?: number;
  instanceGroupId?: number;
  flags: MeshDrawFlags;
}
```

Worker compatibility:

- Handles identify assets; renderer resolves handles into GPU buffers, textures, samplers, bind groups, and pipelines.
- `sortKey` and `batchKey` are packed numeric data, not comparator closures.
- `stableRenderId` should be deterministic from entity generation plus submesh/material slot.

### Light And Environment Packets

Lighting packets should remain flat and view-independent unless the data is inherently per-view:

- `LightPacket`: entity, kind, world transform index or packed position/direction, color, intensity, range, cone angles, layer mask, shadow settings index.
- `EnvironmentPacket`: handle, intensity/exposure, layer mask, optional skybox/render-background flags.
- `ShadowRequestPacket`: light packet index, caster layer mask, shadow map descriptor handle, requested update mode, and diagnostic flags.

Worker compatibility:

- Light packets contain values, not light objects.
- Shadow requests reference light and view packet indices where needed.
- Environment maps are handles resolved by the renderer or asset backend.

### Bounds Packets

Recommended shape:

```ts
interface BoundsPacket {
  entity: Entity;
  localAabb: Aabb;
  worldAabb: Aabb;
  worldSphere: BoundingSphere;
  source: "mesh" | "collider" | "explicit";
}
```

Bounds packets feed culling, picking, visibility diagnostics, and agent explanations. They should be produced even when a draw is skipped for material or asset readiness when enough mesh metadata exists.

## Render World Boundary

`RenderWorld` is the renderer-owned cache for GPU resources and backend state. It is derived from snapshots and asset registries; it is not authoritative world state.

Allowed `RenderWorld` ownership:

- `GPUAdapter`, `GPUDevice`, `GPUCanvasContext`, and device-lost/error state.
- Swapchain/canvas configuration.
- GPU buffers for mesh vertex/index data.
- Texture, sampler, render target, depth/stencil, and MSAA resources.
- Pipeline, shader module, bind group, and bind group layout caches.
- Per-frame uniform/storage buffers and upload staging buffers.
- Render-target and pass descriptors.
- Renderer metrics and GPU timing queries.
- Mapping from render packet IDs/pick IDs back to ECS entity IDs.

Forbidden `RenderWorld` ownership:

- ECS components.
- Authoritative transforms.
- Scene graph nodes.
- Material authoring state.
- Asset import state beyond renderer readiness/cache entries.
- Gameplay input, physics, or animation state.

## Resource Lifecycle

Recommended renderer lifecycle:

1. `RenderWorld.prepare(snapshot, registries)` validates device state and asset readiness.
2. Mesh/material/texture/render-target handles referenced by the snapshot are resolved to cache entries.
3. Missing/loading/failed/unsupported resources produce diagnostics and skipped draw packets.
4. GPU resources are created or updated from asset versions.
5. Pipelines are resolved from packet pipeline keys.
6. Bind groups are resolved from material, view, light, and mesh resources.
7. Render passes draw sorted packets.
8. The frame report records packet counts, skipped counts, draw calls, pipeline/cache activity, and device errors.
9. Unreferenced GPU resources are retained for an eviction window or released explicitly when assets are unloaded.

## Sort Keys And Batching

Sort key inputs:

- View order: camera priority, stable camera entity ID.
- Render queue: opaque, alpha-test, transparent.
- User render order or material queue.
- Layer order.
- Pipeline key.
- Material handle.
- Mesh handle.
- Submesh index.
- Depth bucket.
- Stable packet ID.

MVP sorting:

- Opaque and alpha-test: view order, queue, layer, pipeline/material/mesh grouping, front-to-back depth, stable packet ID.
- Transparent: view order, queue, layer, user render order, back-to-front depth, stable packet ID.
- Sorting must be deterministic.
- A later renderer may refine sort keys for clustered lighting, pass merging, depth pre-pass, or order-independent transparency.

Batch compatibility key:

- Mesh handle.
- Submesh index.
- Material handle.
- Pipeline key.
- Vertex layout.
- Primitive topology.
- Render target format and sample count.
- Layer/pass bucket.
- Skin/morph/instancing flags.
- Texture/sampler binding layout.

Instancing is allowed only when per-instance data can be represented as flat arrays and all compatibility fields match.

## Diagnostics And Reports

Recommended skip diagnostics:

- `render.noWorldTransform`
- `render.disabled`
- `render.invisible`
- `render.zeroLayerMask`
- `render.noMatchingViewLayer`
- `render.frustumCulled`
- `render.missingMeshHandle`
- `render.meshLoading`
- `render.meshFailed`
- `render.meshMissingPosition`
- `render.invalidSubmesh`
- `render.unsupportedPrimitiveTopology`
- `render.missingMaterialHandle`
- `render.materialLoading`
- `render.materialFailed`
- `render.textureLoading`
- `render.textureFailed`
- `render.unsupportedMaterialFeature`
- `render.pipelineUnsupported`
- `render.noCamera`
- `render.invalidCamera`
- `render.invalidRenderTarget`
- `render.webgpuUnavailable`
- `render.deviceLost`

Recommended report shape:

```ts
interface RenderSnapshotReport {
  frameId: number;
  views: number;
  candidateRenderables: number;
  emittedDrawPackets: number;
  skippedRenderables: number;
  lights: number;
  shadowRequests: number;
  visibleBounds: number;
  drawCallsSubmitted?: number;
  pipelineCacheHits?: number;
  pipelineCacheMisses?: number;
  bindGroupCacheHits?: number;
  bindGroupCacheMisses?: number;
  gpuResourcesCreated?: number;
  diagnosticsByCode: Record<string, number>;
}
```

Diagnostics should reference entity IDs, packet IDs, asset handles, view IDs, render target handles, and actionable reasons. Agent-facing tools should be able to answer why an entity did not draw from the report alone.

## Future Implementation Acceptance Tests

- Extraction emits one `MeshDrawPacket` per visible submesh/material slot.
- Invisible or disabled renderables are skipped with structured diagnostics.
- Renderables without `WorldTransform` are skipped with `render.noWorldTransform`.
- Missing mesh handles and missing material handles produce distinct diagnostics.
- Loading mesh/material/texture handles skip draw packets without throwing.
- A mesh without `POSITION` emits `render.meshMissingPosition`.
- Cameras sort by priority and stable entity ID.
- Layer masks filter draw packets per view deterministically.
- Opaque sort keys group compatible pipeline/material/mesh packets while preserving stable tie-breaking.
- Transparent sort keys order back-to-front per view.
- `RenderSnapshot` contains no `GPUDevice`, `GPUBuffer`, `GPUTexture`, DOM canvas, closure, or ECS storage reference.
- `RenderWorld` can recreate GPU resources from handles and asset versions after device loss.
- Pipeline keys change when vertex layout, material feature bits, render state, target format, or sample count changes.
- Bind group cache keys change when material textures or samplers change.
- Frame reports count candidate renderables, emitted packets, skipped packets, and submitted draw calls.
- GPU resource ownership tests verify ECS components store handles only.

## Architectural Guardrails

- ECS is the source of truth; rendering is a derived view.
- Render extraction is a pure data boundary, not a side-channel into the renderer.
- `RenderWorld` may cache GPU resources and packet mappings, but it cannot own gameplay state.
- WebGPU is the only backend.
- Diagnostics are first-class data and should be available before a WebGPU device exists.
- Worker-mode simulation remains possible because snapshots and reports are transferable data.
