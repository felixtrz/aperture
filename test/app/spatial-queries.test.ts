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

function entityPair(): readonly [Entity, Entity] {
  const world = createWorld({ entityCapacity: 4 });
  return [world.createEntity(), world.createEntity()];
}

function queryPlane() {
  const report = createSpatialTriangleMeshFromMeshAsset(
    createPlaneMeshAsset({ width: 2, height: 2 }),
  );

  if (report.mesh === null) {
    throw new Error("Expected plane fixture to produce a spatial mesh.");
  }

  return report.mesh;
}

function identityMatrix(): Mat4Like {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function zeroMatrix(): Mat4Like {
  return new Float32Array(16);
}

function translationMatrix(x: number, y: number, z: number): Mat4Like {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

describe("spatial query facade", () => {
  it("keeps bounds and collider fallback queries synchronous", () => {
    const [near, far] = entityPair();
    const spatial = createSpatialQueries();

    spatial.setBounds([
      {
        entity: far,
        worldAabb: { min: [0, 0, 4], max: [1, 1, 5] },
        layerMask: 0b0010,
      },
      {
        entity: near,
        worldAabb: { min: [0, 0, 1], max: [1, 1, 2] },
        layerMask: 0b0010,
      },
    ]);

    expect(
      spatial.raycastFirst({
        origin: [0.5, 0.5, 0],
        direction: [0, 0, 1],
      })?.entity.entity,
    ).toBe(near);
    expect(
      spatial.raycastAll({
        origin: [0.5, 0.5, 0],
        direction: [0, 0, 1],
      }),
    ).toHaveLength(2);
    expect(
      spatial.raycastFirst({
        origin: [2, 2, 0],
        direction: [0, 0, 1],
      }),
    ).toBeNull();
    expect(
      spatial
        .raycastAll(
          { origin: [0.5, 0.5, 0], direction: [0, 0, 1] },
          { source: "bounds", layerMask: 0b0010 },
        )
        .map((hit) => hit.entity.entity),
    ).toEqual([near, far]);
    expect(
      spatial.raycastFirst(
        { origin: [0.5, 0.5, 0], direction: [0, 0, 1] },
        { source: "collider" },
      ),
    ).toBeNull();
    expect(
      spatial.raycastAll(
        { origin: [0.5, 0.5, 0], direction: [0, 0, 1] },
        { source: "collider" },
      ),
    ).toEqual([]);
    expect(
      spatial.raycastFirst(
        { origin: [0.5, 0.5, 0], direction: [0, 0, 1] },
        { source: "collider", fallback: "bounds" },
      )?.source,
    ).toBe("bounds");
    expect(
      spatial.raycastAll(
        { origin: [0.5, 0.5, 0], direction: [0, 0, 1] },
        { source: "collider", fallback: "bounds" },
      ),
    ).toHaveLength(2);

    spatial.setBounds([
      {
        entity: near,
        worldAabb: { min: [0, 0, 1], max: [1, 1, 2] },
        pickable: { enabled: false },
      },
    ]);
    expect(
      spatial.raycastFirst({
        origin: [0.5, 0.5, 0],
        direction: [0, 0, 1],
      }),
    ).toBeNull();
  });

  it("uses explicit visual-mesh source and bounds fallback policy", () => {
    const [entity] = entityPair();
    const mesh = queryPlane();
    const spatial = createSpatialQueries();

    spatial.setBounds([
      {
        entity,
        worldAabb: { min: [-1, -1, 0], max: [1, 1, 0] },
        layerMask: 0b0100,
      },
    ]);
    spatial.setMeshes([
      {
        entity,
        mesh,
        bvh: createMeshBvh(mesh),
        layerMask: 0b0100,
        pickable: { enabled: true, precision: "bounds", layerMask: 0b0100 },
      },
    ]);

    const ray = { origin: [0.25, 0.1, 1], direction: [0, 0, -1] };

    expect(
      spatial.raycastFirst(ray, { source: "visual-mesh", layerMask: 0b0100 }),
    ).toBeNull();
    expect(
      spatial.raycastFirst(ray, {
        source: "visual-mesh",
        fallback: "bounds",
        layerMask: 0b0100,
      })?.source,
    ).toBe("bounds");
    expect(
      spatial
        .raycastAll(ray, {
          source: "visual-mesh",
          fallback: "bounds",
          layerMask: 0b0100,
        })
        .map((hit) => hit.source),
    ).toEqual(["bounds"]);

    spatial.setMeshes([
      {
        entity,
        mesh,
        bvh: createMeshBvh(mesh),
        layerMask: 0b0100,
        pickable: {
          enabled: true,
          precision: "visual-mesh",
          layerMask: 0b0100,
        },
      },
    ]);

    expect(
      spatial.raycastFirst(
        { origin: [4, 4, 1], direction: [0, 0, -1] },
        { source: "visual-mesh", fallback: "bounds", layerMask: 0b0100 },
      ),
    ).toBeNull();
    expect(
      spatial.raycastAll(
        { origin: [4, 4, 1], direction: [0, 0, -1] },
        { source: "visual-mesh", fallback: "bounds", layerMask: 0b0100 },
      ),
    ).toEqual([]);
  });

  it("supports linear exact mesh queries and transformed result normalization", () => {
    const [entity] = entityPair();
    const mesh = queryPlane();
    const spatial = createSpatialQueries();
    const ray = { origin: [0.25, 0.1, 1], direction: [0, 0, -1] };

    spatial.setMeshes([
      {
        entity,
        mesh,
        meshFromWorld: identityMatrix(),
        worldFromMesh: zeroMatrix(),
        layerMask: 0b1000,
        pickable: {
          enabled: true,
          precision: "visual-mesh",
          layerMask: 0b1000,
        },
      },
    ]);

    const [hit] = spatial.raycastAll(ray, {
      source: "visual-mesh",
      layerMask: 0b1000,
      includeUv: true,
      includeNormal: true,
    });

    expect(hit).toMatchObject({
      source: "mesh-linear",
      normal: [0, 0, 0],
      point: [0, 0, 0],
      uv: expect.any(Array),
    });
    expect(
      spatial.raycastFirst(ray, {
        source: "visual-mesh",
        layerMask: 0b1000,
        maxDistance: 0.5,
      }),
    ).toBeNull();
    expect(
      spatial.raycastAll(ray, {
        source: "visual-mesh",
        layerMask: 0b1000,
        maxDistance: 0.5,
      }),
    ).toEqual([]);
  });

  it("orders exact mesh hits deterministically across BVH and linear entries", () => {
    const [first, second] = entityPair();
    const mesh = queryPlane();
    const spatial = createSpatialQueries();
    const ray = { origin: [0.2, 0.2, 1], direction: [0, 0, -1] };

    spatial.setMeshes([
      {
        entity: second,
        mesh,
        bvh: createMeshBvh(mesh),
        pickable: { precision: "visual-mesh" },
      },
      {
        entity: first,
        mesh,
        pickable: { precision: "visual-mesh" },
      },
    ]);

    expect(
      spatial.raycastFirst(ray, { source: "visual-mesh" })?.entity.entity,
    ).toBe(first);
    expect(
      spatial.raycastFirst(ray, {
        source: "visual-mesh",
        maxDistance: 2,
        includeBackfaces: true,
        includeUv: false,
      })?.uv,
    ).toBeUndefined();
    expect(
      spatial
        .raycastAll(ray, { source: "visual-mesh" })
        .map((hit) => [hit.entity.ref.index, hit.source]),
    ).toEqual([
      [first.index, "mesh-linear"],
      [first.index, "mesh-linear"],
      [second.index, "mesh-bvh"],
      [second.index, "mesh-bvh"],
    ]);

    spatial.setMeshes([
      {
        entity: second,
        mesh,
        bvh: createMeshBvh(mesh),
        pickable: { precision: "visual-mesh" },
      },
      {
        entity: first,
        mesh,
        pickable: { precision: "visual-mesh" },
      },
      {
        entity: second,
        mesh,
        worldFromMesh: translationMatrix(0, 0, -1),
        pickable: { precision: "visual-mesh" },
      },
    ]);

    expect(
      spatial.raycastFirst(ray, { source: "visual-mesh" })?.entity.entity,
    ).toBe(first);
  });

  it("skips non-query entities and non-invertible mesh transforms", () => {
    const [entity, other] = entityPair();
    const mesh = queryPlane();
    const spatial = createSpatialQueries();
    const ray = { origin: [0.2, 0.2, 1], direction: [0, 0, -1] };

    spatial.setBounds([
      {
        entity,
        worldAabb: { min: [-1, -1, -0.01], max: [1, 1, 0.01] },
      },
    ]);
    spatial.setMeshes([
      {
        entity,
        mesh,
        worldFromMesh: zeroMatrix(),
        pickable: { precision: "visual-mesh" },
      },
    ]);

    expect(
      spatial.raycastFirst(ray, {
        source: "visual-mesh",
        query: { entities: new Set([other]) },
      }),
    ).toBeNull();
    expect(
      spatial.raycastAll(ray, {
        source: "visual-mesh",
        query: { entities: new Set([other]) },
      }),
    ).toEqual([]);
    expect(
      spatial.raycastFirst(ray, {
        source: "visual-mesh",
        fallback: "bounds",
      })?.source,
    ).toBe("bounds");
    expect(
      spatial
        .raycastAll(ray, {
          source: "visual-mesh",
          fallback: "bounds",
        })
        .map((hit) => hit.source),
    ).toEqual(["bounds"]);
  });
});
