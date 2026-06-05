import { describe, expect, it } from "vitest";
import {
  createMeshBvhCache,
  createWorld,
  type Entity,
  type SpatialTriangleMesh,
} from "@aperture-engine/simulation";
import {
  createPlaneMeshAsset,
  createSpatialTriangleMeshFromMeshAsset,
} from "@aperture-engine/render";
import { createSpatialQueries } from "@aperture-engine/app/systems";

function planeMesh(): SpatialTriangleMesh {
  const report = createSpatialTriangleMeshFromMeshAsset(
    createPlaneMeshAsset({ width: 2, height: 2 }),
  );
  if (report.mesh === null) {
    throw new Error("Expected plane fixture to produce a spatial mesh.");
  }
  return report.mesh;
}

function twoEntities(): readonly [Entity, Entity] {
  const world = createWorld({ entityCapacity: 4 });
  return [world.createEntity(), world.createEntity()];
}

// Audit fix A3: MeshBvhCache must evict the superseded version's BVH on a version
// bump so dynamic meshes (re-bake / LOD swap / repeated markReady) do not leak.
describe("mesh BVH cache eviction (audit A3)", () => {
  it("evicts the prior version's BVH on a version bump (no re-bake leak)", () => {
    const mesh = planeMesh();
    const cache = createMeshBvhCache();
    const build = (version: number) =>
      cache.getOrBuild({
        meshKey: "mesh://evict/plane",
        version,
        mesh,
        options: { strategy: "center", maxLeafSize: 2 },
      });

    expect(build(1).built).toBe(true);
    expect(build(2).built).toBe(true); // version bump supersedes v1

    // v1 was evicted by the v2 build, so re-requesting it rebuilds rather than
    // reusing a stale entry (without the fix this would report reused: true).
    const v1Again = build(1);
    expect(v1Again.built).toBe(true);
    expect(v1Again.reused).toBe(false);
  });
});

// Audit fix B2: Pickable.priority + Pickable.blocksLower must be honored by the
// bounds query (previously populated into the index but never consumed).
describe("Pickable priority + blocksLower (audit B2)", () => {
  it("lets a higher Pickable.priority win even when geometrically farther", () => {
    const spatial = createSpatialQueries();
    const [nearer, farther] = twoEntities();
    spatial.setBounds([
      {
        entity: nearer,
        worldAabb: { min: [-0.5, -0.5, 3], max: [0.5, 0.5, 4] },
        pickable: { priority: 0 },
      },
      {
        entity: farther,
        worldAabb: { min: [-0.5, -0.5, 1], max: [0.5, 0.5, 2] },
        pickable: { priority: 5 },
      },
    ]);

    const hit = spatial.raycastFirst({
      origin: [0, 0, 6],
      direction: [0, 0, -1],
    });
    expect(hit?.entity.entity).toBe(farther);
  });

  it("suppresses farther hits behind a Pickable.blocksLower hit", () => {
    const spatial = createSpatialQueries();
    const [front, back] = twoEntities();
    spatial.setBounds([
      {
        entity: front,
        worldAabb: { min: [-0.5, -0.5, 3], max: [0.5, 0.5, 4] },
        pickable: { blocksLower: true },
      },
      {
        entity: back,
        worldAabb: { min: [-0.5, -0.5, 1], max: [0.5, 0.5, 2] },
      },
    ]);

    const hits = spatial.raycastAll({
      origin: [0, 0, 6],
      direction: [0, 0, -1],
    });
    expect(hits.map((hit) => hit.entity.entity)).toEqual([front]);
  });

  it("preserves geometric distance order with the defaults (no-op policy)", () => {
    const spatial = createSpatialQueries();
    const [nearer, farther] = twoEntities();
    spatial.setBounds([
      {
        entity: nearer,
        worldAabb: { min: [-0.5, -0.5, 3], max: [0.5, 0.5, 4] },
      },
      {
        entity: farther,
        worldAabb: { min: [-0.5, -0.5, 1], max: [0.5, 0.5, 2] },
      },
    ]);

    const hit = spatial.raycastFirst({
      origin: [0, 0, 6],
      direction: [0, 0, -1],
    });
    expect(hit?.entity.entity).toBe(nearer);
  });
});
