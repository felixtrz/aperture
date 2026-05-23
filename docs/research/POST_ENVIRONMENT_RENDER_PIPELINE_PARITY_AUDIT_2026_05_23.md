# Post-environment render pipeline parity audit - 2026-05-23

## Scope

This audit compares Aperture's covered render pipeline against the local
three.js WebGPU and PlayCanvas WebGPU references after tasks 3111-3118 closed
the post-Tier-20 submit-efficiency and environment-preparation queue.

Reference anchors read:

- `references/three.js/src/renderers/common/Renderer.js`
- `references/three.js/src/renderers/webgpu/WebGPUBackend.js`
- `references/three.js/src/renderers/common/RenderList.js`
- `references/three.js/examples/jsm/lighting/ClusteredLighting.js`
- `references/engine/src/scene/renderer/renderer.js`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/engine/src/scene/renderer/world-clusters-allocator.js`
- `references/engine/src/scene/renderer/frame-pass-update-clustered.js`
- `references/engine/src/scene/lighting/world-clusters.js`
- `references/engine/src/scene/shader-lib/wgsl/chunks/lit/frag/clusteredLight.js`
- `references/engine/src/platform/graphics/webgpu/webgpu-graphics-device.js`

Current Aperture evidence inspected:

- `packages/webgpu/src/webgpu/render-pass-commands.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/light-packing.ts`
- `packages/render/src/rendering/extraction.ts`
- `packages/render/src/rendering/snapshot.ts`
- `packages/webgpu/src/webgpu/app-snapshot-transport.ts`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`

## Bottom line

Aperture's previous SOTA blockers in command submission are now mostly closed
inside the covered path: redundant render-pass state commands are elided, static
command plans can reuse render bundles, compatible grouped draws can use
indirect argument buffers, opaque queue ordering groups by prepared resource
state, built-in queued bind groups are reused, TAA has previous per-object
transform history, bloom has a renderer-owned downsample/upsample graph, and
multiple environment-map handles can prepare versioned diffuse/specular IBL
resources.

Aperture is still not honestly SOTA on many-light efficiency. Its
StandardMaterial WGSL loops over `lightCount()` and evaluates every packed light
for every fragment. The light buffer is one global packed list derived from the
snapshot; point, spot, and area lights are not spatially culled before fragment
lighting. The default SharedArrayBuffer snapshot sizing also assumes only 64
light packets, which is acceptable for current examples but not a serious
many-light renderer ceiling.

PlayCanvas has the stronger reference path here. It collects unique lights,
frustum-culls local lights per camera, allocates/reuses per-light-set
`WorldClusters`, fills a 3D cluster grid with local light indices, uploads a
cluster texture and light data textures, and samples only the lights in the
fragment's current cluster. That turns local-light shading from "all local
lights per fragment" into "lights affecting this space cell per fragment."
three.js also has an occlusion-query path and clustered-lighting example
infrastructure, but PlayCanvas is the more directly comparable production
reference for many-light forward rendering.

## Phase findings

### 1. Extract

Aperture remains ahead architecturally for its intended worker/ECS model:
rendering starts from serializable snapshots, not live scene graph references.
It has per-camera frustum culling, entity explanations, packet change sets, and
transferable/SAB transport. The remaining reference gap is GPU occlusion
feedback: three.js counts `object.occlusionTest` render items in `RenderList`,
creates WebGPU occlusion query sets, resolves them asynchronously, and exposes
`isOccluded(renderContext, object)`. Aperture has no equivalent visibility
feedback loop yet.

### 2. Collect

Aperture remains strong. It has explicit source asset status, async image
decode, source-view mesh streams, texture color-space/semantic validation,
compressed texture/mesh decoder paths, and explicit prepared-resource unload
hooks. The remaining gap is policy breadth, not a next SOTA blocker: automatic
unload/eviction needs broader app integration, but it does not dominate
render-pipeline efficiency in the current covered examples.

### 3. Prepare

The previous audit's missing prepared submit resources are closed: render
bundle reuse, indirect draw argument buffers, shared queued bind groups, bloom
graph resources, and multi-environment IBL resources all exist. The new prepare
gap is clustered local-light data. PlayCanvas prepares `WorldClusters` per
unique render-action light set, allocates cluster textures, writes light bounds
into cells, and uploads light data textures before rendering. Aperture only
packs all extracted lights into global storage buffers.

### 4. Queue

Aperture has deterministic queue records, route diagnostics, instancing
coalescing, static merge records, transparent ordering reports, state-aware
opaque ordering, and command-pressure summaries. Two visible gaps remain:

- Local lights are queued globally for StandardMaterial rather than as
  view/pass-scoped clustered lighting resources.
- Multi-material primitive/group rules are still missing. three.js handles
  `BufferGeometry.groups` with material arrays during render-list population,
  while Aperture mostly models separate primitive/entity routes.

### 5. Sort

Aperture now groups opaque and alpha-test work by prepared pipeline,
material-resource, mesh-layout, and mesh-resource state while preserving view,
layer, and authored order. This is stronger than three.js' material-id grouping
for the covered path and is comparable to PlayCanvas' layer sorting plus shader
switch pressure reporting. The remaining gap is broader timing and pressure
history: PlayCanvas records cull/sort/forward/material/shader/draw pressure
over time, while Aperture reports useful point-in-time counters but not a
general phase timeline.

### 6. Submit

The core submit gap from the prior audit is closed for the main forward path:
Aperture now tracks active pipeline, bind groups, vertex buffers, and index
buffer; can execute reusable WebGPU render bundles for unchanged command plans;
can submit indirect grouped draws; and reports command/reuse pressure.

The next submit-adjacent SOTA gap is shader work per fragment. PlayCanvas'
clustered-light shader loads a cluster cell, iterates only the local light
indices stored in that cell, and separately handles local-light data textures.
Aperture's StandardMaterial shader iterates every packed light for every
fragment. Scenes with dozens or hundreds of local lights will waste shader work
even when most lights are outside the fragment's affected region.

## Priority gaps

1. **Clustered local lighting for StandardMaterial.** Highest impact and most
   directly tied to the user's SOTA/efficiency objective. It reduces fragment
   shader work in an area Aperture already covers: point/spot/area direct
   lighting.
2. **GPU occlusion-query feedback.** Useful for hidden-but-frustum-visible
   geometry and directly supported by three.js WebGPU. It should follow
   clustering because Aperture's current examples already have many-light
   shading but not a large occlusion-heavy scene.
3. **Multi-material primitive/group queueing.** A visible parity gap with
   three.js material arrays and practical glTF meshes. It is important, but it
   is more about authoring parity than raw render efficiency.
4. **Phase timing history.** Useful for SOTA claims and regression tracking,
   especially after clustering and occlusion work, but it should not precede
   visible render-pipeline improvements.

## Selected next slice

Recommended next task: `task-3120`, add clustered local-light preparation for
StandardMaterial with a many-light browser proof.

Rationale:

- It attacks the strongest remaining efficiency gap in a feature Aperture
  already renders.
- PlayCanvas provides a concrete production reference for the data shape,
  reuse policy, update pass, and shader loop.
- Aperture can adapt it without introducing a scene graph: clusters can be
  renderer-owned resources derived from extracted light packets and view
  packets.
- A visible example can prove the result with many ECS-authored point/spot
  lights, local-light response in pixels, and JSON-safe cluster pressure
  showing total local lights versus max/average lights per populated cluster.

## SOTA assessment

Aperture is advanced and now competitive on submit-command efficiency for the
covered forward path. It should not yet be called the most efficient of
Aperture, three.js, and PlayCanvas in all covered areas because StandardMaterial
local lighting still scales linearly with the full packed light list per
fragment. Closing clustered local lighting is the next concrete requirement for
that claim.
