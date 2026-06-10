# Recipe: Spatial Queries from Systems

**Status:** reference

## Goal

Run raycast, overlap, and closest-point queries from a worker system through
`this.spatial` (the same facade as `app.context.spatial` /
`createSpatialQueries()`), using either the automatically populated index of
spawned meshes or explicitly registered bounds/meshes.

## Code

### 1. Zero-setup: spawned meshes are queryable automatically

Spawn a camera and a mesh; the app context populates the spatial index, so a
camera ray hits the mesh with no manual registration:

```ts
class AutoSpatialSetupSystem extends createSystem({ priority: 0 }) {
  override init(): void {
    this.spawn.camera({
      key: "camera.main",
      transform: {
        translation: [0, 0, 5],
        lookAt: [0, 0, 0],
      },
      fovYDegrees: 60,
    });
    this.spawn.mesh({
      key: "target.plane",
      mesh: meshDescriptor.plane({ size: [2, 2] }),
      material: material.standard({ baseColor: [1, 0.5, 0.2, 1] }),
    });
  }
}
```

```ts
app.step(1 / 60, 0);
const hit = app.context.spatial.raycastFirst(
  app.context.cameras.main.rayFromPointer([0.5, 0.5]),
  { source: "visual-mesh", includeBackfaces: true },
);

expect(hit).toMatchObject({
  source: "mesh-bvh",
  entity: {
    ref: {
      index: expect.any(Number),
      generation: expect.any(Number),
    },
  },
});
```

Source: `test/app/spatial-index-population.test.ts` ("auto-populates the app
context so camera rays hit spawned meshes without manual setup").

### 2. Raycast from inside a system with explicit registration

For full control of layers and precision, register bounds and triangle meshes
yourself and query `this.spatial` directly in the system:

```ts
const entity = this.spawn.mesh({
  key: "level.pick-plane",
  name: "pick-plane",
  mesh: mesh.plane({ size: [2, 2] }),
  material: material.standard(),
});

this.spatial.setBounds([
  {
    entity,
    worldAabb: { min: [-1, -1, 0], max: [1, 1, 0] },
    layerMask: 0b0010,
    pickable: { enabled: true, layerMask: 0b0010 },
  },
]);
this.spatial.setMeshes([
  {
    entity,
    mesh: queryMesh,
    bvh: createMeshBvh(queryMesh),
    layerMask: 0b0010,
    pickable: {
      enabled: true,
      precision: "visual-mesh",
      layerMask: 0b0010,
    },
  },
]);
hits.push(
  this.spatial.raycastFirst(
    { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
    { source: "visual-mesh", layerMask: 0b0010 },
  ),
);
```

Source: `test/app/developer-api.test.ts` ("lets worker-safe systems raycast
triangle-accurate mesh queries"; excerpt — the source registers additional
bounds and mesh entries and fires several more rays).

Ray options come from the same test family: `source` is `"bounds"`,
`"collider"`, or `"visual-mesh"` with an optional `fallback`, plus
`layerMask`, `maxDistance`, `includeBackfaces`, `includeNormal`, `includeUv`,
`filter`, and `query: { entities }` scoping — see
`test/app/spatial-queries.test.ts` ("spatial query facade") for every
combination, including `raycastAll` ordering across BVH and linear entries.

### 3. Overlap queries

```ts
const hits = spatial.overlapBox([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]);
expect(hits.map((h) => h.entity.entity)).toEqual([e]);
```

Source: `test/app/spatial-overlap-shapes.test.ts` ("reports a box that
straddles the plane").

```ts
// Segment runs at z=0.5 (above the plane); radius 0.75 reaches down to z=0.
const hits = spatial.overlapCapsule([-0.5, 0, 0.5], [0.5, 0, 0.5], 0.75);
expect(hits.map((h) => h.entity.entity)).toEqual([e]);
```

Source: `test/app/spatial-overlap-shapes.test.ts` ("reports a capsule that
only reaches the plane via its radius"). Overlap queries require a BVH:
entries registered without one are skipped ("skips meshes without a BVH",
same file).

### 4. Closest point on any registered mesh

```ts
const hit = spatial.closestPoint([0.25, 0.1, 3]);
expect(hit).not.toBeNull();
expect(hit?.entity.entity).toBe(e);
expect(hit?.point[0]).toBeCloseTo(0.25, 5);
expect(hit?.point[1]).toBeCloseTo(0.1, 5);
expect(hit?.point[2]).toBeCloseTo(0, 5);
expect(hit?.distance).toBeCloseTo(3, 5);
```

Source: `test/app/spatial-closest-point.test.ts` ("projects an above-plane
point onto the nearest surface point").

```ts
expect(spatial.closestPoint([0, 0, 5], { maxDistance: 4 })).toBeNull();
expect(
  spatial.closestPoint([0, 0, 5], { maxDistance: 6 })?.distance,
).toBeCloseTo(5, 5);
```

Source: `test/app/spatial-closest-point.test.ts` ("drops results beyond
maxDistance"). `worldFromMesh` transforms are honored ("resolves through a
world-from-mesh transform", same file).

## Verify

The hit report fields are the verification surface:

```ts
expect(hits[0]).toMatchObject({
  source: "mesh-bvh",
  distance: 1,
  faceIndex: 0,
  materialSlot: 0,
  entity: {
    ref: expect.objectContaining({ index: expect.any(Number) }),
  },
});
```

Source: `test/app/developer-api.test.ts` ("lets worker-safe systems raycast
triangle-accurate mesh queries"). `source` reports which path resolved the hit
(`"bounds"`, `"collider"`, `"mesh-bvh"`, `"mesh-linear"`); misses return
`null` (`raycastFirst`) or `[]` (`raycastAll`, overlaps).

With a managed dev session, the tooling counterpart of a camera raycast is:

```ts
const pickedEntity = await callMcpTool("render_pick_entity", {
  x: 0.5,
  y: 0.5,
});
expect(pickedEntity.structuredContent).toMatchObject({
  result: {
    x: expect.any(Number),
    y: expect.any(Number),
    pick: expect.any(Object),
  },
});
```

Source: `test/e2e/cli-ai-tools.spec.ts` ("Aperture CLI manages a browser
session and exposes browser/ECS tools over MCP"); CLI form
`pnpm exec aperture tool render_pick_entity --json '{"x":0.5,"y":0.5}'`.

## Revert / cleanup

Queries are read-only — there is nothing to revert. `setBounds`/`setMeshes`
replace the registered entries for the entities they name on each call, and
`Pickable` state (enabled/precision/layerMask) gates what the populated index
serves (see `test/app/spatial-index-population.test.ts` "honors Pickable
disabled state and layer masks").

See `docs/AUTHORING.md` ("Spatial Queries") for the concept-level summary.
