import type { MeshAsset, TorusKnotMeshOptions } from "./types.js";
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

export function createTorusKnotMeshAsset(
  options: TorusKnotMeshOptions = {},
): MeshAsset {
  const radius = positiveFinite(options.radius, 1);
  const tube = positiveFinite(options.tube, 0.4);
  const tubularSegments = clampInteger(options.tubularSegments ?? 64, 3, 256);
  const radialSegments = clampInteger(options.radialSegments ?? 8, 3, 128);
  const p = clampInteger(options.p ?? 2, 1, 64);
  const q = clampInteger(options.q ?? 3, 1, 64);
  const vertices: PrimitiveVertex[] = [];
  const positions: PrimitivePosition[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i += 1) {
    const u = (i / tubularSegments) * p * Math.PI * 2;
    const point = positionOnKnotCurve(u, p, q, radius);
    const nextPoint = positionOnKnotCurve(u + 0.01, p, q, radius);
    const tangent: PrimitivePosition = [
      nextPoint[0] - point[0],
      nextPoint[1] - point[1],
      nextPoint[2] - point[2],
    ];
    const summed: PrimitivePosition = [
      nextPoint[0] + point[0],
      nextPoint[1] + point[1],
      nextPoint[2] + point[2],
    ];
    const binormal = normalize(cross(tangent, summed));
    const normal = normalize(cross(binormal, tangent));

    for (let j = 0; j <= radialSegments; j += 1) {
      const v = (j / radialSegments) * Math.PI * 2;
      const cx = -tube * Math.cos(v);
      const cy = tube * Math.sin(v);
      const position: PrimitivePosition = [
        point[0] + (cx * normal[0] + cy * binormal[0]),
        point[1] + (cx * normal[1] + cy * binormal[1]),
        point[2] + (cx * normal[2] + cy * binormal[2]),
      ];

      vertices.push({
        position,
        normal: normalize([
          position[0] - point[0],
          position[1] - point[1],
          position[2] - point[2],
        ]),
        uv: [i / tubularSegments, j / radialSegments],
      });
      positions.push(position);
    }
  }

  const rowStride = radialSegments + 1;

  for (let j = 1; j <= tubularSegments; j += 1) {
    for (let i = 1; i <= radialSegments; i += 1) {
      const a = rowStride * (j - 1) + (i - 1);
      const b = rowStride * j + (i - 1);
      const c = rowStride * j + i;
      const d = rowStride * (j - 1) + i;

      indices.push(a, b, d, b, c, d);
    }
  }

  const bounds = boundsFromPositions(positions);

  return createPrimitiveMeshAsset({
    label: options.label ?? "TorusKnot",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  });
}

function positionOnKnotCurve(
  u: number,
  p: number,
  q: number,
  radius: number,
): PrimitivePosition {
  const cu = Math.cos(u);
  const su = Math.sin(u);
  const quOverP = (q / p) * u;
  const cs = Math.cos(quOverP);

  return [
    radius * (2 + cs) * 0.5 * cu,
    radius * (2 + cs) * su * 0.5,
    radius * Math.sin(quOverP) * 0.5,
  ];
}

function cross(a: PrimitivePosition, b: PrimitivePosition): PrimitivePosition {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
