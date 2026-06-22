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

function withPlane(transform?: Mat4Like) {
  const e = entity();
  const mesh = planeMesh();
  const spatial = createSpatialQueries();
  spatial.setMeshes([
    {
      entity: e,
      mesh,
      bvh: createMeshBvh(mesh),
      ...(transform === undefined ? {} : { worldFromMesh: transform }),
    },
  ]);
  return { e, spatial };
}

describe("spatial overlapSphere", () => {
  it("returns nothing when no meshes are registered", () => {
    expect(createSpatialQueries().overlapSphere([0, 0, 0], 1)).toEqual([]);
  });

  it("reports a sphere that reaches the plane surface", () => {
    const { e, spatial } = withPlane();
    const hits = spatial.overlapSphere([0, 0, 0.5], 1);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.entity.entity).toBe(e);
  });

  it("excludes a sphere that does not reach the plane", () => {
    const { spatial } = withPlane();
    expect(spatial.overlapSphere([0, 0, 5], 1)).toEqual([]);
    // x=5 is 4 units from the nearest edge (x=1); radius 1 falls short.
    expect(spatial.overlapSphere([5, 0, 0], 1)).toEqual([]);
  });

  it("includes a sphere whose radius bridges the gap to the edge", () => {
    const { e, spatial } = withPlane();
    const hits = spatial.overlapSphere([5, 0, 0], 4.5);
    expect(hits.map((h) => h.entity.entity)).toEqual([e]);
  });

  it("resolves through a world-from-mesh transform", () => {
    const { e, spatial } = withPlane(translationMatrix(10, 0, 0));
    expect(
      spatial.overlapSphere([10, 0, 0.5], 1).map((h) => h.entity.entity),
    ).toEqual([e]);
    // The original (untranslated) location no longer overlaps.
    expect(spatial.overlapSphere([0, 0, 0.5], 1)).toEqual([]);
  });

  it("skips meshes without a BVH", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    spatial.setMeshes([{ entity: e, mesh }]);
    expect(spatial.overlapSphere([0, 0, 0], 5)).toEqual([]);
  });
});
