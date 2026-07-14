import type {
  MeshAsset,
  PlatonicSolidMeshOptions,
  PolyhedronMeshOptions,
} from "./types.js";
import {
  boundsFromPositions,
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  normalize,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

type Vec3 = [number, number, number];

/**
 * Port of three.js `PolyhedronGeometry`: subdivide each base face `detail`
 * times, project every vertex onto a sphere of `radius`, and emit a
 * non-indexed triangle soup (sequential indices). `detail: 0` keeps flat
 * per-face normals; `detail > 0` uses smooth radial normals.
 */
export function createPolyhedronMeshAsset(
  options: PolyhedronMeshOptions,
): MeshAsset {
  const radius = positiveFinite(options.radius, 1);
  const detail = clampInteger(options.detail ?? 0, 0, 8);
  const vertexBuffer: number[] = [];

  for (let i = 0; i < options.indices.length; i += 3) {
    const a = baseVertex(options.vertices, options.indices[i] ?? 0);
    const b = baseVertex(options.vertices, options.indices[i + 1] ?? 0);
    const c = baseVertex(options.vertices, options.indices[i + 2] ?? 0);

    subdivideFace(a, b, c, detail, vertexBuffer);
  }

  applyRadius(vertexBuffer, radius);

  const uvBuffer = generateUvs(vertexBuffer);
  const normalBuffer =
    detail === 0 ? flatFaceNormals(vertexBuffer) : radialNormals(vertexBuffer);
  const vertexCount = vertexBuffer.length / 3;
  const vertices: PrimitiveVertex[] = [];
  const positions: PrimitivePosition[] = [];

  for (let i = 0; i < vertexCount; i += 1) {
    const position: PrimitivePosition = [
      vertexBuffer[i * 3] ?? 0,
      vertexBuffer[i * 3 + 1] ?? 0,
      vertexBuffer[i * 3 + 2] ?? 0,
    ];

    vertices.push({
      position,
      normal: [
        normalBuffer[i * 3] ?? 0,
        normalBuffer[i * 3 + 1] ?? 0,
        normalBuffer[i * 3 + 2] ?? 0,
      ],
      uv: [uvBuffer[i * 2] ?? 0, uvBuffer[i * 2 + 1] ?? 0],
    });
    positions.push(position);
  }

  const indices = new Uint16Array(vertexCount);

  for (let i = 0; i < vertexCount; i += 1) {
    indices[i] = i;
  }

  const bounds = boundsFromPositions(positions);

  return createPrimitiveMeshAsset({
    label: options.label ?? "Polyhedron",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount,
    indices,
    localAabb: bounds.aabb,
    // Every vertex is projected exactly onto the sphere of `radius`, so the
    // origin-centered bounding sphere is exact and tight.
    localSphere: { center: [0, 0, 0], radius },
  });
}

// Canonical vertex/index tables from three.js (Tetrahedron/Octahedron/
// Icosahedron/DodecahedronGeometry) so detail=0 reproduces each solid exactly.
const PHI = (1 + Math.sqrt(5)) / 2;
const INVERSE_PHI = 1 / PHI;

const TETRAHEDRON_VERTICES: readonly number[] = [
  1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1,
];
const TETRAHEDRON_INDICES: readonly number[] = [
  2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1,
];

const OCTAHEDRON_VERTICES: readonly number[] = [
  1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1,
];
const OCTAHEDRON_INDICES: readonly number[] = [
  0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2,
];

const ICOSAHEDRON_VERTICES: readonly number[] = [
  -1,
  PHI,
  0,
  1,
  PHI,
  0,
  -1,
  -PHI,
  0,
  1,
  -PHI,
  0,
  0,
  -1,
  PHI,
  0,
  1,
  PHI,
  0,
  -1,
  -PHI,
  0,
  1,
  -PHI,
  PHI,
  0,
  -1,
  PHI,
  0,
  1,
  -PHI,
  0,
  -1,
  -PHI,
  0,
  1,
];
const ICOSAHEDRON_INDICES: readonly number[] = [
  0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2,
  10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4,
  11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
];

const DODECAHEDRON_VERTICES: readonly number[] = [
  -1,
  -1,
  -1,
  -1,
  -1,
  1,
  -1,
  1,
  -1,
  -1,
  1,
  1,
  1,
  -1,
  -1,
  1,
  -1,
  1,
  1,
  1,
  -1,
  1,
  1,
  1,
  0,
  -INVERSE_PHI,
  -PHI,
  0,
  -INVERSE_PHI,
  PHI,
  0,
  INVERSE_PHI,
  -PHI,
  0,
  INVERSE_PHI,
  PHI,
  -INVERSE_PHI,
  -PHI,
  0,
  -INVERSE_PHI,
  PHI,
  0,
  INVERSE_PHI,
  -PHI,
  0,
  INVERSE_PHI,
  PHI,
  0,
  -PHI,
  0,
  -INVERSE_PHI,
  PHI,
  0,
  -INVERSE_PHI,
  -PHI,
  0,
  INVERSE_PHI,
  PHI,
  0,
  INVERSE_PHI,
];
const DODECAHEDRON_INDICES: readonly number[] = [
  3, 11, 7, 3, 7, 15, 3, 15, 13, 7, 19, 17, 7, 17, 6, 7, 6, 15, 17, 4, 8, 17, 8,
  10, 17, 10, 6, 8, 0, 16, 8, 16, 2, 8, 2, 10, 0, 12, 1, 0, 1, 18, 0, 18, 16, 6,
  10, 2, 6, 2, 13, 6, 13, 15, 2, 16, 18, 2, 18, 3, 2, 3, 13, 18, 1, 9, 18, 9,
  11, 18, 11, 3, 4, 14, 12, 4, 12, 0, 4, 0, 8, 11, 9, 5, 11, 5, 19, 11, 19, 7,
  19, 5, 14, 19, 14, 4, 19, 4, 17, 1, 12, 14, 1, 14, 5, 1, 5, 9,
];

export function createTetrahedronMeshAsset(
  options: PlatonicSolidMeshOptions = {},
): MeshAsset {
  return platonicSolid(
    "Tetrahedron",
    TETRAHEDRON_VERTICES,
    TETRAHEDRON_INDICES,
    options,
  );
}

export function createOctahedronMeshAsset(
  options: PlatonicSolidMeshOptions = {},
): MeshAsset {
  return platonicSolid(
    "Octahedron",
    OCTAHEDRON_VERTICES,
    OCTAHEDRON_INDICES,
    options,
  );
}

export function createIcosahedronMeshAsset(
  options: PlatonicSolidMeshOptions = {},
): MeshAsset {
  return platonicSolid(
    "Icosahedron",
    ICOSAHEDRON_VERTICES,
    ICOSAHEDRON_INDICES,
    options,
  );
}

export function createDodecahedronMeshAsset(
  options: PlatonicSolidMeshOptions = {},
): MeshAsset {
  return platonicSolid(
    "Dodecahedron",
    DODECAHEDRON_VERTICES,
    DODECAHEDRON_INDICES,
    options,
  );
}

function platonicSolid(
  label: string,
  vertices: readonly number[],
  indices: readonly number[],
  options: PlatonicSolidMeshOptions,
): MeshAsset {
  return createPolyhedronMeshAsset({
    label: options.label ?? label,
    vertices,
    indices,
    ...(options.radius === undefined ? {} : { radius: options.radius }),
    ...(options.detail === undefined ? {} : { detail: options.detail }),
  });
}

function baseVertex(vertices: readonly number[], index: number): Vec3 {
  const stride = index * 3;

  return [
    vertices[stride] ?? 0,
    vertices[stride + 1] ?? 0,
    vertices[stride + 2] ?? 0,
  ];
}

function subdivideFace(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  detail: number,
  out: number[],
): void {
  const cols = detail + 1;
  const grid: Vec3[][] = [];

  for (let i = 0; i <= cols; i += 1) {
    const column: Vec3[] = [];
    const aj = lerp(a, c, i / cols);
    const bj = lerp(b, c, i / cols);
    const rows = cols - i;

    for (let j = 0; j <= rows; j += 1) {
      if (j === 0 && i === cols) {
        column.push(aj);
      } else {
        column.push(lerp(aj, bj, j / rows));
      }
    }

    grid.push(column);
  }

  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < 2 * (cols - i) - 1; j += 1) {
      const k = Math.floor(j / 2);

      if (j % 2 === 0) {
        pushVertex(grid[i]?.[k + 1], out);
        pushVertex(grid[i + 1]?.[k], out);
        pushVertex(grid[i]?.[k], out);
      } else {
        pushVertex(grid[i]?.[k + 1], out);
        pushVertex(grid[i + 1]?.[k + 1], out);
        pushVertex(grid[i + 1]?.[k], out);
      }
    }
  }
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function pushVertex(vertex: Vec3 | undefined, out: number[]): void {
  if (vertex === undefined) {
    return;
  }

  out.push(vertex[0], vertex[1], vertex[2]);
}

function applyRadius(vertexBuffer: number[], radius: number): void {
  for (let i = 0; i < vertexBuffer.length; i += 3) {
    const x = vertexBuffer[i] ?? 0;
    const y = vertexBuffer[i + 1] ?? 0;
    const z = vertexBuffer[i + 2] ?? 0;
    const length = Math.hypot(x, y, z) || 1;
    const scale = radius / length;

    vertexBuffer[i] = x * scale;
    vertexBuffer[i + 1] = y * scale;
    vertexBuffer[i + 2] = z * scale;
  }
}

function radialNormals(vertexBuffer: number[]): number[] {
  const normals: number[] = [];

  for (let i = 0; i < vertexBuffer.length; i += 3) {
    const normal = normalize([
      vertexBuffer[i] ?? 0,
      vertexBuffer[i + 1] ?? 0,
      vertexBuffer[i + 2] ?? 0,
    ]);

    normals.push(normal[0], normal[1], normal[2]);
  }

  return normals;
}

function flatFaceNormals(vertexBuffer: number[]): number[] {
  const normals: number[] = new Array(vertexBuffer.length).fill(0);

  for (let i = 0; i < vertexBuffer.length; i += 9) {
    const ax = vertexBuffer[i] ?? 0;
    const ay = vertexBuffer[i + 1] ?? 0;
    const az = vertexBuffer[i + 2] ?? 0;
    const bx = vertexBuffer[i + 3] ?? 0;
    const by = vertexBuffer[i + 4] ?? 0;
    const bz = vertexBuffer[i + 5] ?? 0;
    const cx = vertexBuffer[i + 6] ?? 0;
    const cy = vertexBuffer[i + 7] ?? 0;
    const cz = vertexBuffer[i + 8] ?? 0;
    const normal = normalize([
      (by - ay) * (cz - az) - (bz - az) * (cy - ay),
      (bz - az) * (cx - ax) - (bx - ax) * (cz - az),
      (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
    ]);

    for (let vertex = 0; vertex < 9; vertex += 3) {
      normals[i + vertex] = normal[0];
      normals[i + vertex + 1] = normal[1];
      normals[i + vertex + 2] = normal[2];
    }
  }

  return normals;
}

function generateUvs(vertexBuffer: number[]): number[] {
  const uvBuffer: number[] = [];

  for (let i = 0; i < vertexBuffer.length; i += 3) {
    const x = vertexBuffer[i] ?? 0;
    const y = vertexBuffer[i + 1] ?? 0;
    const z = vertexBuffer[i + 2] ?? 0;
    const u = azimuth(x, z) / (2 * Math.PI) + 0.5;
    const v = inclination(x, y, z) / Math.PI + 0.5;

    uvBuffer.push(u, 1 - v);
  }

  correctUvs(vertexBuffer, uvBuffer);
  correctSeam(uvBuffer);

  return uvBuffer;
}

function correctSeam(uvBuffer: number[]): void {
  for (let i = 0; i < uvBuffer.length; i += 6) {
    const x0 = uvBuffer[i] ?? 0;
    const x1 = uvBuffer[i + 2] ?? 0;
    const x2 = uvBuffer[i + 4] ?? 0;
    const max = Math.max(x0, x1, x2);
    const min = Math.min(x0, x1, x2);

    if (max > 0.9 && min < 0.1) {
      if (x0 < 0.2) {
        uvBuffer[i] = x0 + 1;
      }
      if (x1 < 0.2) {
        uvBuffer[i + 2] = x1 + 1;
      }
      if (x2 < 0.2) {
        uvBuffer[i + 4] = x2 + 1;
      }
    }
  }
}

function correctUvs(vertexBuffer: number[], uvBuffer: number[]): void {
  for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
    const ax = vertexBuffer[i] ?? 0;
    const az = vertexBuffer[i + 2] ?? 0;
    const bx = vertexBuffer[i + 3] ?? 0;
    const bz = vertexBuffer[i + 5] ?? 0;
    const cx = vertexBuffer[i + 6] ?? 0;
    const cz = vertexBuffer[i + 8] ?? 0;
    const centroidAzimuth = azimuth((ax + bx + cx) / 3, (az + bz + cz) / 3);

    correctUv(uvBuffer, j, ax, az, centroidAzimuth);
    correctUv(uvBuffer, j + 2, bx, bz, centroidAzimuth);
    correctUv(uvBuffer, j + 4, cx, cz, centroidAzimuth);
  }
}

function correctUv(
  uvBuffer: number[],
  stride: number,
  x: number,
  z: number,
  centroidAzimuth: number,
): void {
  if (centroidAzimuth < 0 && uvBuffer[stride] === 1) {
    uvBuffer[stride] = (uvBuffer[stride] ?? 0) - 1;
  }

  if (x === 0 && z === 0) {
    uvBuffer[stride] = centroidAzimuth / (2 * Math.PI) + 0.5;
  }
}

function azimuth(x: number, z: number): number {
  return Math.atan2(z, -x);
}

function inclination(x: number, y: number, z: number): number {
  return Math.atan2(-y, Math.hypot(x, z));
}
