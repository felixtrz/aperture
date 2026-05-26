import { describe, expect, it } from "vitest";
import {
  createBoxMeshAsset,
  createPlaneMeshAsset,
  createSpatialTriangleMeshFromMeshAsset,
  type MeshAsset,
  type MeshVertexFormat,
  type MeshVertexSemantic,
} from "@aperture-engine/render";
import {
  createEntityBoundsBvh,
  createEntityBoundsBvhQueryStats,
  createMeshBvh,
  createMeshBvhCache,
  createMeshBvhCacheKey,
  createMeshBvhTraversalStats,
  createMeshTriangleQuery,
  createMeshTriangleQueryStats,
  createSpatialQueryReport,
  deserializeMeshBvh,
  raycastFirstMeshTriangle,
  raycastMeshTriangles,
  type Frustum,
  type SpatialTriangleMesh,
  type Vec3Like,
} from "@aperture-engine/simulation";

const CLOSE_TO = 5;

describe("mesh triangle spatial queries", () => {
  it("returns rich nearest and all hits for indexed meshes", () => {
    const mesh = spatialMesh(createPlaneMeshAsset({ width: 2, height: 2 }));
    const hits = raycastMeshTriangles(mesh, {
      origin: [0.25, 0.1, 1],
      direction: [0, 0, -2],
    });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      distance: 1,
      faceIndex: 0,
      submeshIndex: 0,
      materialSlot: 0,
      source: "mesh-linear",
    });
    expectVec3(hits[0]?.point, [0.25, 0.1, 0]);
    expectVec3(hits[0]?.normal, [0, 0, 1]);
    expectVec3(hits[0]?.barycentric, [0.375, 0.075, 0.55]);
    expect(hits[0]?.uv?.[0]).toBeCloseTo(0.625, CLOSE_TO);
    expect(hits[0]?.uv?.[1]).toBeCloseTo(0.55, CLOSE_TO);

    const boxHits = raycastMeshTriangles(
      spatialMesh(createBoxMeshAsset()),
      {
        origin: [0.2, 0.1, 2],
        direction: [0, 0, -1],
      },
      {
        includeBackfaces: true,
      },
    );

    expect(boxHits.map((hit) => hit.distance)).toEqual([1.5, 2.5]);
  });

  it("returns nearest and all hits for non-indexed meshes", () => {
    const mesh: SpatialTriangleMesh = {
      positions: {
        data: new Float32Array([
          -1, -1, 2, 1, -1, 2, 0, 1, 2, -1, -1, 1, 1, -1, 1, 0, 1, 1,
        ]),
        stride: 3,
      },
      vertexCount: 6,
      submeshes: [
        {
          topology: "triangle-list",
          vertexStart: 0,
          vertexCount: 6,
          materialSlot: 2,
        },
      ],
    };
    const stats = createMeshTriangleQueryStats();
    const hits = raycastMeshTriangles(
      mesh,
      { origin: [0, 0, 3], direction: [0, 0, -1] },
      { stats },
    );

    expect(stats.testedPrimitiveCount).toBe(2);
    expect(hits.map((hit) => hit.distance)).toEqual([1, 2]);
    expect(hits.map((hit) => hit.materialSlot)).toEqual([2, 2]);
    expect(
      raycastFirstMeshTriangle(mesh, {
        origin: [0, 0, 3],
        direction: [0, 0, -1],
      })?.distance,
    ).toBe(1);
  });

  it("honors backface and max-distance policy", () => {
    const mesh = spatialMesh(createPlaneMeshAsset({ width: 2, height: 2 }));

    expect(
      raycastMeshTriangles(mesh, {
        origin: [0, 0, -1],
        direction: [0, 0, 1],
      }),
    ).toEqual([]);
    expect(
      raycastMeshTriangles(
        mesh,
        { origin: [0, 0, -1], direction: [0, 0, 1] },
        { includeBackfaces: true },
      ),
    ).toHaveLength(2);
    expect(
      raycastMeshTriangles(
        mesh,
        { origin: [0.25, 0.25, 1], direction: [0, 0, -1] },
        { maxDistance: 0.5 },
      ),
    ).toEqual([]);
  });

  it("exposes a reusable triangle query and rejects invalid rays", () => {
    const mesh = spatialMesh(createPlaneMeshAsset({ width: 2, height: 2 }));
    const query = createMeshTriangleQuery(mesh);

    expect(
      query.raycast({ origin: [0, 0, 1], direction: [0, 0, -1] }),
    ).toHaveLength(2);
    expect(
      query.raycastFirst({ origin: [0, 0, 1], direction: [0, 0, -1] })?.source,
    ).toBe("mesh-linear");
    expect(query.raycast({ origin: [0, 0, 1], direction: [0, 0, 0] })).toEqual(
      [],
    );
    expect(
      query.raycast(
        { origin: [0, 0, 1], direction: [0, 0, -1] },
        { maxDistance: Number.NaN },
      ),
    ).toEqual([]);
    expect(
      query.raycastFirst({ origin: [0, 0, 1], direction: [0, 0, 0] }),
    ).toBeNull();
    expect(
      query.raycastFirst(
        { origin: [0, 0, 1], direction: [0, 0, -1] },
        { maxDistance: Number.NaN },
      ),
    ).toBeNull();
  });
});

describe("mesh BVH spatial queries", () => {
  it("matches linear first-hit results while testing fewer triangles", () => {
    const mesh = createGridMesh(24);
    const ray = { origin: [4.25, 7.25, 2], direction: [0, 0, -1] };
    const linearStats = createMeshTriangleQueryStats();
    const bvhStats = createMeshBvhTraversalStats();
    const linear = raycastFirstMeshTriangle(mesh, ray, { stats: linearStats });
    const bvh = createMeshBvh(mesh, { maxLeafSize: 2 });
    const accelerated = bvh.raycastFirst(ray, { stats: bvhStats });

    expect(accelerated).toMatchObject({
      distance: linear?.distance,
      point: linear?.point,
      faceIndex: linear?.faceIndex,
      source: "mesh-bvh",
    });
    expect(bvhStats.testedPrimitiveCount).toBeLessThan(
      linearStats.testedPrimitiveCount,
    );
    expect(bvhStats.visitedNodeCount).toBeGreaterThan(0);
    expect(bvh.stats).toMatchObject({
      nodeCount: expect.any(Number),
      leafCount: expect.any(Number),
      maxDepth: expect.any(Number),
      primitiveCount: 24 * 24 * 2,
      buildStrategy: "center",
    });
  });

  it("returns all BVH hits in the same order as linear scan", () => {
    const mesh = spatialMesh(createBoxMeshAsset());
    const ray = { origin: [0.2, 0.1, 2], direction: [0, 0, -1] };
    const linear = raycastMeshTriangles(mesh, ray, { includeBackfaces: true });
    const bvh = createMeshBvh(mesh, { maxLeafSize: 1 });
    const accelerated = bvh.raycast(ray, { includeBackfaces: true });

    expect(
      accelerated.map((hit) => [
        hit.distance,
        hit.faceIndex,
        hit.submeshIndex,
        hit.materialSlot,
      ]),
    ).toEqual(
      linear.map((hit) => [
        hit.distance,
        hit.faceIndex,
        hit.submeshIndex,
        hit.materialSlot,
      ]),
    );
  });

  it("supports first-hit mode and invalid-query early-outs", () => {
    const mesh = spatialMesh(createPlaneMeshAsset({ width: 2, height: 2 }));
    const bvh = createMeshBvh(mesh);

    expect(
      bvh.raycast(
        { origin: [0.25, 0.1, 1], direction: [0, 0, -1] },
        { firstHitOnly: true },
      ),
    ).toHaveLength(1);
    expect(bvh.raycast({ origin: [0, 0, 1], direction: [0, 0, 0] })).toEqual(
      [],
    );
    expect(
      bvh.raycastFirst(
        { origin: [0, 0, 1], direction: [0, 0, -1] },
        { maxDistance: -1 },
      ),
    ).toBeNull();
    expect(
      bvh.raycast(
        { origin: [0, 0, 1], direction: [0, 0, -1] },
        { maxDistance: Number.NaN },
      ),
    ).toEqual([]);
    expect(bvh.raycast({ origin: [20, 20, 1], direction: [0, 0, -1] })).toEqual(
      [],
    );
    expect(
      bvh.raycastFirst({ origin: [20, 20, 1], direction: [0, 0, -1] }),
    ).toBeNull();

    const empty: SpatialTriangleMesh = {
      positions: { data: new Float32Array(), stride: 3 },
      vertexCount: 0,
    };
    const emptyBvh = createMeshBvh(empty);

    expect(
      emptyBvh.raycast({ origin: [0, 0, 1], direction: [0, 0, -1] }),
    ).toEqual([]);
    expect(
      emptyBvh.raycastFirst({ origin: [0, 0, 1], direction: [0, 0, -1] }),
    ).toBeNull();
    expect(emptyBvh.visitMeshBvh({ intersectsBounds: () => true })).toBe(false);
    expect(emptyBvh.closestPointToPoint([0, 0, 0])).toBeNull();
    expect(emptyBvh.closestPointToSegment([0, 0, 0], [1, 0, 0])).toBeNull();
    expect(emptyBvh.bvhcast(emptyBvh)).toEqual([]);
    emptyBvh.refit();
  });

  it("keeps source indices stable in indirect mode and serializes typed stats", () => {
    const mesh = createGridMesh(8);
    const sourceIndices = Array.from(mesh.indices ?? []);
    const bvh = createMeshBvh(mesh, {
      strategy: "average",
      indirect: true,
      maxLeafSize: 2,
    });
    const serialized = bvh.serialize();
    const restored = deserializeMeshBvh(mesh, serialized);

    expect(Array.from(mesh.indices ?? [])).toEqual(sourceIndices);
    expect(serialized.nodeBounds).toBeInstanceOf(Float32Array);
    expect(serialized.nodeData).toBeInstanceOf(Uint32Array);
    expect(serialized.primitiveIndices).toBeInstanceOf(Uint32Array);
    expect(serialized.stats).toMatchObject({
      primitiveCount: 8 * 8 * 2,
      buildStrategy: "average",
      indirect: true,
    });
    expect(
      restored.raycastFirst({ origin: [1.25, 1.25, 1], direction: [0, 0, -1] })
        ?.faceIndex,
    ).toBe(
      bvh.raycastFirst({ origin: [1.25, 1.25, 1], direction: [0, 0, -1] })
        ?.faceIndex,
    );
  });

  it("reports SAH strategy with traversal pressure no worse than center split on an uneven fixture", () => {
    const mesh = createUnevenMesh();
    const ray = { origin: [25.25, 0.25, 1], direction: [0, 0, -1] };
    const center = createMeshBvh(mesh, { strategy: "center", maxLeafSize: 1 });
    const sah = createMeshBvh(mesh, { strategy: "sah", maxLeafSize: 1 });
    const centerStats = createMeshBvhTraversalStats();
    const sahStats = createMeshBvhTraversalStats();

    center.raycastFirst(ray, { stats: centerStats });
    sah.raycastFirst(ray, { stats: sahStats });

    expect(sah.stats.buildStrategy).toBe("sah");
    expect(sahStats.testedPrimitiveCount).toBeLessThanOrEqual(
      centerStats.testedPrimitiveCount,
    );
    expect(sahStats.visitedNodeCount).toBeLessThanOrEqual(
      centerStats.visitedNodeCount,
    );
  });

  it("supports BVH traversal, derived shape queries, closest points, BVH casts, and refit", () => {
    const mesh = spatialMesh(createPlaneMeshAsset({ width: 2, height: 2 }));
    const bvh = createMeshBvh(mesh, { maxLeafSize: 1 });
    let triangleTests = 0;

    expect(
      bvh.visitMeshBvh({
        intersectsBounds: () => "contained",
        intersectsRange: () => true,
        intersectsTriangle: () => {
          triangleTests += 1;
        },
      }),
    ).toBe(true);
    expect(triangleTests).toBe(0);
    expect(bvh.intersectsSphere({ center: [0, 0, 0], radius: 0.1 })).toBe(true);
    expect(bvh.intersectsSphere({ center: [0, 0, 0], radius: 5 })).toBe(true);
    expect(bvh.intersectsSphere({ center: [4, 0, 0], radius: 0.1 })).toBe(
      false,
    );
    expect(
      bvh.intersectsBox({ min: [-0.5, -0.5, -0.1], max: [0.5, 0.5, 0.1] }),
    ).toBe(true);
    expect(
      bvh.intersectsCapsule({
        start: [0.25, 0.25, 0.5],
        end: [0.25, 0.25, 1],
        radius: 0.55,
      }),
    ).toBe(true);
    expect(bvh.intersectsFrustum(unitFrustum())).toBe(true);
    expect(bvh.intersectsFrustum(negativeFrustum())).toBe(false);

    const closest = bvh.closestPointToPoint([0.25, 0.25, 2]);

    expect(closest?.distance).toBeCloseTo(2, CLOSE_TO);
    expectVec3(closest?.point, [0.25, 0.25, 0]);
    expect(bvh.closestPointToPoint([4, 4, 4], { maxDistance: 0.1 })).toBeNull();
    expect(bvh.closestPointToPoint([0, 0, 1], { maxDistance: -1 })).toBeNull();
    expectVec3(bvh.closestPointToPoint([-2, -2, 0])?.point, [-1, -1, 0]);
    expectVec3(bvh.closestPointToPoint([2, -1, 0])?.point, [1, -1, 0]);
    expectVec3(bvh.closestPointToPoint([1, 2, 0])?.point, [1, 1, 0]);
    expect(
      bvh.closestPointToSegment([0.25, 0.25, 2], [0.25, 0.25, 3])?.distance,
    ).toBeCloseTo(2, CLOSE_TO);
    expect(
      bvh.closestPointToSegment([4, 4, 4], [5, 5, 5], { maxDistance: 0.1 }),
    ).toBeNull();
    expect(
      bvh.closestPointToSegment([0, 0, 1], [0, 0, 2], { maxDistance: -1 }),
    ).toBeNull();
    expect(bvh.bvhcast(createMeshBvh(mesh))).not.toEqual([]);
    expect(bvh.bvhcast(createMeshBvh(mesh), { maxPairs: 0 })).toEqual([]);
    expect(
      bvh.bvhcast(
        createMeshBvh({
          positions: {
            data: new Float32Array([10, 10, 0, 11, 10, 0, 10, 11, 0]),
            stride: 3,
          },
          vertexCount: 3,
        }),
      ),
    ).toEqual([]);

    const mutableMesh: SpatialTriangleMesh = {
      positions: {
        data: new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0]),
        stride: 3,
      },
      vertexCount: 3,
    };
    const refitBvh = createMeshBvh(mutableMesh);

    (mutableMesh.positions.data as Float32Array)[2] = 5;
    (mutableMesh.positions.data as Float32Array)[5] = 5;
    (mutableMesh.positions.data as Float32Array)[8] = 5;
    refitBvh.refit();

    expect(refitBvh.intersectsSphere({ center: [0, 0, 0], radius: 0.1 })).toBe(
      false,
    );
    expect(refitBvh.intersectsSphere({ center: [0, 0, 5], radius: 0.1 })).toBe(
      true,
    );
  });

  it("covers boolean BVH traversal callbacks, transformed boxes, and capped BVH casts", () => {
    const mesh = spatialMesh(createPlaneMeshAsset({ width: 2, height: 2 }));
    const bvh = createMeshBvh(mesh, { maxLeafSize: 1 });
    let triangleVisits = 0;

    expect(
      bvh.visitMeshBvh({
        intersectsBounds: () => true,
        boundsTraverseOrder: (bounds) => bounds.min[0],
        intersectsRange: () => false,
        intersectsTriangle: () => {
          triangleVisits += 1;
          return false;
        },
      }),
    ).toBe(false);
    expect(triangleVisits).toBeGreaterThan(0);
    expect(
      bvh.visitMeshBvh({
        intersectsBounds: () => true,
      }),
    ).toBe(true);
    expect(
      bvh.visitMeshBvh({
        intersectsBounds: () => true,
        boundsTraverseOrder: (bounds) => -bounds.min[0],
        intersectsTriangle: () => false,
      }),
    ).toBe(false);
    expect(
      bvh.visitMeshBvh({
        intersectsBounds: () => true,
        intersectsTriangle: () => {
          triangleVisits += 1;
          return true;
        },
      }),
    ).toBe(true);
    expect(triangleVisits).toBeGreaterThan(0);

    expect(
      bvh.intersectsBox(
        { min: [9, 9, -0.1], max: [10, 10, 0.1] },
        translationMatrix([-9.5, -9.5, 0]),
      ),
    ).toBe(true);
    expect(bvh.bvhcast(createMeshBvh(mesh), { maxPairs: 1 })).toHaveLength(1);
  });

  it("caches versioned BVHs, refits changed vertices, and reports diagnostics", () => {
    const mesh = createGridMesh(4);
    const cache = createMeshBvhCache();
    const cacheKey = createMeshBvhCacheKey({
      meshKey: "mesh://fixture/grid",
      version: 1,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
    });
    const first = cache.getOrBuild({
      meshKey: "mesh://fixture/grid",
      version: 1,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
    });
    const reused = cache.getOrBuild({
      meshKey: "mesh://fixture/grid",
      version: 1,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
    });
    const refit = cache.getOrBuild({
      meshKey: "mesh://fixture/grid",
      version: 2,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
      dynamicPolicy: "refit",
    });
    const unsupported = cache.getOrBuild({
      meshKey: "mesh://fixture/lines",
      version: 1,
      mesh,
      unsupportedTopology: true,
      unsupportedSkinned: true,
      unsupportedMorphed: true,
    });
    const rebuilt = cache.getOrBuild({
      meshKey: "mesh://fixture/grid",
      version: 3,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
      dynamicPolicy: "rebuild",
    });
    cache.invalidate("mesh://fixture/grid");
    const afterInvalidate = cache.getOrBuild({
      meshKey: "mesh://fixture/grid",
      version: 3,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
    });
    const afterInvalidateOldVersion = cache.getOrBuild({
      meshKey: "mesh://fixture/grid",
      version: 1,
      primitiveRangesKey: "submesh:0",
      mesh,
      options: { strategy: "center", maxLeafSize: 2 },
    });
    const failed = cache.getOrBuild({
      meshKey: "mesh://fixture/broken",
      version: 1,
      mesh: brokenMesh(),
    });
    expect(first).toMatchObject({
      cacheKey,
      built: true,
      reused: false,
      refit: false,
      diagnostics: [],
    });
    expect(reused).toMatchObject({
      cacheKey,
      built: false,
      reused: true,
      refit: false,
    });
    expect(refit).toMatchObject({
      built: false,
      reused: false,
      refit: true,
      diagnostics: [
        expect.objectContaining({ code: "spatial.mesh-bvh.stale" }),
      ],
    });
    expect(unsupported).toMatchObject({
      bvh: null,
      built: false,
      diagnostics: expect.arrayContaining([
        expect.objectContaining({
          code: "spatial.mesh-bvh.unsupported-topology",
          severity: "error",
        }),
        expect.objectContaining({
          code: "spatial.mesh-bvh.unsupported-skinned",
          severity: "warning",
        }),
        expect.objectContaining({
          code: "spatial.mesh-bvh.unsupported-morphed",
          severity: "warning",
        }),
      ]),
    });
    expect(rebuilt).toMatchObject({
      built: true,
      reused: false,
      refit: false,
      diagnostics: [
        expect.objectContaining({ code: "spatial.mesh-bvh.stale" }),
      ],
    });
    expect(afterInvalidate).toMatchObject({
      built: true,
      reused: false,
      diagnostics: [],
    });
    expect(afterInvalidateOldVersion).toMatchObject({
      built: true,
      reused: false,
    });
    expect(failed).toMatchObject({
      bvh: null,
      built: false,
      diagnostics: [
        expect.objectContaining({ code: "spatial.mesh-bvh.build-failed" }),
      ],
    });
  });
});

describe("entity bounds BVH spatial queries", () => {
  it("raycasts many entity bounds without testing every entity", () => {
    const bounds = Array.from({ length: 512 }, (_, index) => ({
      entity: `entity-${index}`,
      worldAabb: {
        min: [index * 2, 0, 0] as Vec3Like,
        max: [index * 2 + 1, 1, 1] as Vec3Like,
      },
    }));
    const bvh = createEntityBoundsBvh(bounds, { maxLeafSize: 4 });
    const stats = createEntityBoundsBvhQueryStats();
    const hits = bvh.raycast([200.5, 0.5, -1], [0, 0, 1], { stats });

    expect(hits.map((hit) => hit.entity)).toEqual(["entity-100"]);
    expect(stats.candidateEntityCount).toBe(512);
    expect(stats.testedEntityCount).toBeLessThan(512);
    expect(stats.visitedNodeCount).toBeGreaterThan(0);
  });

  it("refits dirty entity bounds without rebuilding the tree", () => {
    const bvh = createEntityBoundsBvh([
      {
        entity: "moving",
        worldAabb: { min: [0, 0, 0], max: [1, 1, 1] },
      },
      {
        entity: "stable",
        worldAabb: { min: [10, 0, 0], max: [11, 1, 1] },
      },
    ]);

    expect(
      bvh.raycast([0.5, 0.5, -1], [0, 0, 1]).map((hit) => hit.entity),
    ).toEqual(["moving"]);
    expect(
      bvh.updateBounds("moving", {
        worldAabb: { min: [20, 0, 0], max: [21, 1, 1] },
      }),
    ).toBe(true);
    expect(bvh.raycast([0.5, 0.5, -1], [0, 0, 1])).toEqual([]);
    expect(
      bvh.raycast([20.5, 0.5, -1], [0, 0, 1]).map((hit) => hit.entity),
    ).toEqual(["moving"]);
    expect(bvh.count).toBe(2);
    expect(
      bvh.updateBounds("missing", {
        worldAabb: { min: [0, 0, 0], max: [1, 1, 1] },
      }),
    ).toBe(false);
  });

  it("handles layers, spheres, invalid rays, and y-axis splits", () => {
    const bvh = createEntityBoundsBvh(
      [
        {
          entity: "near",
          worldAabb: { min: [0, 0, 0], max: [1, 1, 1] },
          worldSphere: { center: [20, 20, 20], radius: 0.5 },
          layerMask: 0b0010,
        },
        {
          entity: "far",
          worldAabb: { min: [0, 10, 0], max: [1, 11, 1] },
          layerMask: 0b0100,
        },
      ],
      { maxLeafSize: 1 },
    );
    const stats = createEntityBoundsBvhQueryStats();

    expect(
      bvh.raycast([0.5, 0.5, -1], [0, 0, 1], { layerMask: 0b0001 }),
    ).toEqual([]);
    expect(
      bvh.raycast([0.5, 0.5, -1], [0, 0, 1], {
        layerMask: 0b0010,
        stats,
      }),
    ).toEqual([]);
    expect(stats.candidateEntityCount).toBe(2);
    expect(
      bvh
        .raycast([0.5, 10.5, -1], [0, 0, 1], { layerMask: 0b0100 })
        .map((hit) => hit.entity),
    ).toEqual(["far"]);
    expect(bvh.raycast([0, 0, 0], [0, 0, 0])).toEqual([]);
    expect(bvh.raycast([0, 0, 0], [0, 0, 1], { maxDistance: -1 })).toEqual([]);
    expect(createEntityBoundsBvh([]).raycast([0, 0, 0], [0, 0, 1])).toEqual([]);
  });
});

describe("mesh spatial adapter diagnostics", () => {
  it("reports adapter errors and warnings for unsupported mesh asset data", () => {
    expect(
      createSpatialTriangleMeshFromMeshAsset({
        ...createPlaneMeshAsset({ label: "missing-position" }),
        vertexStreams: [],
      }).diagnostics,
    ).toEqual([
      expect.objectContaining({ code: "spatial.mesh.missing-position" }),
    ]);
    expect(
      createSpatialTriangleMeshFromMeshAsset(
        withAttributeFormat("POSITION", "float32x2"),
      ).diagnostics,
    ).toEqual([
      expect.objectContaining({
        code: "spatial.mesh.unsupported-position-format",
      }),
    ]);
    expect(
      createSpatialTriangleMeshFromMeshAsset(
        withAttributeFormat("NORMAL", "float32x4"),
      ).diagnostics,
    ).toEqual([
      expect.objectContaining({
        code: "spatial.mesh.unsupported-normal-format",
      }),
    ]);
    expect(
      createSpatialTriangleMeshFromMeshAsset(
        withAttributeFormat("TEXCOORD_0", "float32x3"),
      ).diagnostics,
    ).toEqual([
      expect.objectContaining({ code: "spatial.mesh.unsupported-uv-format" }),
    ]);
    expect(
      createSpatialTriangleMeshFromMeshAsset(withLineTopology()).diagnostics,
    ).toEqual([
      expect.objectContaining({ code: "spatial.mesh.unsupported-topology" }),
    ]);
    expect(
      createSpatialTriangleMeshFromMeshAsset({
        ...createPlaneMeshAsset({ label: "bad-index" }),
        indexBuffer: {
          format: "uint8" as never,
          data: new Uint16Array([0, 1, 2]),
        },
      }).diagnostics,
    ).toEqual([
      expect.objectContaining({
        code: "spatial.mesh.unsupported-index-format",
      }),
    ]);
    expect(
      createSpatialTriangleMeshFromMeshAsset(nonIndexedPlane()).mesh?.indices,
    ).toBeUndefined();
    expect(
      createSpatialTriangleMeshFromMeshAsset(positionOnlyMesh()).diagnostics,
    ).toEqual([]);
  });
});

describe("spatial query reports", () => {
  it("clones diagnostics into JSON-safe report shapes", () => {
    const report = createSpatialQueryReport({
      queryId: "query-1",
      source: "mesh-bvh",
      fallback: "none",
      candidateEntityCount: 3,
      testedEntityCount: 2,
      testedPrimitiveCount: 1,
      visitedNodeCount: 4,
      hitCount: 1,
      firstHitDistance: 2,
      diagnostics: [
        {
          code: "spatial.mesh-bvh.missing",
          severity: "warning",
          message: "missing",
        },
      ],
    });

    expect(report).toMatchObject({
      queryId: "query-1",
      diagnostics: [expect.objectContaining({ message: "missing" })],
    });
    expect(report.diagnostics[0]).not.toBe(
      createSpatialQueryReport({
        ...report,
      }).diagnostics[0],
    );
  });
});

function spatialMesh(
  mesh: Parameters<typeof createSpatialTriangleMeshFromMeshAsset>[0],
): SpatialTriangleMesh {
  const report = createSpatialTriangleMeshFromMeshAsset(mesh);

  expect(report.diagnostics).toEqual([]);
  expect(report.mesh).not.toBeNull();

  return report.mesh as SpatialTriangleMesh;
}

function createGridMesh(size: number): SpatialTriangleMesh {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const vertex = positions.length / 3;

      positions.push(x, y, 0, x + 1, y, 0, x + 1, y + 1, 0, x, y + 1, 0);
      indices.push(
        vertex,
        vertex + 1,
        vertex + 2,
        vertex,
        vertex + 2,
        vertex + 3,
      );
    }
  }

  return {
    positions: { data: new Float32Array(positions), stride: 3 },
    indices: new Uint32Array(indices),
    vertexCount: positions.length / 3,
    submeshes: [
      {
        topology: "triangle-list",
        vertexStart: 0,
        vertexCount: positions.length / 3,
        indexStart: 0,
        indexCount: indices.length,
      },
    ],
  };
}

function createUnevenMesh(): SpatialTriangleMesh {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let index = 0; index < 32; index += 1) {
    const x = index < 28 ? index * 0.05 : 20 + index;
    const vertex = positions.length / 3;

    positions.push(x, 0, 0, x + 0.25, 0, 0, x, 0.25, 0);
    indices.push(vertex, vertex + 1, vertex + 2);
  }

  return {
    positions: { data: new Float32Array(positions), stride: 3 },
    indices: new Uint32Array(indices),
    vertexCount: positions.length / 3,
    submeshes: [
      {
        topology: "triangle-list",
        vertexStart: 0,
        vertexCount: positions.length / 3,
        indexStart: 0,
        indexCount: indices.length,
      },
    ],
  };
}

function unitFrustum(): Frustum {
  return {
    planes: [
      { normal: [1, 0, 0], constant: 1 },
      { normal: [-1, 0, 0], constant: 1 },
      { normal: [0, 1, 0], constant: 1 },
      { normal: [0, -1, 0], constant: 1 },
      { normal: [0, 0, 1], constant: 1 },
      { normal: [0, 0, -1], constant: 1 },
    ],
  };
}

function negativeFrustum(): Frustum {
  return {
    planes: [
      { normal: [1, 0, 0], constant: -10 },
      { normal: [-1, 0, 0], constant: -10 },
      { normal: [0, 1, 0], constant: -10 },
      { normal: [0, -1, 0], constant: -10 },
      { normal: [0, 0, 1], constant: -10 },
      { normal: [0, 0, -1], constant: -10 },
    ],
  };
}

function translationMatrix(translation: Vec3Like): Float32Array {
  return new Float32Array([
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0,
    1,
    0,
    translation[0],
    translation[1],
    translation[2],
    1,
  ]);
}

function brokenMesh(): SpatialTriangleMesh {
  return {
    positions: { data: new Float32Array([0, 0, 0]), stride: 3 },
    vertexCount: 3,
  };
}

function withAttributeFormat(
  semantic: MeshVertexSemantic,
  format: MeshVertexFormat,
): MeshAsset {
  const mesh = createPlaneMeshAsset({ label: `${semantic}-${format}` });

  return {
    ...mesh,
    vertexStreams: mesh.vertexStreams.map((stream) => ({
      ...stream,
      attributes: stream.attributes.map((attribute) =>
        attribute.semantic === semantic ? { ...attribute, format } : attribute,
      ),
    })),
  };
}

function positionOnlyMesh(): MeshAsset {
  const mesh = nonIndexedPlane("position-only");

  return {
    ...mesh,
    vertexStreams: mesh.vertexStreams.map((stream) => ({
      ...stream,
      attributes: stream.attributes.filter(
        (attribute) => attribute.semantic === "POSITION",
      ),
    })),
  };
}

function nonIndexedPlane(label = "non-indexed"): MeshAsset {
  const { indexBuffer: _indexBuffer, ...mesh } = createPlaneMeshAsset({
    label,
  });

  return mesh;
}

function withLineTopology(): MeshAsset {
  const mesh = createPlaneMeshAsset({ label: "lines" });
  const submesh = mesh.submeshes[0];

  if (submesh === undefined) {
    throw new Error("Plane fixture is missing its default submesh.");
  }

  return {
    ...mesh,
    submeshes: [
      {
        ...submesh,
        label: "line-submesh",
        topology: "line-list",
      },
    ],
  };
}

function expectVec3(actual: Vec3Like | undefined, expected: Vec3Like): void {
  expect(actual).toBeDefined();

  if (actual === undefined) {
    return;
  }

  expect(actual[0]).toBeCloseTo(expected[0], CLOSE_TO);
  expect(actual[1]).toBeCloseTo(expected[1], CLOSE_TO);
  expect(actual[2]).toBeCloseTo(expected[2], CLOSE_TO);
}
