# Spatial Query Reshape Proposal

Date: 2026-05-25

Status: implemented for the immediate cleanup slice

Implementation note: the current repository slice now removes the separate BVH
worker surface, removes async BVH cache/build APIs, renames the public BVH
callback traversal API to `visitMeshBvh`, and exposes synchronous
`this.spatial.raycastFirst(...)` / `this.spatial.raycastAll(...)` calls with
explicit `source` and `fallback` options.

## Trigger

The current raycasting/BVH slice added a `mesh-bvh-worker` module and proposal
language around worker-capable BVH building. That was the wrong default for
Aperture's gameplay query model.

The important correction is stronger than "do not make raycast async." Aperture
should treat CPU spatial queries as part of the logic/simulation thread. A game
system should be able to raycast, overlap, closest-point query, or cast a shape
while it is running, get an immediate answer, and keep deterministic control
flow. There is no backward compatibility requirement, so the spatial query
surface should be reshaped around that principle instead of preserving worker
handoff concepts.

In this document, "separate worker" means an additional BVH/query worker beyond
Aperture's existing logic/simulation execution context. The existing
render/main-thread split is still the architectural baseline.

## Reference Findings

Local reference libraries point to a clear pattern:

- Bevy exposes mesh ray casts as a synchronous system parameter. The example in
  `references/bevy/examples/3d/mesh_ray_cast.rs` calls
  `ray_cast.cast_ray(...).first()` directly inside an `Update` system and uses
  the result immediately for bounce logic.
- three.js `Raycaster` is synchronous. Its docs state that intersections are
  returned sorted closest-first and that the raycaster delegates to each
  object's synchronous `raycast()` method. See
  `references/three.js/docs/pages/Raycaster.html.md`.
- `three-mesh-bvh` keeps gameplay/editor queries synchronous:
  `MeshBVH.raycast`, `raycastFirst`, `shapecast`, closest-point, and overlap
  methods are immediate calls. Its worker classes are specifically for
  generating BVHs asynchronously, and the worker implementation warns that
  transferred geometry buffers are unavailable while building. See
  `references/three-mesh-bvh/src/core/MeshBVH.js` and
  `references/three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js`.
- Babylon physics raycasts are synchronous wrappers over the physics plugin:
  `raycast`, `raycastMulti`, and `raycastToRef` return/fill results immediately.
  See
  `/Users/felixz/Projects/aperture-reference-libs/Babylon.js/packages/dev/core/src/Physics/v2/physicsEngine.ts`.
- PlayCanvas rigid-body raycasts are also synchronous; `raycastFirst` returns a
  `RaycastResult | null` directly. See
  `/Users/felixz/Projects/aperture-reference-libs/playcanvas-engine/src/framework/components/rigid-body/system.js`.

The pattern is not that BVH construction can never be asynchronous in other
engines. The pattern is that query calls used by game logic are synchronous. If
acceleration data is not ready, the engine either prepared it earlier, falls
back to a cheaper query, or reports that exact queries are unavailable. It does
not make ordinary gameplay code await raycasts.

## Design Decision

Aperture should not have a separate BVH worker path.

CPU spatial query construction and use should happen in the logic/simulation
execution context. Large builds may be scheduled as same-thread simulation asset
preparation work, budgeted across ticks if needed, but they must not introduce a
new Web Worker, transferable buffer protocol, SharedArrayBuffer requirement, or
Promise-returning gameplay query API.

The query contract should be:

```ts
const hit = this.spatial.raycastFirst(ray, {
  source: "visual-mesh",
  fallback: "bounds",
});

if (hit) {
  // use the result immediately in the same system update
}
```

There may be diagnostics and readiness state around acceleration structures, but
there should not be async raycasts, async shapecasts, or query promises in
normal system code.

## Core Principles

1. Spatial queries are gameplay/authoring logic, not renderer behavior.
2. Query APIs are synchronous and deterministic.
3. The logic thread owns query-visible spatial state.
4. The render thread owns GPU resources only.
5. BVHs are acceleration structures, not architecture boundaries.
6. Missing acceleration must not hide behind implicit async work.
7. Fallback behavior must be explicit at the query call or authoring policy.
8. `shape cast` should mean swept-shape query in public gameplay APIs;
   low-level BVH traversal callbacks should use a different name.
9. Broad phase and mesh-local acceleration should be separate concepts.
10. Result objects and diagnostics should be stable, typed, and usable by agents.

## What Should Change From The Current Slice

Remove the worker-facing surface:

- Delete `packages/simulation/src/spatial/mesh-bvh-worker.ts`.
- Stop exporting `mesh-bvh-worker.js` from `packages/simulation/src/spatial`.
- Remove worker-like tests and fake worker classes from
  `test/spatial/mesh-bvh.test.ts`.
- Remove `collectMeshBvhBuildTransferables`,
  `createMeshBvhWorkerBuildMessage`, `createMeshBvhWorkerBuiltMessage`,
  `buildMeshBvhWithWorker`, `MeshBvhWorkerLike`, and related message types.
- Remove `useSharedArrayBuffer` from `MeshBvhBuildOptions`.

Remove async build as a first-class cache shape:

- Delete `buildMeshBvhAsync`.
- Delete `MeshBvhCache.getOrBuildAsync`.
- Keep a synchronous cache API, but make readiness/fallback policy explicit.
- If budgeted building is added later, model it as a simulation asset
  preparation system with a status resource, not as a query-time promise.

Reframe serialization:

- `SerializedMeshBvh` should not be a public worker handoff contract.
- If serialization remains, it should be an internal/test/debug/persistent-cache
  snapshot format. It should not motivate public API shape.
- Public docs should not mention serialized BVH handoff unless a future asset
  cache decision accepts disk persistence.

Revisit names:

- `shapecast` is useful as an internal BVH traversal primitive, but it is a poor
  public gameplay name because engines and physics users usually read
  "shape cast" as a swept sphere/capsule/box query.
- Public APIs should use names like `overlapShape`, `castShapeFirst`,
  `castShapeAll`, and `closestPoint`.
- The advanced BVH callback API should be named `traverseBvh` or
  `visitMeshBvh`, not `shapecast`, if it remains public at all.

Move policy out of render authoring where possible:

- `Pickable` can stay render-adjacent because visual picking is a renderable
  entity concern.
- Mesh query acceleration policy is really spatial/asset policy, not renderer
  policy. From scratch, source mesh CPU data and query policy should live in a
  neutral asset/spatial layer consumed by both simulation and render extraction.
- The current render-side `MeshAsset` adapter is acceptable as a transition, but
  the optimal long-term shape is a source mesh asset package below both render
  preparation and spatial queries.

## Target Architecture

### Package Ownership

Preferred from-scratch layout:

```text
@aperture-engine/simulation
  ECS, systems, logic thread resources, query facade

@aperture-engine/assets or @aperture-engine/geometry
  source mesh CPU buffers, mesh handles, primitive ranges, mesh metadata

@aperture-engine/spatial
  optional future split for pure geometry queries and BVH internals

@aperture-engine/render
  render authoring components, extraction, render snapshots, GPU preparation

@aperture-engine/webgpu
  WebGPU resources and presentation only
```

It is fine to keep spatial internals in `@aperture-engine/simulation` for now,
but the conceptual dependency should be:

```text
source CPU mesh asset -> spatial index
source CPU mesh asset -> render extraction -> WebGPU preparation
```

The spatial index should not depend on render-world objects, GPU buffers,
browser globals, workers, or transferables.

### Frame And System Schedule

The logic frame should have explicit spatial phases:

```text
asset import/update
  -> mesh CPU data available
  -> spatial asset preparation
  -> transform resolution
  -> entity broad-phase update/refit
  -> user systems that query this.spatial
  -> render extraction
```

This makes query readiness predictable. If an asset's exact mesh index is
required before gameplay starts, the app can block scene readiness on the
simulation thread while the BVH is built. If an app chooses lazy/budgeted
preparation, systems can still query synchronously and receive either a fallback
hit or a diagnostic that exact mesh data is not ready.

### Authoring Model

From scratch, visual/query participation should be separated:

```ts
withPickable({
  enabled: true,
  layers: ["default", "interactable"],
  precision: "visual-mesh",
  fallback: "bounds",
  blocksLowerPriority: false,
  priority: 0,
});

withSpatialMeshQuery({
  source: "render-mesh",
  acceleration: "bvh",
  build: "eager",
  dynamic: "static",
  simplifiedMesh: undefined,
});
```

Important details:

- `Pickable` says whether an entity participates in picking/query filtering.
- `SpatialMeshQuery` says what geometry backs exact visual queries and how its
  local mesh index is maintained.
- `acceleration: "none" | "auto" | "bvh"` is same-thread policy only.
- `build: "eager" | "lazy" | "manual"` controls when the simulation prepares
  the index; none of these imply another worker.
- `dynamic: "static" | "refit" | "rebuild" | "deformed"` describes update
  behavior. Skinned/morphed exact queries should require an explicit deformed
  query source or report unsupported, not silently query bind-pose geometry.

### Spatial Data Model

Use two levels of acceleration:

1. Mesh-local index:
   - Built over immutable or versioned local-space triangle data.
   - Shared by all entities using the same source mesh/version/options.
   - Stores primitive ranges, submesh/material slot mapping, normals, UV
     availability, and diagnostics.

2. Entity/world index:
   - Built/refit over world-space entity bounds.
   - Stores entity id, query layers, visibility/pickable flags, query source
     readiness, and stable priority/order metadata.
   - Narrows candidates before mesh-local triangle queries.

The ray is transformed from world space into mesh-local space for exact mesh
tests. Hit points/normals/distances are transformed back to world space before
the result reaches user code.

### Query Facade

The public system API should bias toward common synchronous operations:

```ts
interface SpatialQueries {
  raycastFirst(ray: RayInput, options?: RaycastOptions): SpatialHit | null;
  raycastAll(ray: RayInput, options?: RaycastOptions): readonly SpatialHit[];
  raycastAllInto(
    ray: RayInput,
    out: SpatialHitWriter,
    options?: RaycastOptions,
  ): number;

  overlapShape(shape: SpatialShape, options?: ShapeQueryOptions): boolean;
  overlapShapeAll(
    shape: SpatialShape,
    options?: ShapeQueryOptions,
  ): readonly SpatialOverlap[];

  castShapeFirst(
    cast: SpatialShapeCast,
    options?: ShapeCastOptions,
  ): SpatialHit | null;

  closestPoint(
    point: Vec3Like,
    options?: ClosestPointQueryOptions,
  ): SpatialClosestPoint | null;

  explainReadiness(target?: Entity | MeshHandle): SpatialReadinessReport;
}
```

`raycastFirst` should be the ergonomic default because it matches how gameplay
logic usually queries. `raycastAllInto` gives hot paths a no-allocation escape
hatch later.

Avoid `mode: "best"` as a primary API. It hides too much. Prefer explicit
source/fallback fields:

```ts
interface RaycastOptions {
  readonly source?: "bounds" | "visual-mesh" | "collider";
  readonly fallback?: "none" | "bounds";
  readonly layers?: SpatialLayerMask;
  readonly maxDistance?: number;
  readonly includeBackfaces?: boolean;
  readonly includeUv?: boolean;
  readonly includeNormal?: boolean;
  readonly filter?: (entity: Entity) => boolean;
}
```

`source: "visual-mesh", fallback: "bounds"` is clear. `source: "visual-mesh",
fallback: "none"` is clear. `mode: "best"` is not.

### Shape Queries

Use precise public terminology:

- `overlapShape`: static sphere/box/capsule/frustum/mesh overlap.
- `castShapeFirst` / `castShapeAll`: swept shape query, equivalent to what many
  physics users call a shape cast.
- `closestPoint`: nearest point on queryable geometry.
- `visitMeshBvh` or `traverseMeshBvh`: advanced callback traversal for tools,
  diagnostics, and derived query implementation.

This avoids overloading `shapecast`. The current BVH callback API is useful, but
it should not define the user-facing shape-query vocabulary.

### Readiness And Fallback

Exact mesh query readiness should be inspectable:

```ts
type SpatialMeshReadiness =
  | { state: "ready"; index: "bvh" | "linear"; version: string }
  | { state: "pending"; reason: string; fallback: "bounds" | "none" }
  | { state: "unsupported"; diagnostics: SpatialDiagnostic[] };
```

Rules:

- If exact mesh data is ready, query it synchronously.
- If exact mesh data is pending and fallback is allowed, query bounds and
  include a diagnostic in the report path.
- If exact mesh data is pending and fallback is not allowed, return no exact hit
  and expose a diagnostic.
- If exact mesh data is unsupported, do not silently query incorrect geometry.

The normal `raycastFirst` return type should stay simple. Detailed diagnostics
can be retrieved through report APIs or an optional `report` writer passed in
the options.

### Dynamic And Deformed Meshes

Static meshes:

- Build one BVH per mesh asset version and query policy.
- Reuse across entities.

Position-only changes with stable topology:

- Use `refit` if the caller declares that topology and primitive ranges are
  stable.
- Rebuild if the deformation invalidates bounds quality too far or if refit is
  not allowed.

Topology changes:

- Rebuild synchronously in the simulation preparation phase.

Skinned/morphed meshes:

- Do not claim exact visual queries unless there is a deformed query mesh source
  or per-entity deformed acceleration path.
- Bounds fallback is acceptable when explicitly requested.
- Diagnostics should say whether the hit came from bind-pose mesh, deformed
  mesh, bounds, or collider. Ideally, bind-pose exact queries are not exposed as
  "exact visual" by default.

### Diagnostics

Diagnostics should answer:

- Was the entity considered?
- Which broad phase was used?
- Which exact source was used?
- Was a fallback used?
- Was a mesh index missing, stale, pending, unsupported, or rebuilt?
- How many entities, bounds, nodes, and primitives were tested?
- Why was an entity skipped?

Keep diagnostics JSON-safe and stable. Do not require them on the hot path.

### Performance Policy

Same-thread does not mean careless:

- Build BVHs in asset/spatial preparation phases, not inside arbitrary query
  calls by default.
- Provide explicit `build: "lazy"` only when a user accepts a possible
  synchronous build during the next preparation phase.
- Keep query traversal allocation-conscious.
- Add `Into`/writer APIs for hot loops.
- Keep broad-phase refit cheap and deterministic.
- Report build time and memory estimates.

If very large imports become a problem, the first response should be same-thread
budgeted simulation preparation with visible readiness status, not another
worker. A future decision could reconsider offline build caches, but not an
extra runtime BVH worker.

## Proposed Rewrite Of The Existing Decision

Decision 0015 should become:

> Aperture CPU spatial queries use native, renderer-independent typed-array
> acceleration structures owned by the logic/simulation layer. Raycasts,
> shape overlaps, swept shape casts, closest-point queries, and BVH traversal
> execute synchronously inside the logic thread. BVH build/update work is part
> of simulation asset preparation and never creates a separate runtime BVH
> worker. Query APIs do not return promises. Missing exact-query data is handled
> through explicit readiness diagnostics and fallback policy.

Consequences:

- System authors can use spatial queries in ordinary deterministic game logic.
- The render/main thread remains separate and never becomes authoritative.
- There is no BVH worker protocol, transferable buffer API, or SAB query path.
- Large mesh acceleration has to be handled through readiness, eager build,
  budgeted same-thread preparation, simplification, or explicit bounds/collider
  fallback.
- Advanced serialization, if kept, is for cache/debug snapshots only.

## Implementation Shape If Starting Fresh

1. Define source mesh CPU data below render preparation.
2. Define `SpatialWorld` as a simulation resource.
3. Define `SpatialMeshIndex` with sync `build`, `refit`, and `query` methods.
4. Define `EntitySpatialIndex` as the world broad phase.
5. Add `Pickable`/`QueryTarget` and `SpatialMeshQuery` authoring components.
6. Add scheduled systems:
   - collect queryable entities;
   - prepare mesh indices;
   - update/refit broad phase;
   - publish `this.spatial`.
7. Expose synchronous query methods only.
8. Add report/writer APIs after the ergonomic API is stable.
9. Add tests around fallback/readiness semantics before adding more query types.
10. Only then add overlap, swept shape casts, closest point, and advanced BVH
    traversal as separate vertical slices.

## Immediate Cleanup Implementation

For the current repository, this code slice:

1. Remove the worker module, exports, worker tests, `useSharedArrayBuffer`, and
   async cache API.
2. Rename or hide public `shapecast` before it becomes a durable gameplay API.
3. Replace `mode: "best"` docs with explicit `source`/`fallback` language.
4. Update `docs/RAYCASTING_BVH_FEATURE_PROPOSAL.md` and `docs/DECISIONS.md` to
   reflect the no-separate-BVH-worker decision.
5. Add tests that prove mesh raycasts remain synchronous and that missing BVHs
   follow explicit fallback/diagnostic policy.

## Open Questions

- Should source mesh CPU asset contracts move out of `@aperture-engine/render`
  now, or wait until the next asset-layer cleanup?
- Should exact visual mesh queries require `Pickable.precision: "visual-mesh"`
  explicitly, or should mesh renderables default to bounds-only until opted in?
- Should lazy BVH build ever happen during a query call, or only during a
  scheduled preparation phase? My recommendation is preparation phase only.
- Should the advanced BVH traversal API be exported publicly at all, or kept
  internal until a real editor/tooling use case needs it?

## Bottom Line

If implementing from scratch with this conversation in mind, I would build
spatial queries as a synchronous simulation subsystem with explicit readiness
and fallback policy. BVHs would be same-thread acceleration data owned by the
logic side. I would not add a BVH worker protocol, transferable handoff,
SharedArrayBuffer option, async cache method, or promise-based query surface.
