# Mesh, Geometry, And Primitive Builder Coverage

Date: 2026-05-15

Status: task-0018 coverage output

This document maps static mesh data, vertex attributes, submeshes, primitive builders, line/point rendering, instancing, LOD, morph target placeholders, and skinning placeholders from three.js, Babylon.js, and PlayCanvas into Aperture's ECS-first MVP design.

The goal is not to copy any reference engine's object model. Mesh assets should remain reusable data. ECS entities should author renderable instances by handle. GPU buffers belong to the renderer/WebGPU backend.

## Reference Source Anchors

three.js:

- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/core/BufferGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/core/BufferAttribute.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/core/InstancedBufferAttribute.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/core/InstancedBufferGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/Mesh.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/Line.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/Points.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/InstancedMesh.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/BatchedMesh.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/LOD.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/objects/SkinnedMesh.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/BoxGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/SphereGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/PlaneGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/CylinderGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/ConeGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/CapsuleGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/TorusGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/TubeGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/EdgesGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/WireframeGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/ShapeGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/ExtrudeGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/LatheGeometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/three.js/src/geometries/PolyhedronGeometry.js`

Babylon.js:

- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/geometry.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/mesh.vertexData.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/mesh.vertexData.functions.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/mesh.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/subMesh.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/meshBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/boxBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/sphereBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/planeBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/cylinderBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/capsuleBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/torusBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/linesBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/tubeBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/ribbonBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/groundBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/torusKnotBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/polyhedronBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/Builders/polygonBuilder.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/thinInstanceMesh.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/instancedMesh.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Meshes/meshLODLevel.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Morph/morphTarget.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Morph/morphTargetManager.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Bones/skeleton.ts`
- `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Bones/bone.ts`

PlayCanvas:

- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/mesh.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/mesh-instance.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/model.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/geometry-utils.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/box-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/sphere-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/plane-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/cylinder-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/cone-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/capsule-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/geometry/torus-geometry.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/framework/components/render/component.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/framework/components/render/system.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/framework/components/render/data.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/batching/batch.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/batching/batch-group.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/batching/batch-manager.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/skin.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/skin-instance.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/morph.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/morph-target.js`
- `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/scene/morph-instance.js`

## Reference Coverage Summary

### three.js

three.js uses `BufferGeometry` as the core reusable geometry container. It holds an optional index, named attributes, morph attributes, group ranges with material indices, local bounding box/sphere, and a draw range. `BufferAttribute` stores a typed array plus item size, count, normalization flag, usage, update ranges, and GPU type. This is a strong reference for Aperture's asset-side mesh descriptor.

Renderable objects are still scene graph nodes. `Mesh`, `Line`, and `Points` pair geometry with material and inherit transform, visibility, layers, and render order from `Object3D`. `Mesh` supports material arrays through geometry groups, raycast triangle tests, and morph target influence arrays. `Line` and `Points` reuse `BufferGeometry` but interpret positions with line or point-specific raycast thresholds and draw ranges.

`InstancedMesh` keeps one mesh/material pair plus per-instance matrices, optional per-instance colors, optional morph texture data, and aggregate bounds. `BatchedMesh` builds larger combined geometry with per-instance visibility, transform, geometry ID, color, and multi-draw ranges. `LOD` stores ordered object/distance levels with hysteresis. `SkinnedMesh` binds geometry skin attributes to a skeleton and computes skinned bounds by applying bone transforms.

Primitive builders produce `BufferGeometry` with positions, normals, UVs, indices, and sometimes groups for material slots. Box and cylinder builders are useful references for face/material grouping; sphere, plane, capsule, torus, cone, and tube are useful references for default parameter choices and segment handling. Shape/extrude/lathe/polyhedra are broader authoring conveniences, not MVP necessities.

### Babylon.js

Babylon splits reusable geometry data across `Geometry`, `VertexData`, `Mesh`, and `SubMesh`. `VertexData` is a CPU-side transfer shape containing positions, normals, tangents, multiple UV sets, colors, bone indices/weights including extra influences, and indices. `Geometry` owns vertex buffers, index data, delay-loading state, and bounding info, and applies buffers to meshes. `SubMesh` defines material index plus vertex and index ranges and can maintain per-submesh bounds.

`Mesh` is a renderable transform node that can share geometry, hold material/skeleton/morph references, own submeshes, create traditional instances, and render thin instances. Its render path draws submesh index ranges with optional hardware instance counts. Babylon's `thinInstanceMesh.ts` is the important high-volume instance reference: a mesh can accept a packed matrix buffer, user per-instance buffers, explicit instance count, and refreshed aggregate bounds.

`MeshBuilder` and builder files expose a broad builder catalog: box, sphere, cylinder/cone/prism, plane, ground, capsule, torus, torus knot, tube, ribbon, lines/dashed lines/line systems, polygon/extrusion, polyhedron, ico sphere, tiled variants, text, decal, and greased lines. Most builders produce `VertexData` first and then apply it to a mesh, which is a good pattern for Aperture: primitive builders should return mesh asset descriptors, not render objects.

Babylon's morph path uses `MorphTarget` for target arrays and influence, and `MorphTargetManager` to validate shared vertex counts, select active targets, and optionally store morph data in textures. Its skeleton path uses `Skeleton`/`Bone` to produce transform matrices for skinned meshes. For Aperture MVP these are schema placeholders and import targets; render support can come later without changing the mesh asset envelope.

LOD is represented as distance or screen-coverage levels. This should remain deferred for Aperture's MVP implementation, but the mesh/render packet shape should leave room for an extraction-time LOD decision that picks a mesh/submesh handle before rendering.

### PlayCanvas

PlayCanvas has a clean split that maps well to Aperture. `Geometry` is simple CPU-side arrays for positions, normals, tangents, colors, UV sets, blend indices/weights, and indices. `Mesh` owns a vertex buffer, optional index buffers, primitive ranges, local AABB, optional skin, and optional morph data. Its helper APIs set positions/normals/UVs/colors/indices and then `update` GPU buffers and primitive metadata.

`MeshInstance` is a renderable instance of a mesh with material, graph node transform, visibility, layer/mask, render style, draw bucket/order, custom AABB, optional skin instance, optional morph instance, and optional instancing data. It computes world bounds from the mesh AABB and node transform, with special handling for skin/morph bounds. This reinforces Aperture's split: ECS entities own transform and authoring components, assets own mesh data, and extraction emits render packets.

`Model` groups a graph and arrays of mesh, skin, and morph instances. Aperture should not copy this as an authoritative scene graph, but imported scenes may produce multiple ECS entities/components from a model-like asset.

PlayCanvas primitive geometry builders cover box, sphere, plane, cylinder, cone, capsule, torus, dome, and shared cone-base geometry. Builders produce CPU arrays first; `Mesh.fromGeometry`/`Mesh.update` turns them into renderable data. `RenderComponent` exposes a practical authoring surface with primitive type, render asset, material assets, layers, shadow flags, batch group, and custom AABB. Aperture should translate those concerns into ECS components and handles.

PlayCanvas batching is a useful compatibility reference. `BatchManager` groups compatible mesh instances by material, layer, shader defs, parameters, stencil, vertex format batching hash, indexed state, shadow state, draw order, and transform scale sign. It rejects skin and morph instances for batching. This becomes Aperture's first instancing/batching compatibility key.

## Aperture Mesh Asset Schema Proposal

### Handles

MVP handle types:

```ts
type MeshHandle = AssetHandle<"mesh">;
type MaterialHandle = AssetHandle<"material">;
type SkinHandle = AssetHandle<"skin">;
```

Handles are stable IDs. ECS components store handles, not CPU mesh arrays or GPU buffers.

### MeshAsset

Recommended MVP shape:

```ts
interface MeshAsset {
  id: MeshHandle;
  label?: string;
  vertexCount: number;
  vertexStreams: MeshVertexStream[];
  indexBuffer?: MeshIndexBuffer;
  submeshes: MeshSubmesh[];
  bounds: MeshBounds;
  morphTargets?: MeshMorphTarget[];
  skin?: MeshSkinBinding;
  diagnostics?: MeshAssetDiagnostic[];
}
```

Rules:

- `MeshAsset` is asset/registry data, not an ECS component.
- `vertexCount` is explicit and all per-vertex streams must agree with it unless they are per-instance streams in a later instancing asset path.
- `submeshes` is required. A whole-mesh single-material asset still has one submesh.
- `bounds` is local-space and should be available before renderer upload.
- GPU buffers derived from `MeshAsset` belong to the renderer or render world.

### Vertex Streams And Attribute Semantics

Recommended vertex stream shape:

```ts
interface MeshVertexStream {
  name?: string;
  stepMode: "vertex";
  stride: number;
  attributes: MeshVertexAttribute[];
  data: ArrayBufferView;
}

interface MeshVertexAttribute {
  semantic: MeshAttributeSemantic;
  format: MeshVertexFormat;
  offset: number;
  normalized?: boolean;
}

type MeshAttributeSemantic =
  | "POSITION"
  | "NORMAL"
  | "TANGENT"
  | "TEXCOORD_0"
  | "TEXCOORD_1"
  | "COLOR_0"
  | "JOINTS_0"
  | "WEIGHTS_0"
  | "JOINTS_1"
  | "WEIGHTS_1";
```

MVP required/optional semantics:

- `POSITION`: required for triangle, line, and point meshes. Use `float32x3` for MVP.
- `NORMAL`: optional for unlit, required for lit materials. Prefer `float32x3` in MVP.
- `TANGENT`: optional until normal mapping. Use `float32x4`; `w` stores handedness.
- `TEXCOORD_0`: optional but required for textured materials. Use `float32x2`.
- `TEXCOORD_1`: optional for lightmaps/AO and glTF import preservation.
- `COLOR_0`: optional; support `float32x4` and later `unorm8x4`.
- `JOINTS_0`/`WEIGHTS_0`: schema placeholder for skinning. `JOINTS_1`/`WEIGHTS_1` can preserve extra glTF/Babylon influences but render support is deferred.

MVP should avoid exposing raw WebGPU vertex-state objects as the asset schema. Use Aperture-owned formats that can deterministically map to WebGPU `GPUVertexFormat`.

### Index Formats

Recommended index shape:

```ts
interface MeshIndexBuffer {
  format: "uint16" | "uint32";
  data: Uint16Array | Uint32Array;
}
```

Rules:

- WebGPU supports `uint16` and `uint32` index formats, so Aperture should canonicalize imported `uint8` indices to `uint16`.
- Non-indexed meshes are allowed by omitting `indexBuffer`; submesh ranges then address vertex ranges.
- Validation should reject index values outside `vertexCount`.

### Submeshes, Material Slots, And Primitive Topology

Recommended submesh shape:

```ts
interface MeshSubmesh {
  slot: number;
  topology: MeshPrimitiveTopology;
  indexStart: number;
  indexCount: number;
  vertexStart: number;
  vertexCount: number;
  materialSlot: number;
  bounds?: MeshBounds;
}

type MeshPrimitiveTopology =
  | "triangle-list"
  | "triangle-strip"
  | "line-list"
  | "line-strip"
  | "point-list";
```

Rules:

- `materialSlot` indexes a future `MaterialSlots` component when per-submesh
  materials are needed. MVP entities can use the primary `Material` component
  for all submeshes.
- `slot` is the stable submesh ordinal for diagnostics and extraction.
- Triangle mesh MVP should support `triangle-list` first.
- `line-list`, `line-strip`, and `point-list` should be represented in the schema but can be deferred until line/point materials exist.
- `triangle-strip` can be imported or built later; do not block MVP triangle-list rendering on it.
- Per-submesh local bounds are optional but useful for diagnostics and future culling.

### Local Bounds

Recommended bounds shape:

```ts
interface MeshBounds {
  aabb: {
    min: readonly [number, number, number];
    max: readonly [number, number, number];
  };
  sphere: {
    center: readonly [number, number, number];
    radius: number;
  };
}
```

Rules:

- Bounds are local-space asset data.
- Importers/builders should compute bounds from `POSITION`.
- Asset validation should fail or warn when bounds are absent for renderable meshes.
- Render extraction can combine local mesh bounds with `WorldTransform` to emit world bounds or culling diagnostics.

### Morph Target Placeholder

Recommended placeholder:

```ts
interface MeshMorphTarget {
  name?: string;
  defaultWeight: number;
  attributes: MeshMorphAttribute[];
  bounds?: MeshBounds;
}

interface MeshMorphAttribute {
  semantic: "POSITION" | "NORMAL" | "TANGENT";
  data: ArrayBufferView;
}
```

Rules:

- Store deltas, not absolute final positions, for glTF-friendly semantics.
- Every morph target affecting a semantic must match `vertexCount`.
- MVP render support can ignore morphs, but import/asset validation should preserve the schema and emit a diagnostic if a morph mesh is rendered before morph support exists.
- ECS animation/playback should own morph weights later; renderer state must not become authoritative.

### Skinning Placeholder

Recommended placeholder:

```ts
interface MeshSkinBinding {
  skin: SkinHandle;
  jointsSemantic: "JOINTS_0";
  weightsSemantic: "WEIGHTS_0";
  extraJointsSemantic?: "JOINTS_1";
  extraWeightsSemantic?: "WEIGHTS_1";
}

interface SkinAsset {
  id: SkinHandle;
  jointNames?: string[];
  inverseBindMatrices: Float32Array;
}
```

Rules:

- Skin assets reference inverse bind matrices and optional joint names/import metadata.
- ECS entities or import commands should bind skin joints to ECS transform entities.
- Extracted skin data should eventually be a derived pose/bone-palette packet.
- The renderer may own GPU bone palette buffers, but never authoritative bone transforms.

### Instancing Compatibility Key

Recommended first-pass key fields:

```ts
interface MeshInstanceCompatibilityKey {
  mesh: MeshHandle;
  submeshSlot: number;
  material: MaterialHandle;
  topology: MeshPrimitiveTopology;
  vertexLayoutHash: string;
  indexFormat?: "uint16" | "uint32";
  renderLayer: number;
  renderStateKey: string;
  skinning: "none" | "skinned";
  morphing: "none" | "morphed";
}
```

Rules:

- MVP instancing should only group `skinning: "none"` and `morphing: "none"` packets.
- Per-instance transforms come from extracted `WorldTransform`, not renderer-owned graph nodes.
- Per-instance colors can be a later extension if material and vertex layout compatibility is explicit.
- The first batching diagnostic should explain which key field prevented grouping.

## ECS Binding Plan

### Mesh And Material Components

Recommended EliCS-style authoring data:

```ts
const Mesh = defineComponent("aperture.render.mesh", {
  meshId: { type: EcsType.String, default: "" },
});

const Material = defineComponent("aperture.render.material", {
  materialId: { type: EcsType.String, default: "" },
});
```

Notes:

- Exact handle storage should be finalized with the asset task. If EliCS lacks a handle scalar type, string IDs are acceptable for MVP.
- The primary `Material` component can apply to all submeshes for the MVP.
- A separate `MaterialSlots` component can follow when slot-specific materials
  are needed.
- No GPU buffers or material objects belong in ECS mesh/material authoring
  components.

### MeshBounds Component

Optional derived ECS component:

```ts
const MeshBounds = defineComponent("aperture.render.meshBounds", {
  localMin: { type: EcsType.Vec3, default: [0, 0, 0] },
  localMax: { type: EcsType.Vec3, default: [0, 0, 0] },
  worldMin: { type: EcsType.Vec3, default: [0, 0, 0] },
  worldMax: { type: EcsType.Vec3, default: [0, 0, 0] },
});
```

Notes:

- MVP may compute bounds during extraction instead of storing `MeshBounds`.
- If added, `MeshBounds` is derived ECS data. It should not be renderer-owned.

### Render Extraction

Mesh extraction should read:

- ECS entity identity.
- `WorldTransform`.
- `Mesh`.
- `Material` or future `MaterialSlots`.
- `Visibility`.
- `RenderLayer`.
- optional `RenderOrder`.
- optional `Name`/debug metadata.
- mesh/material asset registry readiness.

Recommended packet shape:

```ts
interface MeshDrawPacket {
  renderId: number;
  entity: number;
  mesh: MeshHandle;
  submeshSlot: number;
  material: MaterialHandle;
  worldTransformOffset: number;
  worldBounds?: MeshBounds;
  layerMask: number;
  renderOrder: number;
  sortKey: bigint;
}
```

Extraction rules:

- Emit one draw packet per visible submesh/material slot.
- Skip and diagnose missing mesh handles, missing material slots, unavailable assets, invalid submesh ranges, unsupported topology, unsupported morph/skinning state, and invisible/layer-filtered entities.
- Renderer consumes packets and asset handles. It must not query the ECS world.

## Primitive Builder Classification

### MVP

- `box`: common smoke-test primitive; useful for transform hierarchy examples.
- `plane`: common ground/UI/test primitive; simple UV and normal behavior.
- `sphere`: common bounds/light/material test primitive.
- `cylinder`: useful primitive and basis for cone.
- `cone`: can share cylinder/cone-base implementation.
- `capsule`: common character/collider visualization primitive.
- `torus`: useful UV/tangent/material test primitive.

MVP builders should return `MeshAsset` descriptors with positions, normals, UV0, indices, local bounds, and one or more submeshes. Tangents can be generated only when normal-mapped materials require them.

### Soon

- `lineList` / `lineStrip` from point arrays.
- `points` from point arrays.
- `icoSphere` / `polyhedron`.
- `tube`.
- `grid` / `ground`.
- `wireframe` or edge extraction for diagnostics.

These need either line/point material support or more geometry utilities, but their schema should be ready.

### Later

- shape triangulation.
- extrusion.
- lathe.
- polygon with holes.
- ribbon.
- text.
- torus knot.
- heightmap terrain.
- decaling.
- mesh simplification / generated LOD.

These are valuable, but they either require larger algorithms, external triangulation choices, or asset pipeline decisions outside the MVP.

## Diagnostics Requirements

Mesh asset validation should emit actionable diagnostics for:

- missing `POSITION` stream.
- inconsistent vertex counts across streams.
- invalid attribute format for a semantic.
- unsupported index format.
- index value outside `vertexCount`.
- empty submesh list.
- submesh range outside index/vertex buffer.
- material slot referenced by a submesh but not provided by `Material` or
  `MaterialSlots`.
- missing or invalid local bounds.
- unsupported topology for the active renderer path.
- morph target vertex count mismatch.
- skin binding without required joint/weight streams.
- instancing key mismatch, naming the field that differed.

## Future Implementation Acceptance Tests

1. A mesh asset with positions, normals, UV0, uint16 indices, one triangle-list submesh, and local bounds validates successfully.
2. Mesh validation rejects an attribute stream whose vertex count differs from `MeshAsset.vertexCount`.
3. Mesh validation rejects uint32 indices that reference vertices outside `vertexCount`.
4. Mesh validation rejects a submesh range outside the index buffer range and reports the submesh slot.
5. Box, plane, sphere, cylinder, cone, capsule, and torus builders produce positions, normals, UV0, indices, local AABB, local sphere, and at least one submesh.
6. Box builder material grouping produces stable submesh material slots for face groups when requested.
7. An entity with valid `Mesh` and `Material` components extracts one `MeshDrawPacket` per submesh.
8. Extraction skips and diagnoses an entity whose `Mesh` handle is missing from the asset registry.
9. Extraction skips and diagnoses a mesh submesh whose material slot is not provided by the entity.
10. Extraction marks line and point topologies as unsupported until line/point renderer paths are implemented.
11. Instancing compatibility groups packets with matching mesh, submesh, material, vertex layout, topology, layer, render state, and no skin/morph state.
12. Instancing diagnostics identify the first mismatched key field when two otherwise similar packets cannot be grouped.
13. A mesh with morph target placeholders validates target vertex counts but emits an unsupported-render diagnostic if rendered before morph support exists.
14. A mesh with skin placeholders validates joint/weight streams and inverse bind matrices but emits an unsupported-render diagnostic if rendered before skin support exists.

## Implementation Order Recommendation

After the planning gate closes, implement mesh support in this order:

1. Asset handle shape and in-memory mesh registry.
2. Mesh asset descriptor and validation.
3. MVP primitive builders returning mesh descriptors.
4. `Mesh` and `Material` authoring components.
5. Extraction of one packet per submesh with diagnostics.
6. Later renderer upload path from mesh asset handles to WebGPU buffers.

This keeps CPU asset data, ECS authoring, render extraction, and WebGPU ownership separated from the start.
