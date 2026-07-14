import { describe, expect, it } from "vitest";
import {
  createExtrudeMeshAsset,
  createLatheMeshAsset,
  createTubeMeshAsset,
  triangulateShape,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";
import {
  catmullRomCurve,
  getCurvePoint,
  type Curve,
} from "@aperture-engine/math";

const PRIMITIVE_VERTEX_STRIDE_BYTES = 32;
const FLOATS_PER_VERTEX = 8;

describe("in-house ear-clipping triangulator (G2)", () => {
  it("splits a convex square into two triangles", () => {
    const triangles = triangulateShape([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]);

    expect(triangles).toHaveLength(2);
    expectFullCoverage(triangles, 4);
  });

  it("triangulates a concave L-shape into n-2 triangles", () => {
    const l = [
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2],
    ] as const;
    const triangles = triangulateShape(l);

    // n - 2 triangles for a simple polygon of n vertices.
    expect(triangles).toHaveLength(l.length - 2);
    expectFullCoverage(triangles, l.length);
  });

  it("triangulates an outline with a hole (n + 2*holes - 2 triangles)", () => {
    const outline = [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ] as const;
    const hole = [
      [-1, -1],
      [-1, 1],
      [1, 1],
      [1, -1],
    ] as const;
    const triangles = triangulateShape(outline, [hole]);

    // 8 vertices total, 1 hole: 8 + 2*1 - 2 = 8 triangles.
    expect(triangles).toHaveLength(8);
    expectFullCoverage(triangles, outline.length + hole.length);
  });

  it("returns no triangles for a degenerate contour", () => {
    expect(
      triangulateShape([
        [0, 0],
        [1, 1],
      ]),
    ).toEqual([]);
  });
});

describe("G2 extrude / lathe / tube builders", () => {
  it("extrudes a square shape into capped, walled geometry", () => {
    const extrude = createExtrudeMeshAsset({
      shape: [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ],
      depth: 1,
    });

    // 2 cap triangles * 2 faces * 3 + 4 wall quads * 6 indices.
    // 4 cap points * 2 faces + 4 wall edges * 4 vertices.
    assertStandardPrimitive(extrude, { vertexCount: 24, indexCount: 36 });
    expect(extrude.localAabb).toEqual({
      min: [-1, -1, -0.5],
      max: [1, 1, 0.5],
    });
    // Front/back caps face +Z / -Z.
    expect(vertexNormal(extrude, 0)).toEqual([0, 0, 1]);
    expect(vertexNormal(extrude, 4)).toEqual([0, 0, -1]);
  });

  it("extrudes a shape with a hole through the in-house triangulator", () => {
    const extrude = createExtrudeMeshAsset({
      shape: [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
      ],
      holes: [
        [
          [-1, -1],
          [-1, 1],
          [1, 1],
          [1, -1],
        ],
      ],
      depth: 2,
    });

    // 8 cap triangles * 2 faces * 3 + (4 outer + 4 hole) wall quads * 6.
    // 8 cap points * 2 faces + 8 wall edges * 4 vertices.
    assertStandardPrimitive(extrude, { vertexCount: 48, indexCount: 96 });
  });

  it("extrudes a concave L-shape", () => {
    const extrude = createExtrudeMeshAsset({
      shape: [
        [0, 0],
        [2, 0],
        [2, 1],
        [1, 1],
        [1, 2],
        [0, 2],
      ],
      depth: 0.5,
    });

    // 4 cap triangles * 2 * 3 + 6 wall quads * 6; 6 points * 2 + 6 edges * 4.
    assertStandardPrimitive(extrude, { vertexCount: 36, indexCount: 60 });
  });

  it("revolves a profile into a lathe surface", () => {
    const lathe = createLatheMeshAsset({
      profile: [
        [0.6, -1],
        [1, -0.5],
        [1, 0.5],
        [0.6, 1],
      ],
      segments: 8,
    });

    // (segments + 1) * profilePoints vertices; segments * (points - 1) * 6.
    assertStandardPrimitive(lathe, { vertexCount: 36, indexCount: 144 });
    // Revolving x <= 1 about Y keeps the surface inside radius 1 in X/Z.
    expect(lathe.localAabb?.min[1]).toBeCloseTo(-1, 5);
    expect(lathe.localAabb?.max[1]).toBeCloseTo(1, 5);
  });

  it("sweeps a closed curve into a tube with a stable frame", () => {
    const curve = catmullRomCurve(
      [
        [2, 0, 0],
        [0, 0, 1.4],
        [-2, 0, 0],
        [0, 0, -1.4],
      ],
      { closed: true },
    );
    const tube = createTubeMeshAsset({
      curve,
      radius: 0.3,
      tubularSegments: 8,
      radialSegments: 6,
      closed: true,
    });

    // (tubularSegments + 1) * (radialSegments + 1) vertices;
    // tubularSegments * radialSegments * 6 indices.
    assertStandardPrimitive(tube, { vertexCount: 63, indexCount: 288 });
    expectTubeNormalsRadial(tube, curve, 0.3, 8, 6);
  });

  it("sweeps an open curve into a tube", () => {
    const curve = catmullRomCurve([
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 1],
      [3, 1, 0],
    ]);
    const tube = createTubeMeshAsset({
      curve,
      radius: 0.2,
      tubularSegments: 10,
      radialSegments: 6,
    });

    assertStandardPrimitive(tube, { vertexCount: 77, indexCount: 360 });
  });
});

function expectFullCoverage(triangles: number[][], pointCount: number): void {
  const used = new Set<number>();

  for (const triangle of triangles) {
    expect(triangle).toHaveLength(3);
    for (const index of triangle) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(pointCount);
      used.add(index);
    }
  }

  // Every contour vertex participates in the triangulation.
  expect(used.size).toBe(pointCount);
}

function expectTubeNormalsRadial(
  mesh: MeshAsset,
  curve: Curve,
  radius: number,
  tubularSegments: number,
  radialSegments: number,
): void {
  const rowStride = radialSegments + 1;

  for (let i = 0; i <= tubularSegments; i += 1) {
    const center = getCurvePoint(curve, i / tubularSegments);

    for (let j = 0; j <= radialSegments; j += 1) {
      const index = i * rowStride + j;
      const position = vertexPosition(mesh, index);
      const normal = vertexNormal(mesh, index);

      // The radial normal points straight out from the swept curve: peeling
      // `radius * normal` off the vertex lands back on the curve point.
      expect(position[0] - radius * normal[0]).toBeCloseTo(center[0], 3);
      expect(position[1] - radius * normal[1]).toBeCloseTo(center[1], 3);
      expect(position[2] - radius * normal[2]).toBeCloseTo(center[2], 3);
    }
  }
}

function streamOf(mesh: MeshAsset): NonNullable<MeshAsset["vertexStreams"][0]> {
  const stream = mesh.vertexStreams[0];

  if (stream === undefined) {
    throw new Error("Expected a primitive vertex stream.");
  }

  return stream;
}

function vertexPosition(
  mesh: MeshAsset,
  index: number,
): [number, number, number] {
  const data = streamOf(mesh).data;

  return [
    Number(data[index * FLOATS_PER_VERTEX]),
    Number(data[index * FLOATS_PER_VERTEX + 1]),
    Number(data[index * FLOATS_PER_VERTEX + 2]),
  ];
}

function vertexNormal(
  mesh: MeshAsset,
  index: number,
): [number, number, number] {
  const data = streamOf(mesh).data;

  return [
    Number(data[index * FLOATS_PER_VERTEX + 3]),
    Number(data[index * FLOATS_PER_VERTEX + 4]),
    Number(data[index * FLOATS_PER_VERTEX + 5]),
  ];
}

function assertStandardPrimitive(
  mesh: MeshAsset,
  expected: { readonly vertexCount: number; readonly indexCount: number },
): void {
  const stream = streamOf(mesh);

  expect(stream.arrayStride).toBe(PRIMITIVE_VERTEX_STRIDE_BYTES);
  expect(stream.vertexCount).toBe(expected.vertexCount);
  expect(stream.data.length).toBe(expected.vertexCount * FLOATS_PER_VERTEX);
  expect(stream.attributes.map((attribute) => attribute.semantic)).toEqual([
    "POSITION",
    "NORMAL",
    "TEXCOORD_0",
  ]);

  const indices = mesh.indexBuffer?.data;
  expect(mesh.indexBuffer?.format).toBe("uint16");
  expect(indices?.length).toBe(expected.indexCount);
  expect(Math.max(...Array.from(indices ?? []))).toBeLessThan(
    expected.vertexCount,
  );

  expectUnitNormals(mesh);
  expectBoundsEncloseAndAreTight(mesh);
  expectTriangleWindingMatchesNormals(mesh);
  expect(validateMeshAsset(mesh)).toEqual({ valid: true, diagnostics: [] });
}

function expectUnitNormals(mesh: MeshAsset): void {
  const stream = streamOf(mesh);

  for (let index = 0; index < stream.vertexCount; index += 1) {
    const [nx, ny, nz] = vertexNormal(mesh, index);

    expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 5);
  }
}

function expectBoundsEncloseAndAreTight(mesh: MeshAsset): void {
  const stream = streamOf(mesh);
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const center = mesh.localSphere?.center ?? [0, 0, 0];
  let maxDistance = 0;

  for (let index = 0; index < stream.vertexCount; index += 1) {
    const position = vertexPosition(mesh, index);

    for (let axis = 0; axis < 3; axis += 1) {
      const value = position[axis] ?? 0;
      min[axis] = Math.min(min[axis] ?? 0, value);
      max[axis] = Math.max(max[axis] ?? 0, value);
    }

    maxDistance = Math.max(
      maxDistance,
      Math.hypot(
        position[0] - (center[0] ?? 0),
        position[1] - (center[1] ?? 0),
        position[2] - (center[2] ?? 0),
      ),
    );
  }

  const aabb = mesh.localAabb;
  expect(aabb).toBeDefined();

  for (let axis = 0; axis < 3; axis += 1) {
    expect(aabb?.min[axis]).toBeCloseTo(min[axis] ?? 0, 5);
    expect(aabb?.max[axis]).toBeCloseTo(max[axis] ?? 0, 5);
  }

  const radius = mesh.localSphere?.radius ?? 0;
  expect(maxDistance).toBeLessThanOrEqual(radius + 1e-5);
  expect(radius).toBeLessThanOrEqual(maxDistance + 1e-5);
}

function expectTriangleWindingMatchesNormals(mesh: MeshAsset): void {
  const indices = mesh.indexBuffer?.data;

  if (indices === undefined) {
    throw new Error("Expected an index buffer.");
  }

  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = Number(indices[offset]);
    const b = Number(indices[offset + 1]);
    const c = Number(indices[offset + 2]);
    const pa = vertexPosition(mesh, a);
    const pb = vertexPosition(mesh, b);
    const pc = vertexPosition(mesh, c);
    const faceNormal = cross(subtract(pb, pa), subtract(pc, pa));
    const averageNormal = averageOf(
      vertexNormal(mesh, a),
      vertexNormal(mesh, b),
      vertexNormal(mesh, c),
    );

    expect(dot(faceNormal, averageNormal)).toBeGreaterThan(0);
  }
}

function subtract(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function averageOf(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): [number, number, number] {
  return [
    (a[0] + b[0] + c[0]) / 3,
    (a[1] + b[1] + c[1]) / 3,
    (a[2] + b[2] + c[2]) / 3,
  ];
}
