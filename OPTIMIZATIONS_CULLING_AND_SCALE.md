# Future optimizations — culling and scale

Status: not currently in the roadmap. Captured from conversation on 2026-05-20 for future revisiting.

The current renderer extracts and submits _every_ entity in the world that has the right components. There's no spatial culling. At small scales (<5K entities) this is fine because extraction + submission cost grows roughly linearly with entity count and stays sub-frame. At larger scales, you start paying to extract entities that the camera never sees.

These are the classical scale optimizations every mature 3D renderer eventually adds.

## 1. Frustum culling

**What:** Before extracting a mesh draw, test the entity's world AABB (already computed and stored in `BoundsPacket`) against each camera's view frustum. If the AABB is entirely outside the frustum, skip the draw. Each entity has a `boundsId` reference into the snapshot's bounds array, so the data is already there.

**Why it'd matter:** Open scenes (cityscapes, outdoor maps, large interiors) where the camera sees a fraction of the world at any time. A 50K-entity scene where the camera sees 2K entities would skip 96% of the extraction + queue + draw work.

**What it'd take:** Compute frustum planes from each camera's view-projection matrix once per frame. Then in `extractMeshDraws`, AABB-vs-frustum test before adding to the draw list. SIMD-friendly with the right data layout. Bevy and PlayCanvas both do this on the CPU side; three.js does it per-object as part of the scene-graph walk.

**Trigger condition:** When `extractRenderSnapshot` profiling shows >1ms spent walking entities the camera doesn't see. Likely around 10K+ entities in spatially-distributed scenes.

**Trade-off:** Adds per-entity frustum test cost (cheap but not free) even for entities that are visible. Net win only when culled fraction > some threshold (~25%+). Could be opt-in via a Camera flag for cases where the user knows the camera always sees everything.

**Reference anchors when implemented:**

- `references/bevy/crates/bevy_render/src/view/visibility/` — Bevy's view-visibility system
- `references/three.js/src/core/Object3D.js` (frustumCulled flag pattern)
- `references/engine/src/scene/frustum.js` — PlayCanvas's frustum primitives

## 2. Occlusion culling

**What:** Even more aggressive than frustum culling. Skip drawing entities that _are_ in the frustum but are completely occluded by other geometry in front of them. Modern approaches use a depth pyramid from the previous frame (HiZ / Hierarchical Z-buffer) to test bounds against, on the GPU.

**Why it'd matter:** Dense interior scenes (a room full of furniture seen through a doorway) where the camera frustum captures lots of stuff but a wall blocks most of it. Outdoor scenes with terrain occluding distant objects.

**What it'd take:** A previous-frame depth pyramid (built from the depth buffer, downsampled into mip chain). A compute pass that tests entity AABBs against the pyramid. Skipped entities get marked invisible for this frame; potentially-visible ones get tested again next frame. Bevy and modern AAA engines (Frostbite, UE5 Nanite) use this; three.js and PlayCanvas don't.

**Trigger condition:** Probably never on the current roadmap. This is high-end optimization that matters at AAA scales. Likely premature for any web-rendering target until 100K+ entity scenes become realistic.

**Trade-off:** Significant implementation cost. Requires depth-pyramid generation, a temporal-coherence policy (objects flicker if naive), and good interaction with frustum culling. Pairs naturally with indirect drawing (from instancing optimizations doc).

**Reference anchors when implemented:**

- `references/bevy/crates/bevy_render/src/view/visibility/range.rs` (Bevy's render-range mechanism is the lighter cousin)
- WebGPU compute shader patterns from Bevy / Unity HDRP

## 3. Level of Detail (LOD)

**What:** Multiple mesh assets representing the same object at different fidelity (high-poly close up, low-poly far away). The renderer picks the appropriate LOD based on distance from camera. Entities reference an `LodSet` instead of a single `Mesh` handle.

**Why it'd matter:** Scenes with many similar objects at varying distances (forests, crowds, architectural scenes). Distant objects don't need 10K-triangle meshes — a 500-triangle stand-in is invisible at a distance. Massive vertex-shader and fragment cost reduction.

**What it'd take:** New `LodSet` asset type that bundles N mesh handles + distance thresholds. ECS authoring with `withLodSet(set)` instead of `withMesh(handle)`. Extraction picks the active LOD per entity per camera. Pairs well with instancing — all entities at the same LOD coalesce together.

**Trigger condition:** When scenes start having visibly low-poly distance geometry or fragment-bound performance issues. Probably useful for any glTF viewer that loads large scenes from the wild (since real glTF assets often ship at full fidelity).

**Trade-off:** Authoring complexity — content needs to be authored with multiple LODs (or generated via mesh simplification). Pop-in artifacts at LOD transitions unless smoothed with cross-fade. Real but bounded perf win.

**Reference anchors when implemented:**

- `references/bevy/crates/bevy_pbr/src/material.rs` and Bevy's `MeshletPlugin` / `MeshletMesh` (a more advanced version of LOD)
- `references/three.js/src/objects/LOD.js` — three.js's straightforward LOD primitive
- `references/engine/src/scene/lod.js` if present — PlayCanvas LOD

## Notes on prioritization

Item 1 (frustum culling) is the natural first pull — biggest perf-per-implementation-effort win, foundational for everything else, and applicable to most scenes. Item 3 (LOD) is a feature as much as an optimization — depends on user content. Item 2 (occlusion culling) is the most expensive to implement and probably out of scope until Aperture targets scales that aren't realistic today.

If pulled forward, frustum culling probably fits in a single Tier-9-style slice. LOD is more like 3-4 slices (asset type + extraction + author API + visible example). Occlusion culling is multiple weeks of work and depends on compute infrastructure.
