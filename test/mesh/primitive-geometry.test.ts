import { describe, expect, it } from "vitest";
import {
  createCircleMeshAsset,
  createDodecahedronMeshAsset,
  createIcosahedronMeshAsset,
  createOctahedronMeshAsset,
  createPolyhedronMeshAsset,
  createRingMeshAsset,
  createRoundedBoxMeshAsset,
  createTetrahedronMeshAsset,
  createTorusKnotMeshAsset,
  validateMeshAsset,
  type MeshAsset,
} from "@aperture-engine/render";

const PRIMITIVE_VERTEX_STRIDE_BYTES = 32;
const FLOATS_PER_VERTEX = 8;

describe("G1 geometry primitive builders", () => {
  it("builds a circle fan in the XY plane facing +Z with analytic bounds", () => {
    const circle = createCircleMeshAsset({ radius: 2, segments: 8 });

    assertStandardPrimitive(circle, { vertexCount: 10, indexCount: 24 });
    // Center + rim fan, all normals +Z, flat in z.
    expect(vertexNormal(circle, 0)).toEqual([0, 0, 1]);
    expect(vertexPosition(circle, 0)).toEqual([0, 0, 0]);
    expect(circle.localAabb).toEqual({ min: [-2, -2, 0], max: [2, 2, 0] });
    expect(circle.localSphere).toEqual({ center: [0, 0, 0], radius: 2 });
  });

  it("builds a ring annulus with concentric bands and analytic bounds", () => {
    const ring = createRingMeshAsset({
      innerRadius: 1,
      outerRadius: 2,
      thetaSegments: 8,
      phiSegments: 2,
    });

    assertStandardPrimitive(ring, { vertexCount: 27, indexCount: 96 });
    expect(vertexNormal(ring, 0)).toEqual([0, 0, 1]);
    expect(ring.localAabb).toEqual({ min: [-2, -2, 0], max: [2, 2, 0] });
    expect(ring.localSphere).toEqual({ center: [0, 0, 0], radius: 2 });
  });

  it("builds a (p, q) torus knot with unit tube normals and tight bounds", () => {
    const knot = createTorusKnotMeshAsset({
      radius: 1,
      tube: 0.4,
      tubularSegments: 8,
      radialSegments: 6,
      p: 2,
      q: 3,
    });

    assertStandardPrimitive(knot, { vertexCount: 63, indexCount: 288 });
  });

  it("builds platonic solids via one polyhedron builder with radial bounds", () => {
    assertStandardPrimitive(createTetrahedronMeshAsset(), {
      vertexCount: 12,
      indexCount: 12,
    });
    assertStandardPrimitive(createOctahedronMeshAsset(), {
      vertexCount: 24,
      indexCount: 24,
    });
    assertStandardPrimitive(createIcosahedronMeshAsset(), {
      vertexCount: 60,
      indexCount: 60,
    });
    assertStandardPrimitive(createDodecahedronMeshAsset(), {
      vertexCount: 108,
      indexCount: 108,
    });

    // detail=0 projects onto the exact sphere radius.
    const icosahedron = createIcosahedronMeshAsset({ radius: 3 });
    expect(icosahedron.localSphere).toEqual({
      center: [0, 0, 0],
      radius: 3,
    });
  });

  it("subdivides polyhedron faces by (detail+1)^2 triangles", () => {
    const detail0 = createTetrahedronMeshAsset({ detail: 0 });
    const detail1 = createTetrahedronMeshAsset({ detail: 1 });
    const detail2 = createTetrahedronMeshAsset({ detail: 2 });

    // 4 base faces * 3 verts each, growing by (detail+1)^2.
    expect(streamOf(detail0).vertexCount).toBe(12);
    expect(streamOf(detail1).vertexCount).toBe(12 * 4);
    expect(streamOf(detail2).vertexCount).toBe(12 * 9);
    assertStandardPrimitive(detail1, { vertexCount: 48, indexCount: 48 });

    // detail=0 is flat-shaded (per-face normal shared by the 3 face verts);
    // detail>0 uses smooth radial normals (distinct per vertex).
    expect(vertexNormal(detail0, 0)).toEqual(vertexNormal(detail0, 1));
    expect(vertexNormal(detail1, 0)).not.toEqual(vertexNormal(detail1, 5));
  });

  it("accepts a raw base solid through the generic polyhedron builder", () => {
    const polyhedron = createPolyhedronMeshAsset({
      label: "CustomTetra",
      vertices: [1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1],
      indices: [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1],
      radius: 2,
    });

    expect(polyhedron.label).toBe("CustomTetra");
    assertStandardPrimitive(polyhedron, { vertexCount: 12, indexCount: 12 });
    expect(polyhedron.localSphere).toEqual({ center: [0, 0, 0], radius: 2 });
  });

  it("builds a rounded box with rounded corners, unit normals, and tight bounds", () => {
    const rounded = createRoundedBoxMeshAsset({
      width: 2,
      height: 2,
      depth: 2,
      segments: 2,
      radius: 0.4,
    });

    assertStandardPrimitive(rounded, { vertexCount: 54, indexCount: 144 });
    // Face centers reach the full half-extent; corners stay inside it.
    expect(rounded.localAabb).toEqual({
      min: [-1, -1, -1],
      max: [1, 1, 1],
    });
  });

  it("clamps rounded-box corner radius to the shortest half-dimension", () => {
    const rounded = createRoundedBoxMeshAsset({
      width: 1,
      height: 1,
      depth: 1,
      segments: 2,
      radius: 10,
    });

    // radius clamps to 0.5 (min half-dimension), so it is effectively a sphere:
    // every vertex sits on the radius-0.5 sphere around the origin.
    for (let index = 0; index < streamOf(rounded).vertexCount; index += 1) {
      const [x, y, z] = vertexPosition(rounded, index);
      expect(Math.hypot(x, y, z)).toBeCloseTo(0.5, 5);
    }
  });
});

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
    // AABB is both enclosing (min <= actual, max >= actual) and tight (equal).
    expect(aabb?.min[axis]).toBeCloseTo(min[axis] ?? 0, 5);
    expect(aabb?.max[axis]).toBeCloseTo(max[axis] ?? 0, 5);
  }

  const radius = mesh.localSphere?.radius ?? 0;
  // Enclosing: no vertex escapes the sphere. Tight: a vertex reaches it.
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
