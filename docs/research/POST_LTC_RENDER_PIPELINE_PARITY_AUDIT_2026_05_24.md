# Post-LTC render pipeline parity audit - 2026-05-24

## Scope

This audit compares Aperture's covered render pipeline against the local
three.js and PlayCanvas references after the occlusion-query feedback,
multi-view clustered-light, multi-material group, and production LTC table
slices.

Reference anchors read:

- `references/three.js/src/renderers/WebGLRenderer.js`
- `references/engine/src/scene/renderer/forward-renderer.js`
- `references/engine/src/scene/lighting/world-clusters.js`

Current Aperture evidence inspected:

- `packages/webgpu/src/webgpu/local-light-clusters.ts`
- `packages/webgpu/src/webgpu/standard-shader.ts`
- `packages/webgpu/src/webgpu/standard-light-shadow-bind-group.ts`
- `packages/webgpu/src/webgpu/standard-pipeline-descriptor.ts`
- `packages/webgpu/src/webgpu/standard-frame-resources.ts`
- `packages/webgpu/src/webgpu/app.ts`
- `docs/render-pipeline-comparison.html`
- `agent/BACKLOG.md`

## Bottom line

Aperture is now much closer to a SOTA claim for the parts of the forward render
pipeline it covers. The previous high-impact gaps are closed: renderer-side
clustered local-light shading, per-view/light-set cluster resources, GPU
occlusion-query feedback and draw skipping, multi-material primitive draw
ranges, and production RectAreaLight LTC table sampling are all implemented and
browser-proven.

The remaining blockers are narrower. The strongest efficiency gap is no longer
fragment shading over every local light; it is the CPU-side cluster build shape.
Aperture currently builds each cluster cell by scanning the full clustered light
list. PlayCanvas' `WorldClusters` does the inverse: it computes the affected
cell min/max for each local light and writes that light only into the covered
cell range. For large cell grids or hundreds of local lights, PlayCanvas' shape
does less CPU work and exposes overflow pressure directly.

The strongest feature-combination gap is CSM plus IBL. three.js can render
Standard/Physical materials with both `scene.environment` and shadow maps active
in the same draw. PlayCanvas dispatches directional cascade uniforms and other
lighting resources together. Aperture has CSM and IBL as separate covered paths,
but the current StandardMaterial group-3 layout selection treats cascaded
directional shadows as mutually exclusive with IBL, falling back to a non-array
shadow/IBL layout when both flags are present.

## Phase findings

### 1. Extract

Still strong versus the references for Aperture's architecture: ECS snapshots,
worker transport, cull stats, entity explanations, change sets, occlusion-query
opt-in flags, material slots, shadow requests, and area-light shape metadata are
all renderer-independent. The remaining extract work is not a SOTA blocker
until broader features are attempted: more visibility explanations and cross-view
occlusion telemetry would help diagnostics, but the covered extraction path is
ahead of scene-graph references for worker readiness.

### 2. Collect

Asset and source collection remain competitive: real GLB/GLTF paths, async image
decode, source-view mesh streams, compressed textures/geometry, material-slot
mapping, and environment-map resources are all covered. The remaining collect
gap is automatic cache eviction breadth, not the next render-pipeline efficiency
blocker.

### 3. Prepare

The production LTC slice closed the remaining placeholder resource in the
area-light path. Clustered local-light resources are now renderer-owned and
route-specific. The next prepare gap is combination breadth: a prepared
StandardMaterial route should be able to bind cascaded directional shadow arrays
and diffuse/specular IBL textures in one group-3 layout.

### 4. Queue

Queueing now covers state-aware opaque/alpha-test order, transparent order,
instancing/coalescing, static merge records, multi-material primitive ranges,
clustered route keys, and bind-group reuse. This is competitive with
three.js render lists and PlayCanvas layer sorting for the covered path. The
remaining queue work is pressure telemetry and imported fixture breadth, not a
top blocker.

### 5. Sort

Sort remains strong for the covered path. The next useful addition is phase
timing history, but it should follow the cluster-build and route-combination
work so the timing data reflects the next optimized pipeline.

### 6. Submit

Submit has the most relevant remaining work:

- Clustered shading is implemented, but the CPU build algorithm is still
  cell-driven (`cells * lights`) rather than PlayCanvas-style light-driven
  range fill.
- CSM and IBL cannot yet share one StandardMaterial group-3 route, even though
  both are covered features and the references combine environment lighting with
  shadowing.
- Clustered local lights do not yet carry the broader PlayCanvas local-light
  metadata set for cookies/local shadow payloads. Aperture has separate
  point/spot shadow proofs, but they are not cluster-aware.

## Priority gaps

1. **Light-driven local-light cluster filling.** SOTA efficiency blocker.
   Replace cell-driven full-light scans with per-light cell range writes and
   publish build-pressure telemetry, while preserving the existing WebGPU
   storage-buffer route and browser proof.
2. **CSM plus IBL StandardMaterial route.** Covered feature-combination blocker.
   Add a cascaded-shadow/IBL group-3 layout and browser proof so StandardMaterial
   can receive both PMREM IBL and CSM in one draw.
3. **Cluster-aware local-light shadow/cookie metadata.** Broader parity gap.
   PlayCanvas clusters can carry local light shadow/cookie metadata; Aperture's
   clustered point/spot shading currently covers direct radiance only.
4. **Phase timing history.** Useful for SOTA evidence and regression tracking,
   but lower priority than the visible/efficiency changes above.

## Refilled visible queue

Recommended next task: `task-3128`, replace the clustered local-light cell build
with a light-driven range fill and expose the before/after build-pressure proof.

Next visible tasks after that:

- `task-3129`: combine CSM and IBL in one StandardMaterial route.
- `task-3130`: add cluster-aware local-light shadow/cookie metadata or a
  narrowed visible precursor if full local-shadow clustering is too large.

## SOTA assessment

Aperture should now be considered competitive and ahead of the references in
several covered architectural areas: worker snapshots, JSON-safe diagnostics,
state-aware queueing, render-bundle reuse, indirect grouped draws, occlusion
feedback, per-view clustered routes, and production LTC table binding.

It is not yet proven most efficient overall for the covered path. The cluster
shader path is fixed, but the cluster builder still does more CPU work than the
PlayCanvas reference shape. Closing that and then proving CSM+IBL route
combination are the next concrete requirements before making a stronger SOTA
claim.
