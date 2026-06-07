import { describe, expect, it } from "vitest";

import { createSpatialQueries } from "@aperture-engine/app/systems";
import {
  createMeshBvh,
  createWorld,
  type Entity,
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

function withPlane() {
  const e = entity();
  const mesh = planeMesh();
  const spatial = createSpatialQueries();
  spatial.setMeshes([{ entity: e, mesh, bvh: createMeshBvh(mesh) }]);
  return { e, spatial };
}

describe("spatial overlapBox", () => {
  it("reports a box that straddles the plane", () => {
    const { e, spatial } = withPlane();
    const hits = spatial.overlapBox([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]);
    expect(hits.map((h) => h.entity.entity)).toEqual([e]);
  });

  it("excludes a box entirely above the plane", () => {
    const { spatial } = withPlane();
    expect(spatial.overlapBox([-0.5, -0.5, 1], [0.5, 0.5, 2])).toEqual([]);
  });

  it("excludes a box outside the plane extent", () => {
    const { spatial } = withPlane();
    expect(spatial.overlapBox([3, -0.5, -0.5], [4, 0.5, 0.5])).toEqual([]);
  });

  it("returns nothing with no meshes", () => {
    expect(createSpatialQueries().overlapBox([-1, -1, -1], [1, 1, 1])).toEqual(
      [],
    );
  });
});

describe("spatial overlapCapsule", () => {
  it("reports a capsule whose segment crosses the plane", () => {
    const { e, spatial } = withPlane();
    const hits = spatial.overlapCapsule([0, 0, -1], [0, 0, 1], 0.1);
    expect(hits.map((h) => h.entity.entity)).toEqual([e]);
  });

  it("reports a capsule that only reaches the plane via its radius", () => {
    const { e, spatial } = withPlane();
    // Segment runs at z=0.5 (above the plane); radius 0.75 reaches down to z=0.
    const hits = spatial.overlapCapsule([-0.5, 0, 0.5], [0.5, 0, 0.5], 0.75);
    expect(hits.map((h) => h.entity.entity)).toEqual([e]);
  });

  it("excludes a capsule that stays clear of the plane", () => {
    const { spatial } = withPlane();
    expect(spatial.overlapCapsule([-0.5, 0, 2], [0.5, 0, 2], 0.5)).toEqual([]);
  });

  it("skips meshes without a BVH", () => {
    const e = entity();
    const mesh = planeMesh();
    const spatial = createSpatialQueries();
    spatial.setMeshes([{ entity: e, mesh }]);
    expect(spatial.overlapCapsule([0, 0, -1], [0, 0, 1], 1)).toEqual([]);
  });
});
