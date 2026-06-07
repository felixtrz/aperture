import { describe, expect, it } from "vitest";

import { createSpatialQueries } from "@aperture-engine/app/systems";
import {
  createMeshBvh,
  createWorld,
  type Entity,
  type Mat4Like,
} from "@aperture-engine/simulation";
import {
  createPlaneMeshAsset,
  createSpatialTriangleMeshFromMeshAsset,
} from "@aperture-engine/render";

// A 2x2 plane in the XY plane at z=0, spanning x,y in [-1, 1].
function planeMesh() {
  const report = createSpatialTriangleMeshFromMeshAsset(
    createPlaneMeshAsset({ width: 2, height: 2 }),
  );
  if (report.mesh === null) {
    throw new Error("Expected plane fixture to produce a spatial mesh.");
  }
  return report.mesh;
}

function entity(): Entity {
  return createWorld({ entityCapacity: 2 }).createEntity();
}

function translationMatrix(x: number, y: number, z: number): Mat4Like {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

describe("spatial closestPoint", () => {
  it("returns null when no meshes are registered", () => {
    expect(createSpatialQueries().closestPoint([0, 0, 0])).toBeNull();
  });

  it("projects an above-plane point onto the nearest surface point", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    spatial.setMeshes([{ entity: e, mesh, bvh: createMeshBvh(mesh) }]);

    const hit = spatial.closestPoint([0.25, 0.1, 3]);
    expect(hit).not.toBeNull();
    expect(hit?.entity.entity).toBe(e);
    expect(hit?.point[0]).toBeCloseTo(0.25, 5);
    expect(hit?.point[1]).toBeCloseTo(0.1, 5);
    expect(hit?.point[2]).toBeCloseTo(0, 5);
    expect(hit?.distance).toBeCloseTo(3, 5);
  });

  it("clamps to the plane edge for a point outside the extent", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    spatial.setMeshes([{ entity: e, mesh, bvh: createMeshBvh(mesh) }]);

    // x=5 is outside the [-1, 1] extent: closest is the edge at x=1.
    const hit = spatial.closestPoint([5, 0, 0]);
    expect(hit?.point[0]).toBeCloseTo(1, 5);
    expect(hit?.distance).toBeCloseTo(4, 5);
  });

  it("resolves through a world-from-mesh transform", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    // Plane translated to x=10, so it now spans x in [9, 11] at z=0.
    spatial.setMeshes([
      {
        entity: e,
        mesh,
        bvh: createMeshBvh(mesh),
        worldFromMesh: translationMatrix(10, 0, 0),
      },
    ]);

    const hit = spatial.closestPoint([10, 0, 5]);
    expect(hit?.point[0]).toBeCloseTo(10, 5);
    expect(hit?.point[2]).toBeCloseTo(0, 5);
    expect(hit?.distance).toBeCloseTo(5, 5);
  });

  it("drops results beyond maxDistance", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    spatial.setMeshes([{ entity: e, mesh, bvh: createMeshBvh(mesh) }]);

    expect(spatial.closestPoint([0, 0, 5], { maxDistance: 4 })).toBeNull();
    expect(
      spatial.closestPoint([0, 0, 5], { maxDistance: 6 })?.distance,
    ).toBeCloseTo(5, 5);
  });

  it("skips meshes without a BVH", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    spatial.setMeshes([{ entity: e, mesh }]);
    expect(spatial.closestPoint([0, 0, 1])).toBeNull();
  });
});
