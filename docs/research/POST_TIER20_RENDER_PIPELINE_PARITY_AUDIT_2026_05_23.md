# Post-Tier-20 render pipeline parity audit - 2026-05-23

## Scope

This audit compares Aperture's current covered render pipeline against the local
three.js WebGPU and PlayCanvas WebGPU references after the Tier 20 and
post-Tier-20 material-extension slices shipped.

Reference anchors read:

- `references/three.js/src/renderers/webgpu/WebGPURenderer.js`
- `references/three.js/src/renderers/common/Renderer.js`
- `references/three.js/src/renderers/common/RenderList.js`
- `references/three.js/src/renderers/webgpu/WebGPUBackend.js`
- `references/three.js/src/renderers/webgpu/utils/WebGPUPipelineUtils.js`
- `references/engine/src/framework/app-base.js`
- `references/engine/src/scene/renderer/renderer.js`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/engine/src/platform/graphics/webgpu/webgpu-graphics-device.js`
- `references/engine/src/framework/stats.js`

The backlog anchor `references/three.js/src/renderers/WebGPURenderer.js` is
stale in the local checkout; the actual file is
`references/three.js/src/renderers/webgpu/WebGPURenderer.js`.

## Bottom line

Aperture is close on breadth inside the current WebGPU/ECS scope: worker-owned
ECS snapshots, glTF/GLB loading, compressed assets, StandardMaterial PBR
extensions, skinning, morphing, IBL, shadows, post-processing, MSAA/TAA, screen
effects, picking, batching, and instancing are all represented by visible browser
proofs.

It is not yet SOTA on efficiency. The highest-value gaps are now in command
submission and pressure visibility, not more one-off material slots. The current
command planner emits pipeline, bind group, vertex buffer, and index buffer
commands for every resolved draw. The references both avoid or measure that
pressure:

- three.js `WebGPUPipelineUtils.setPipeline()` caches the active pipeline per
  pass and skips redundant `setPipeline()` calls, while `WebGPUBackend._draw()`
  tracks current bind groups, index buffers, and vertex buffers.
- PlayCanvas `WebgpuGraphicsDevice.draw()` keeps the active pipeline on the
  device and calls `passEncoder.setPipeline()` only when it changes; its app
  stats track cull, sort, forward, material, shader, draw-call, and primitive
  pressure.
- three.js also exposes WebGPU render bundles through `BundleGroup` and supports
  indirect draws from render objects. PlayCanvas supports indirect draw command
  buffers through its `drawCommands` path.

## Phase findings

### 1. Extract

Aperture is ahead of both references architecturally for the intended worker/ECS
runtime shape. three.js and PlayCanvas walk live object/layer state during
render; Aperture extracts serializable snapshots, supports transferable and
SharedArrayBuffer transports, tracks snapshot change sets, and performs
per-camera frustum culling during extraction.

Remaining gap: occlusion feedback and richer visibility explanations. three.js
has an occlusion-query path in `RenderList` and `WebGPUBackend`; Aperture has
frustum culling and entity explanations but no GPU occlusion feedback loop.

### 2. Collect

Aperture is strong. It has source asset status, async image decode, external
URI/image/buffer loading, compression decoder integration, source-view mesh
streams, texture semantic/color-space validation, and explicit unregister/unload
hooks. PlayCanvas has mature asset registries and stats; three.js loaders are
broad, but they do not provide Aperture's snapshot-friendly status boundary.

Remaining gap: broader automatic unload policy, not a blocking SOTA gap for the
next slice.

### 3. Prepare

Aperture is strong on feature coverage and explicit resource contracts. It has
renderer-owned prepared meshes/materials/textures/samplers, pipeline keys, live
StandardMaterial extension variants, custom WGSL material preparation, shadow,
IBL, post-effect, skinning, morph, sprite, skybox, fog, and compressed texture
routes.

Remaining gap: prepared resources do not yet include reusable render bundles or
indirect draw argument buffers for the main forward path.

### 4. Queue

Aperture has deterministic material-family queueing, static merge records,
instancing coalescing, route diagnostics, family summaries, and transparent
phase placement. This is comparable to three.js render lists and PlayCanvas
layer/culled-instance lists, while preserving ECS snapshots.

Remaining gaps: multi-material primitive rules and command-pressure summaries
for queued work.

### 5. Sort

This is the weakest scored phase. Aperture now has stable opaque ordering,
view-relative transparent sorting, total tie-breaks, instancing coalescing, and
static batching. However, it does not yet show whether sorting reduces expensive
state changes, nor does it publish sort duration or pipeline/material/bind-group
pressure.

PlayCanvas tracks sort time, material switches, shader switches, draw calls, and
primitive counts. three.js exposes configurable opaque/transparent sorting and
reuses render-list item objects across frames.

### 6. Submit

Aperture has broad WebGPU submit coverage, but the main efficiency gaps are here:

1. Redundant state commands: `writeRenderPassCommands()` emits `setPipeline`,
   `setBindGroup`, `setVertexBuffer`, and `setIndexBuffer` for each draw instead
   of tracking current state. The executor then calls each emitted command.
2. No render bundle cache for static unchanged command plans, despite snapshot
   change sets being able to identify stable work.
3. No indirect draw command buffer route for compatible grouped draws.
4. No occlusion-query feedback path for hidden-but-frustum-visible geometry.

These are concrete SOTA blockers because they affect CPU command encoding and
GPU submission overhead in scenes that Aperture already claims to cover.

## Recommended next visible slices

1. `task-3111`: Elide redundant render-pass state commands and publish command
   pressure metrics. This is the smallest high-confidence efficiency fix and
   directly mirrors both three.js and PlayCanvas.
2. `task-3112`: Add a renderer-owned render bundle cache for unchanged static
   command plans, using snapshot change-set evidence to prove reuse.
3. `task-3113`: Add a WebGPU indirect draw argument-buffer route for compatible
   coalesced draw lists, with a direct-draw fallback when the required adapter
   feature is unavailable.

Follow-up after those: GPU occlusion queries and richer phase timing/pressure
telemetry should be queued once the submit path is no longer doing obvious extra
state work.

## SOTA assessment

Within the covered feature scope, Aperture can be called advanced and close on
capability breadth. It cannot honestly be called the most efficient of Aperture,
three.js, and PlayCanvas until the submit path stops emitting redundant state
commands and adds at least one static reuse path beyond per-frame direct command
recording.
