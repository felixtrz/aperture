# Raycasting And BVH Spatial Query Feature Proposal

Date: 2026-05-25

Status: implemented 2026-05-25

Implementation note:

- The renderer-independent core lives in `@aperture-engine/simulation` under
  `spatial/`.
- `@aperture-engine/render` provides a thin `MeshAsset` CPU-buffer adapter.
- `@aperture-engine/app/systems` exposes synchronous logic-side mesh queries through
  `this.spatial.setMeshes(...)` and
  `this.spatial.raycastFirst(ray, { source: "visual-mesh" })`.
- A separate BVH worker path was intentionally removed. BVH build/update work is
  same-thread simulation asset preparation, and gameplay query APIs do not return
  promises.

## Summary

Aperture currently has two useful but incomplete picking paths:

- `@aperture-engine/simulation` exposes bounds-only `raycast(...)` over
  ECS-owned data.
- `@aperture-engine/webgpu` exposes `WebGpuApp.pick(x, y)` through a
  renderer-owned ID-buffer readback derived from render snapshots.

This is not enough for mature 3D runtime use. Bounds picking is too coarse for
loaded GLB meshes, while ID-buffer picking is screen-space only and cannot serve
gameplay, editor tools, collision probes, snapping, brush selection, closest
point queries, or volume queries. Aperture needs a first-class CPU spatial query
layer with BVH acceleration, modeled closer to `three-mesh-bvh` than to
three.js's built-in `Raycaster`.

The recommended feature is a data-oriented Aperture BVH system that supports:

- exact mesh raycasts and first-hit raycasts;
- BVH traversal over custom volumes;
- sphere, box, capsule/segment, frustum, and triangle/mesh queries;
- closest point to point, segment, and mesh;
- BVH-vs-BVH overlap queries;
- object/entity-level scene BVH over ECS entities;
- static mesh BVHs with versioned same-thread cache and refit/rebuild policy;
- refit for limited vertex deformation and rebuild for larger topology changes;
- JSON-safe diagnostics and stats;
- no renderer-owned scene graph and no dependence on three.js classes.

## Reference Audit

Local reference commits inspected:

- three.js: `references/three.js` at `2654e30986`
- PlayCanvas engine: `references/engine` at `a4cdaf35c`
- Bevy: `references/bevy` at `370be1b02`
- three-mesh-bvh: `references/three-mesh-bvh` at `30811dc0`

The linked upstream repository was also checked for high-level scope:
`https://github.com/gkjohnson/three-mesh-bvh`.

### three.js

Source anchors:

- `references/three.js/src/core/Raycaster.js`
- `references/three.js/src/objects/Mesh.js`
- `references/three.js/src/objects/Line.js`
- `references/three.js/src/objects/Points.js`
- `references/three.js/src/objects/InstancedMesh.js`

Findings:

- `Raycaster` is a coordinator, not an acceleration structure. It builds rays
  from cameras/controllers, checks object layers, delegates to each object's
  `raycast(...)`, optionally recurses into children, and sorts hits.
- `Mesh.raycast(...)` checks a world-space bounding sphere, transforms the ray
  into local space, optionally checks the local bounding box, then loops every
  triangle in the draw range or material group.
- The default mesh path returns rich hit information: distance, world point,
  object, face/faceIndex, UVs, secondary UVs, interpolated normal, barycentric
  data, and instance IDs in instanced paths.
- Lines and points use threshold-based distance tests, but still follow the
  object-specific hook model.

Assessment:

three.js is useful for API coverage, camera ray creation, layer filtering, and
hit result fields. It is not a good performance model for Aperture. The default
mesh path is broad-phase plus linear triangle scan, and the traversal target is
a mutable `Object3D` graph. Aperture should not copy that structure.

### PlayCanvas

Source anchors:

- `references/engine/src/framework/components/camera/component.js`
- `references/engine/src/framework/components/rigid-body/system.js`
- `references/engine/src/framework/graphics/picker.js`
- `references/engine/src/framework/graphics/render-pass-picker.js`
- `references/engine/src/core/shape/*.js`

Findings:

- Camera screen picking is commonly expressed as two `screenToWorld(...)`
  points, then a physics raycast between them.
- `RigidBodyComponentSystem.raycastFirst(...)` and `raycastAll(...)` delegate to
  Ammo/Bullet. They support closest/all hits, collision group/mask filtering,
  tag filtering, callback filtering, and optional sort.
- PlayCanvas also has a GPU picker. `Picker` renders mesh instances into an
  offscreen pick buffer with unique IDs, supports async readback, and can
  optionally derive a world position from a depth buffer.
- `RenderPassPicker` walks layers and pickable mesh instances. It explicitly
  notes a limitation: it renders all mesh instances in relevant layers because
  it may not know if camera culling has already run.
- Core shape classes cover rays, AABBs, oriented boxes, spheres, planes,
  frustums, and triangles.

Assessment:

PlayCanvas has strong separation between visual ID picking and physics
raycasting, which is worth copying conceptually. It does not provide a general
mesh BVH query layer in the core engine. For Aperture, GPU ID picking should
remain a visual/editor convenience derived from snapshots, while CPU mesh
queries need their own acceleration layer.

### Bevy

Source anchors:

- `references/bevy/crates/bevy_picking/src/backend.rs`
- `references/bevy/crates/bevy_picking/src/mesh_picking/mod.rs`
- `references/bevy/crates/bevy_picking/src/mesh_picking/ray_cast/mod.rs`
- `references/bevy/crates/bevy_picking/src/mesh_picking/ray_cast/intersections.rs`

Findings:

- Bevy's picking design is architecturally close to Aperture's needs. Picking
  backends are loosely coupled producers of `PointerHits`; ray-based backends
  consume a shared `RayMap` that builds camera/pointer rays with viewport and
  DPI handling.
- Hit data is backend-neutral and can carry optional typed extra data.
- `MeshRayCast` is an immediate-mode ECS system parameter. It queries mesh
  entities, filters by visibility, render layers, pickability, and user
  predicates, then produces sorted hits.
- Bevy uses an AABB broad phase first. It parallel scans entity AABBs, sorts
  candidate entities by AABB entry distance, and then performs exact mesh tests.
- The exact mesh path is still a linear scan over triangle lists. It returns
  point, normal, barycentric coordinates, distance, triangle vertices, UV, and
  triangle index.
- It supports early-exit semantics but still checks potentially nearer AABBs
  because AABB entry order is not the same as exact hit order.
- `SimplifiedMesh` is a useful design: complex render meshes can specify a
  simpler query mesh.

Assessment:

Bevy provides the best architectural pattern: backends, camera ray maps,
visibility/layer filtering, pickability, and immediate-mode ECS queries. It does
not solve high-poly mesh query efficiency; its precise mesh test is still
triangle-linear after AABB culling. Aperture should copy the ECS/backend shape,
not the exact triangle traversal.

### three-mesh-bvh

Source anchors:

- `references/three-mesh-bvh/src/core/Constants.js`
- `references/three-mesh-bvh/src/core/BVH.js`
- `references/three-mesh-bvh/src/core/GeometryBVH.js`
- `references/three-mesh-bvh/src/core/MeshBVH.js`
- `references/three-mesh-bvh/src/core/LineBVH.js`
- `references/three-mesh-bvh/src/core/PointsBVH.js`
- `references/three-mesh-bvh/src/core/ObjectBVH.js`
- `references/three-mesh-bvh/src/core/build/*.js`
- `references/three-mesh-bvh/src/core/cast/*.js`
- `references/three-mesh-bvh/src/workers/*.js`
- `references/three-mesh-bvh/src/webgpu/*.js`

Findings:

- Build strategy supports center split, average split, and SAH. SAH tests 32
  candidate bins per axis and produces better trees at higher build cost.
- Packed nodes use compact typed-array storage. Node data is serialized as
  bounds plus child/leaf metadata rather than object references.
- Geometry BVHs can build in direct mode by reordering indices or in indirect
  mode by storing a primitive indirection buffer.
- Mesh BVH supports `raycast`, `raycastFirst`, `intersectsSphere`,
  `intersectsBox`, `intersectsGeometry`, `closestPointToPoint`,
  `closestPointToGeometry`, `shapecast`, `bvhcast`, `refit`, traversal,
  serialization, and deserialization in the reference library.
- `raycastFirst` traverses the near child first based on split axis and ray
  direction, then skips the far child when the first hit proves it cannot
  contain a closer result.
- `three-mesh-bvh` uses `shapecast` as its central traversal abstraction.
  Aperture maps that idea to `visitMeshBvh` so public `shape cast` terminology
  can mean swept shape queries.
- Specialized BVHs exist for triangle meshes, points, line segments, line loops,
  lines, skinned meshes, and object hierarchies.
- Worker builders exist in `three-mesh-bvh`, but Aperture intentionally does not
  copy that runtime shape because its gameplay queries stay in the simulation
  context.
- There are WebGPU shader query helpers, but the CPU BVH is the more immediate
  fit for Aperture's ECS simulation and tooling needs.

Assessment:

`three-mesh-bvh` is the right capability and efficiency baseline. Aperture
should not import it as-is because it is coupled to three.js `BufferGeometry`,
`Object3D`, and mutable geometry/index side effects. The correct move is an
Aperture-native, typed-array BVH with comparable query coverage.

## Aperture Design Goals

1. Keep ECS authoritative.
2. Keep GPU resources renderer-owned.
3. Keep CPU query data renderer-independent and worker-safe.
4. Support exact queries against static GLB/imported mesh assets.
5. Preserve current bounds-only raycast as a cheap broad-phase option.
6. Add BVH acceleration before adding broad gameplay/editor features that would
   otherwise bake in naive picking.
7. Make query diagnostics and performance visible.
8. Avoid a central mutable scene graph.

## Package Boundary Requirement

Raycasting, BVH traversal, closest-point, overlap, swept shape cast, BVH build,
serialization/debug snapshots, and refit logic must not depend on the render
world or WebGPU package.

The core implementation should live in `@aperture-engine/simulation` or a new
renderer-independent `@aperture-engine/spatial` package. It may depend on the
math and data-shape contracts needed to read CPU mesh buffers, but it must not
import:

- `@aperture-engine/webgpu`;
- renderer-owned GPU resources;
- `RenderWorld`;
- draw queues, pipelines, bind groups, render passes, or command encoders;
- browser globals.

If Aperture's source `MeshAsset` contract remains in `@aperture-engine/render`,
then `@aperture-engine/render` may provide a thin adapter that exposes mesh CPU
buffers through a spatial-data interface. The BVH/query core should still be
owned below that boundary and should accept plain typed-array mesh data rather
than render-world objects.

Main-thread input can still produce pointer positions, controller poses, or
screen-space coordinates. The generated browser bootstrap should forward those
inputs as commands/signals to the simulation worker, where systems derive rays
from ECS-authored cameras and run spatial queries. Main-thread
`WebGpuApp.pick(x, y)` remains a separate visual ID-buffer convenience derived
from render snapshots; it must not be the authoritative raycast/shape-query
path.

## Proposed Public Concepts

### Components And Assets

```ts
interface Pickable {
  enabled?: boolean;
  layerMask?: number;
  precision?: "bounds" | "visual-mesh" | "collider";
  blocksLower?: boolean;
  priority?: number;
}

interface MeshQueryAcceleration {
  mode: "none" | "auto-bvh" | "bvh";
  strategy?: "center" | "average" | "sah";
  maxLeafSize?: number;
  dynamicPolicy?: "static" | "refit" | "rebuild";
  simplifiedMesh?: MeshHandle;
}
```

`Pickable` is entity authoring data. `MeshQueryAcceleration` is asset/query
policy. Neither contains WebGPU state.

### Query API

```ts
interface SpatialRaycastOptions {
  maxDistance?: number;
  layerMask?: number;
  source?: "bounds" | "visual-mesh" | "collider";
  fallback?: "none" | "bounds";
  includeBackfaces?: boolean;
  includeUv?: boolean;
  includeNormal?: boolean;
  filter?: (entity: EntityRef) => boolean;
}

interface SpatialRaycastHit {
  entity: EntityRef;
  distance: number;
  point: Vec3;
  normal?: Vec3;
  uv?: Vec2;
  barycentric?: Vec3;
  faceIndex?: number;
  submeshIndex?: number;
  materialSlot?: number;
  instanceIndex?: number;
  source: "bounds" | "mesh-bvh" | "collider";
}
```

Systems call `this.spatial.raycastFirst(...)` for the common immediate gameplay
query and `this.spatial.raycastAll(...)` when they need all sorted hits. Query
options use explicit `source` and `fallback` fields rather than a vague
"best available" mode switch.

### BVH Asset API

```ts
interface MeshBvhBuildOptions {
  strategy?: "center" | "average" | "sah";
  maxDepth?: number;
  maxLeafSize?: number;
  indirect?: boolean;
}

interface MeshBvhQuery {
  raycast(ray: Ray, options?: MeshBvhRaycastOptions): MeshBvhHit[];
  raycastFirst(ray: Ray, options?: MeshBvhRaycastOptions): MeshBvhHit | null;
  visitMeshBvh(callbacks: MeshBvhVisitCallbacks): boolean;
  intersectsSphere(sphere: BoundingSphere): boolean;
  intersectsBox(box: Aabb, boxToMesh?: Mat4Like): boolean;
  closestPointToPoint(
    point: Vec3Like,
    options?: ClosestPointOptions,
  ): MeshBvhClosestPoint | null;
  refit(nodeIndices?: Iterable<number>): void;
  serialize(): SerializedMeshBvh;
}
```

This should live in a renderer-independent package, likely
`@aperture-engine/simulation` or a focused `@aperture-engine/spatial` package
if the module grows. The BVH consumes source mesh CPU buffers and transform
data, not GPU buffers.

### BVH Traversal API

BVH callback traversal should be explicit from the first BVH slice. It is the
low-level feature that turns raycasting into a general spatial query system. The
public gameplay term `shape cast` is reserved for swept shape queries, so the
advanced callback API uses `visitMeshBvh`.

```ts
type BvhShapeIntersection = "not-intersected" | "intersected" | "contained";

interface MeshBvhVisitCallbacks {
  intersectsBounds(
    bounds: Aabb,
    info: { isLeaf: boolean; depth: number; nodeIndex: number; score?: number },
  ): BvhShapeIntersection | boolean;

  boundsTraverseOrder?(bounds: Aabb): number;

  intersectsRange?(range: {
    offset: number;
    count: number;
    contained: boolean;
    depth: number;
    nodeIndex: number;
    bounds: Aabb;
  }): boolean;

  intersectsTriangle?(
    triangle: TriangleView,
    hit: TriangleHitScratch,
  ): boolean | void;
}
```

Required derived queries can then be implemented over this:

- raycast all;
- first ray hit;
- sphere/box/capsule overlap;
- frustum selection/lasso candidates;
- closest point to point/segment;
- BVH-vs-BVH candidate pairs.

## Internal Architecture

### Two-Level Acceleration

Aperture should use two BVH levels:

1. Mesh asset BVH: local-space BVH over triangles/lines/points/submesh ranges.
2. Entity/world BVH: world-space broad phase over ECS entities or render bounds.

The initial implementation can ship mesh asset BVHs first, using the existing
bounds list as the entity broad phase. The entity/world BVH should follow once
large scenes need accelerated many-entity queries.

### Data Layout

Use typed arrays, not object nodes:

- node bounds: `Float32Array`, six floats per node;
- node metadata: `Uint32Array`, child offsets or primitive offset/count;
- primitive indices: `Uint32Array` or `Uint16Array`;
- optional indirect primitive buffer for stable source index order;
- serialized representation with transferable buffers.

The shape should be close to `three-mesh-bvh`, but with Aperture-owned data
types and no mutation of source mesh buffers unless the asset explicitly opts
into index reordering during import/build.

### Build Policy

Default policy:

- Primitive count below a small threshold: no BVH or cheap center split.
- Normal static mesh: `center` or `average` for fast build.
- Large static GLB/imported mesh: `sah` or build-time configurable strategy.
- Dynamic deformed mesh: use `refit` for small deformations, rebuild after
  topology changes or large deformation diagnostics.
- Skinned/morphed meshes: initially use bounds or simplified query meshes; add
  skinned/refit support later.

### Build And Readiness

BVH build should be simulation-thread work:

- synchronous builder for tests, small meshes, and deterministic systems;
- scheduled same-thread asset preparation for larger assets;
- optional budgeted preparation across simulation ticks if startup cost becomes a
  problem;
- explicit readiness diagnostics and bounds/collider fallback policy when exact
  visual mesh data is unavailable;
- no separate BVH worker, transferable buffer protocol, SAB-specific handoff, or
  Promise-returning gameplay queries.

This matches Aperture's worker-by-default app direction while keeping BVH
queries with the ECS logic that uses them.

### Query Ownership

CPU spatial queries should run where the authoritative state is available:

- worker systems query ECS-owned transforms, pickable state, and source mesh
  acceleration data;
- main-thread renderer may perform ID-buffer visual picking, but it must return
  ECS entity refs and diagnostics, not become the authority for selection;
- future physics backends may provide collider/physics raycasts under the same
  report shape with `source: "physics"`.

## Feature Slices

### Slice 1: Exact Static Mesh Raycast

Add local-space triangle intersection helpers and a `MeshTriangleQuery` path
that scans triangles for a single mesh. This is intentionally simple and exists
to lock hit semantics before BVH acceleration.

Acceptance:

- raycast returns nearest and all hits for indexed and non-indexed meshes;
- hit includes point, normal, UV, barycentric, face index, submesh/material slot;
- tests cover backface policy and max distance;
- no WebGPU imports.

### Slice 2: Mesh BVH Builder And First-Hit Raycast

Add typed-array BVH build with center split, max depth, max leaf size, and
`raycastFirst`.

Acceptance:

- same hits as Slice 1 on test meshes;
- triangle test count is lower than linear scan on a large fixture;
- serialized stats report node count, leaf count, max depth, primitive count,
  and build strategy.

### Slice 3: Raycast All, SAH, And Indirect Mode

Add all-hit traversal, average and SAH build strategies, and indirect primitive
buffer support.

Acceptance:

- all-hit output matches linear scan after sorting;
- indirect mode does not reorder source mesh indices;
- SAH tree reports lower or equal traversal pressure than center split on an
  uneven fixture.

### Slice 4: BVH Traversal And Derived Shape Queries

Add BVH traversal callbacks and derive sphere, AABB/OBB, capsule/segment,
frustum, and closest-point queries.

Acceptance:

- BVH traversal can early-out on contained bounds;
- sphere and box overlap match brute-force triangle fixtures;
- closest point queries match brute-force results within epsilon;
- line/capsule selection fixture demonstrates non-ray query value.

### Slice 5: ECS Spatial Service Integration

Wire BVH queries into `this.spatial`.

Acceptance:

- systems can call
  `this.spatial.raycastFirst(ray, { source: "visual-mesh" })`;
- systems can call `this.spatial.raycastAll(...)` for all sorted hits;
- entities still filter by `Pickable`, layers, visibility, and optional
  callbacks;
- worker-side developer API selection can hit triangle-accurate geometry;
- current bounds-only behavior remains available and tested.

### Slice 6: Cache, Refit, Readiness, And Diagnostics

Add per-asset cache, mesh-version invalidation, optional `refit`, same-thread
readiness policy, and JSON-safe diagnostics.

Acceptance:

- cache key includes mesh handle, version, primitive ranges, and build options;
- changed vertex data can refit or trigger rebuild according to policy;
- no worker/SAB/transferable BVH build API is exposed;
- diagnostics report missing BVH, stale BVH, unsupported topology, unsupported
  skinned/morphed exact query, build time, memory estimate, and traversal stats.

### Slice 7: Entity/World BVH

Add broad-phase BVH over world-space entity bounds for large scenes.

Acceptance:

- many-entity raycast does not linearly scan all entity bounds in steady state;
- updates support dirty entity bounds without rebuilding every frame;
- query results remain stable and deterministic.

## Diagnostics And Reports

Minimum JSON-safe report fields:

```ts
interface SpatialQueryReport {
  queryId: string;
  source: "bounds" | "mesh-bvh" | "id-buffer" | "physics";
  fallback: "none" | "bounds";
  candidateEntityCount: number;
  testedEntityCount: number;
  testedPrimitiveCount: number;
  visitedNodeCount: number;
  hitCount: number;
  firstHitDistance: number | null;
  diagnostics: SpatialDiagnostic[];
}
```

Diagnostics should use stable codes:

- `spatial.ray.invalid`
- `spatial.mesh-bvh.missing`
- `spatial.mesh-bvh.stale`
- `spatial.mesh-bvh.unsupported-topology`
- `spatial.mesh-bvh.unsupported-skinned`
- `spatial.mesh-bvh.unsupported-morphed`
- `spatial.mesh-bvh.build-failed`
- `spatial.query.no-pickable`

## Non-Goals

- Do not make a three.js-style scene graph.
- Do not use renderer WebGPU buffers as CPU query input.
- Do not make GPU ID picking the only picking implementation.
- Do not require a physics engine for exact visual mesh queries.
- Do not introduce a separate BVH worker or async gameplay query path.
- Do not hide unavailable exact mesh data; report readiness and use explicit
  fallback policy.
- Do not add full CSG or physics collision response as part of this proposal.

## Recommendation

Prioritize this before expanding editor-like interaction, lasso selection,
brush tools, mesh snapping, collision authoring, or advanced XR interaction.
The current bounds-only and ID-buffer paths are useful foundations, but they
will force poor API decisions if they remain the only query model.

The implementation target should be "three-mesh-bvh-class capabilities,
Aperture-native architecture":

- Bevy for ECS/backend/pointer-ray architecture.
- PlayCanvas for keeping visual ID picking separate from physics queries.
- three-mesh-bvh for acceleration, BVH traversal, closest-point, debug/cache
  serialization, and refit capability.
