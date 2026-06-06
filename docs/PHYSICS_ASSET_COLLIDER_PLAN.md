# Physics Asset-Backed Collider Plan

Updated: 2026-06-06
Status: implemented

## Direction

Asset-backed colliders are the current implemented physics product slice. The
goal was to make ECS-authored `convexHull`, `trimesh`, and `heightfield`
colliders produce real Rapier colliders through the generated simulation-worker
route, then prove the result in a large-scale browser physics example.

The dedicated Rapier physics-worker route remains supported, but it is not the
next focus. Do not spend the next slice benchmarking simulation-worker physics
against the dedicated physics worker. The default developer and agent workflow
stays:

1. `ecs_pause`
2. `ecs_snapshot`
3. ECS edit or physics command
4. `ecs_step` or `ecs_step_and_diff`
5. physics query/debug inspection
6. `ecs_diff`

## Current Source State

The ECS authoring surface and Rapier path now have a V1 asset-backed collider
implementation:

- `packages/physics/src/components.ts` defines `PhysicsShape` variants for
  `convexHull`, `trimesh`, and `heightfield`.
- `packages/physics/src/ecs-sync.ts` reads `Collider.meshId` and
  `Collider.heightfieldAssetId` into backend-neutral collider descriptors, and
  includes ECS scale so non-unit V1 asset-collider scale can be diagnosed.
- `packages/physics/src/collider-geometry.ts` defines backend-neutral
  triangle-mesh and heightfield geometry contracts plus structured geometry
  errors.
- `packages/app/src/physics-collider-geometry.ts` adapts registered render
  `MeshAsset` CPU geometry into packed physics geometry, caches by asset version,
  and returns missing/not-ready/invalid diagnostics instead of approximating.
- `packages/physics/src/backend.ts` keeps the no-provider path honest with
  `physics.collider.assetShape.unsupported`, and in provider mode rejects
  dynamic `trimesh`/`heightfield` and non-unit asset-collider scale with
  specific diagnostics.
- `packages/physics-rapier/src/colliders.ts` cooks provider-backed
  `convexHull`, static `trimesh`, and static `heightfield` descriptors into
  real Rapier colliders.
- `packages/render/src/mesh/spatial-adapter.ts` already converts a
  `MeshAsset` into a triangle-list `SpatialTriangleMesh` for CPU spatial
  queries. The app physics provider reuses that adapter for physics mesh
  extraction.
- Rapier 0.19.3 exposes `ColliderDesc.trimesh(...)`,
  `ColliderDesc.convexHull(...)`, `ColliderDesc.convexMesh(...)`, and
  `ColliderDesc.heightfield(...)`.
- `test/app/generated-worker-start.test.ts` proves pause/snapshot/edit/step/query
  and diff against a provider-backed asset collider in an async generated Rapier
  simulation worker.
- `examples/physics-large-scale.html` and
  `test/e2e/physics-large-scale.spec.ts` prove a larger simulation-worker scene
  with asset-backed terrain and hundreds of dynamic primitive bodies.

Reference anchors:

- `references/bevy/crates/bevy_mesh/src/lib.rs`
- `references/bevy/crates/bevy_mesh/src/index.rs`
- `references/bevy/crates/bevy_mesh/src/mesh.rs`
- `references/bevy/crates/bevy_app/src/main_schedule.rs`
- `references/engine/src/framework/components/collision/system.js`
- `references/engine/src/framework/components/collision/component.js`
- `references/engine/src/framework/components/rigid-body/system.js`
- `packages/render/src/mesh/spatial-adapter.ts`
- `packages/physics-rapier/src/colliders.ts`

## Reference Check

Bevy does not ship a built-in physics collider implementation in these
references, so it is a reference for ECS scheduling and mesh asset extraction
boundaries, not for collider cooking parity. The relevant lessons are:

- `MeshPlugin` registers `Mesh` as an asset and marks mesh components changed
  after asset events.
- `Mesh::triangles()` accepts only triangle-list or triangle-strip topology,
  requires `Float32x3` positions, handles indexed and unindexed meshes, and
  returns explicit topology/position/index errors.
- `FixedUpdate` and `RunFixedMainLoopSystems::AfterFixedMainLoop` are the right
  conceptual match for Aperture's fixed physics step followed by transform
  interpolation/extraction.

PlayCanvas does have an asset-backed mesh collider path in
`CollisionMeshSystemImpl`, and it supports the direction of this plan:

- `CollisionComponent` exposes `type: "mesh"`, `asset`, `renderAsset`,
  `convexHull`, and `checkVertexDuplicates` authoring fields.
- Mesh colliders are built from render/model assets once those assets are ready;
  missing or not-yet-ready assets defer shape recreation instead of falling back
  to fake primitive bounds.
- `convexHull` creates an Ammo `btConvexHullShape` from mesh positions.
- Non-convex mesh mode builds a cached `btTriangleMesh` and wraps it in
  `btBvhTriangleMeshShape`.
- Compound shapes are used to combine multiple meshes/submeshes with per-node
  transforms.
- Scale changes recreate the mesh shape or apply local scaling.
- Physics steps before dynamic entity transforms are written back.

Aperture should borrow the asset-backed cooking, cache, and explicit
recreation/invalidation ideas, but not PlayCanvas's mutable scene-graph
ownership model. Aperture's provider boundary is still the right dependency
shape because ECS stays authoritative and the Rapier backend must not reach into
render/app assets directly.

## Architectural Constraints

- ECS remains authoritative. Collider authoring is stored on ECS components.
- `@aperture-engine/physics` remains backend-neutral and must not import
  `@aperture-engine/render`, `@aperture-engine/app`, WebGPU, browser globals, or
  Rapier.
- `@aperture-engine/physics-rapier` may consume backend-neutral cooked geometry,
  but should not reach into the app asset registry directly.
- App/runtime code is the composition layer that can see both render mesh assets
  and physics backend setup.
- Render mesh assets remain render/source assets. Physics may adapt their CPU
  source geometry into backend-neutral collider geometry, but the physics backend
  must not depend on renderer-owned GPU resources.
- Existing structured unsupported-feature diagnostics should remain honest. When
  cooking fails, report why; do not silently approximate with primitive bounds.

## V1 Feature Policy

Implement these first:

- `convexHull` from a render `MeshAsset` POSITION stream.
- `trimesh` from a render `MeshAsset` triangle-list POSITION/index data.
- Static `heightfield` from a backend-neutral heightfield asset shape.
- Simulation-worker proof and generated-worker `ecs_step` / `ecs_diff` proof.
- Large-scale browser example using same-worker Rapier through the existing
  simulation-worker route.

Keep these out of V1:

- Dynamic trimesh bodies. Trimesh and heightfield are terrain/static-collider
  tools first. Dynamic non-convex mesh colliders should continue to report an
  unsupported feature until a safe policy exists.
- Non-unit ECS scale for asset-backed colliders. Current physics transforms use
  translation and rotation; V1 should either require baked geometry at physics
  scale or report a clear diagnostic for non-unit scale instead of silently
  diverging from rendering. PlayCanvas bakes or reapplies mesh scale and
  recreates shapes on scale changes; Aperture can add that later, but V1 should
  not hide scale semantics behind implicit backend cooking.
- Runtime mesh decimation or expensive async cooking. V1 should cook from the
  CPU mesh data already present in registered assets.
- Dedicated physics-worker promotion or comparative benchmarking.

## Data Contracts

Add backend-neutral collider geometry contracts in `@aperture-engine/physics`.
Suggested names:

```ts
export interface PhysicsTriangleMeshGeometry {
  readonly key: string;
  readonly sourceVersion?: number;
  readonly positions: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
}

export interface PhysicsHeightfieldGeometry {
  readonly key: string;
  readonly sourceVersion?: number;
  readonly rows: number;
  readonly columns: number;
  readonly heights: Float32Array;
  readonly scale: PhysicsVec3;
}

export interface PhysicsColliderGeometryProvider {
  triangleMesh(meshId: string): PhysicsTriangleMeshGeometry | null;
  heightfield(assetId: string): PhysicsHeightfieldGeometry | null;
}
```

The exact names can change, but the boundary should be stable:

- A provider returns typed arrays ready for backend cooking.
- A missing provider or missing asset produces a structured unsupported/missing
  diagnostic.
- The provider is optional so deterministic tests and low-level backend tests
  can still run without app assets.

## Mesh Adapter

Add an app/render-side adapter that reuses the existing mesh spatial adapter:

1. Resolve `Collider.meshId` through `AssetRegistry` using `createMeshHandle`.
2. Fetch the registered `MeshAsset`.
3. Call `createSpatialTriangleMeshFromMeshAsset(mesh)`.
4. Convert the resulting `SpatialTriangleMesh` into packed physics geometry:
   - `Float32Array` positions in contiguous xyz order.
   - `Uint32Array` triangle indices.
   - respect submesh `indexStart` / `indexCount` and `vertexStart` /
     `vertexCount`.
5. Cache by mesh asset key plus source version or content signature.
6. Invalidate cached geometry when the source mesh asset version changes.
7. Preserve structured adapter errors for wrong topology, missing `POSITION`,
   bad indices, or unsupported vertex formats, matching Bevy's explicit mesh
   extraction failure style.

Do not put this adapter inside `@aperture-engine/physics-rapier`; it would
create the wrong dependency direction.

## Rapier Cooking

Extend `RapierPhysicsBackendOptions` with an optional geometry provider:

```ts
export interface RapierPhysicsBackendOptions {
  readonly gravity?: PhysicsVec3;
  readonly execution?: PhysicsExecutionMode;
  readonly colliderGeometryProvider?: PhysicsColliderGeometryProvider;
}
```

Then update `packages/physics-rapier/src/colliders.ts`:

- `convexHull`: fetch triangle mesh geometry by `meshId`, call
  `RAPIER.ColliderDesc.convexHull(points)`, and report a cooking failure if
  Rapier returns `null`.
- `trimesh`: fetch triangle mesh geometry by `meshId`, call
  `RAPIER.ColliderDesc.trimesh(vertices, indices, flags)`.
- `heightfield`: fetch heightfield geometry by `assetId`, call
  `RAPIER.ColliderDesc.heightfield(rows - 1, columns - 1, heights, scale,
flags)`. Aperture's backend-neutral contract stores sample rows/columns;
  Rapier's JS path expects cell counts with `(rows + 1) * (columns + 1)` height
  samples.
- Apply the existing collider translation, rotation, sensor/material/group, and
  event setup exactly like primitive colliders.

Use Rapier flags intentionally:

- For trimesh terrain, prefer internal-edge fixing and bad/degenerate triangle
  cleanup when available.
- Keep the chosen flags visible in debug/status reports so agents can verify the
  cooking path.

## Unsupported Feature Handling

The current blanket asset-shape unsupported check should become conditional:

- If the active backend has no geometry provider, report
  `physics.collider.assetShape.unsupported`.
- If the asset is missing or not ready, report a missing/not-ready feature with
  `meshId` or `heightfieldAssetId`.
- If mesh topology or POSITION format cannot be adapted, forward a structured
  diagnostic instead of cooking.
- If the body is dynamic with `trimesh` or `heightfield`, report a specific
  unsupported feature such as
  `physics.collider.dynamicAssetShape.unsupported`.
- If cooking succeeds, the sync report should have zero unsupported asset-shape
  features and nonzero backend collider counts.

## Large-Scale Physics Example

Add a visible example after the cooking path lands:

- `examples/physics-large-scale.html`
- `examples/physics-large-scale.main.js`
- `examples/physics-large-scale.worker.js`
- optional `examples/physics-large-scale-scene.js`

The example should use the generated simulation-worker route, not the dedicated
physics worker.

Scene shape:

- One static asset-backed terrain collider:
  - V1 candidate: a triangle-list ramp/platform mesh using `trimesh`.
  - Follow-up candidate: a grid terrain using `heightfield`.
- Many dynamic primitive bodies:
  - Start with 256-512 boxes/spheres/capsules.
  - Use deterministic spawn positions and velocities.
  - Keep materials simple and renderable with existing mesh/material helpers.
- A few convex-hull dynamic bodies if the V1 convex path is stable.
- Debug/status overlay or JSON status exposing:
  - backend kind/build/execution
  - fixed-step count
  - body/collider/readback/writeback counts
  - asset-backed collider count
  - unsupported feature count
  - event counts
  - active/sleeping body counts
  - broad finite timing fields from the existing physics summary

This is not a benchmark against another worker route. It is a scale and
correctness proof that the default simulation-worker physics path can run a
larger scene with real asset-backed terrain.

## Tests And Proofs

Unit and integration coverage:

- `test/physics/component-validation.test.ts`
  - keep missing `meshId` / `heightfieldAssetId` diagnostics.
- `test/physics/test-backend.test.ts`
  - keep deterministic backend unsupported behavior unless a deterministic
    geometry path is explicitly added.
- `test/physics-rapier/rapier-backend.test.ts`
  - prove convex hull cooking creates a collider and produces query hits.
  - prove trimesh cooking creates a static terrain collider and dynamic bodies
    collide with it.
  - prove heightfield cooking creates a static terrain collider.
  - prove missing geometry provider/asset reports structured unsupported
    features.
  - prove dynamic trimesh/heightfield is rejected with a specific diagnostic.
- `test/app/generated-worker-start.test.ts`
  - pause an async Rapier generated worker, mutate a collider to `trimesh`, step
    physics, assert zero asset-shape unsupported features, run a physics query,
    and diff durable ECS writeback.

Browser proof:

- `test/e2e/physics-large-scale.spec.ts`
  - route reaches ready status.
  - WebGPU canvas contains non-clear pixels.
  - status reports Rapier, simulation-worker execution, zero asset-shape
    unsupported features, nonzero asset-backed collider count, at least the
    target dynamic body count, nonzero readback/writeback counts, and finite
    timing fields.

Validation target:

- Focused physics/Rapier/app/generated-worker tests.
- New large-scale Playwright route.
- `pnpm run check`.

## Implementation Slices

1. Backend-neutral geometry provider contracts — done
   - Add provider/geometry types to `@aperture-engine/physics`.
   - Extend Rapier backend options without changing default behavior.
   - Tests prove no-provider behavior still reports unsupported asset shapes.

2. Mesh-to-physics geometry adapter — done
   - Build an app/render adapter around `createSpatialTriangleMeshFromMeshAsset`.
   - Pack positions/indices into contiguous arrays.
   - Add diagnostics for missing asset, unsupported topology, unsupported
     POSITION/index format, empty mesh, and non-unit physics scale.

3. Rapier convex hull and trimesh cooking — done
   - Implement `convexHull` and static `trimesh` in `colliderDesc(...)`.
   - Add collider metadata/debug status for cooked shape kind and source key.
   - Replace successful asset-backed colliders in sync with real Rapier
     colliders instead of unsupported features.

4. Heightfield contract and cooking — done
   - Add a small heightfield asset/source contract.
   - Cook with `ColliderDesc.heightfield(...)`.
   - Prove queries/collisions against a static heightfield.

5. Generated-worker pause/step/diff proof — done
   - Wire the geometry provider into generated Rapier backend construction.
   - Prove asset-backed collider mutation and post-step query/writeback through
     `ecs_step_and_diff`.

6. Large-scale example — done
   - Add the example route and E2E proof.
   - Keep status JSON concise and agent-readable.
   - Use deterministic scene construction so failures are reproducible.

7. Docs/tracker cleanup — done
   - Update `docs/PHYSICS_IMPLEMENTATION_PLAN.md`,
     `docs/SOTA_ROADMAP.md`, `docs/index.html`, and agent handoff/backlog.

## Acceptance Criteria

- [x] A Rapier simulation-worker scene can use a real `trimesh` or `heightfield`
      collider from ECS asset-backed collider authoring.
- [x] Generated-worker devtools can pause, step, query, and diff that asset-backed
      collider path.
- [x] Missing or invalid collider assets remain structured diagnostics.
- [x] Dynamic non-convex asset colliders do not silently run.
- [x] `examples/physics-large-scale.html` proves a larger scene with asset-backed
      terrain and hundreds of dynamic bodies.
- [x] The new E2E test and `pnpm run check` pass.
