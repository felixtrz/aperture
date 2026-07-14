import {
  getCurvePoint,
  getCurveTangent,
  vec3,
  type Vec3,
} from "@aperture-engine/simulation";
import type { MeshAsset, TubeMeshOptions } from "./types.js";
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

const FRAME_EPSILON = 1e-6;

/**
 * Tube (three.js `TubeGeometry`): sweep a circle of `radius` along a math
 * {@link import("@aperture-engine/simulation").Curve} using a stable
 * parallel-transport (rotation-minimizing) frame rather than a raw Frenet
 * frame, so the cross-section never flips at inflection points or spins with
 * torsion. Emits `(tubularSegments + 1) x (radialSegments + 1)` vertices with
 * radially-outward normals; `closed` applies the frame's seam twist correction.
 */
export function createTubeMeshAsset(options: TubeMeshOptions): MeshAsset {
  const curve = options.curve;
  const radius = positiveFinite(options.radius, 1);
  const tubularSegments = clampInteger(options.tubularSegments ?? 64, 3, 512);
  const radialSegments = clampInteger(options.radialSegments ?? 8, 3, 256);
  const closed = options.closed ?? false;

  const frames = computeParallelTransportFrames(curve, tubularSegments, closed);
  const vertices: PrimitiveVertex[] = [];
  const positions: PrimitivePosition[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegments; i += 1) {
    const center = frames.points[i] as PrimitivePosition;
    const normalAxis = frames.normals[i] as PrimitivePosition;
    const binormalAxis = frames.binormals[i] as PrimitivePosition;

    for (let j = 0; j <= radialSegments; j += 1) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const normal: PrimitivePosition = normalize([
        cos * normalAxis[0] + sin * binormalAxis[0],
        cos * normalAxis[1] + sin * binormalAxis[1],
        cos * normalAxis[2] + sin * binormalAxis[2],
      ]);
      const position: PrimitivePosition = [
        center[0] + radius * normal[0],
        center[1] + radius * normal[1],
        center[2] + radius * normal[2],
      ];

      vertices.push({
        position,
        normal,
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
    label: options.label ?? "Tube",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  });
}

interface CurveFrames {
  readonly points: PrimitivePosition[];
  readonly normals: PrimitivePosition[];
  readonly binormals: PrimitivePosition[];
}

// Rotation-minimizing frames along the curve (three.js `computeFrenetFrames`):
// an initial normal is transported by rotating it about `cross(T[i-1], T[i])`,
// so it never depends on the curve's second derivative (which flips a Frenet
// frame at inflection points). A closed curve distributes the residual twist
// between the last and first normal evenly across the segments.
function computeParallelTransportFrames(
  curve: TubeMeshOptions["curve"],
  tubularSegments: number,
  closed: boolean,
): CurveFrames {
  const points: PrimitivePosition[] = [];
  const tangents: PrimitivePosition[] = [];
  const scratch: Vec3 = vec3();

  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments;

    getCurvePoint(curve, t, scratch);
    points.push([scratch[0], scratch[1], scratch[2]]);
    getCurveTangent(curve, t, scratch);
    tangents.push(normalize([scratch[0], scratch[1], scratch[2]]));
  }

  const normals: PrimitivePosition[] = new Array(tangents.length);
  const binormals: PrimitivePosition[] = new Array(tangents.length);

  const firstTangent = tangents[0] as PrimitivePosition;
  const seed = seedNormalAxis(firstTangent);
  const initialBinormal = normalize(cross(firstTangent, seed));

  normals[0] = normalize(cross(initialBinormal, firstTangent));
  binormals[0] = normalize(cross(firstTangent, normals[0]));

  for (let i = 1; i < tangents.length; i += 1) {
    const previousNormal = normals[i - 1] as PrimitivePosition;
    const previousTangent = tangents[i - 1] as PrimitivePosition;
    const tangent = tangents[i] as PrimitivePosition;
    let normal = previousNormal;
    const rotationAxis = cross(previousTangent, tangent);
    const axisLength = Math.hypot(
      rotationAxis[0],
      rotationAxis[1],
      rotationAxis[2],
    );

    if (axisLength > FRAME_EPSILON) {
      const axis = normalize(rotationAxis);
      const angle = Math.acos(clampUnit(dot(previousTangent, tangent)));
      normal = rotateAboutAxis(previousNormal, axis, angle);
    }

    normals[i] = normal;
    binormals[i] = normalize(cross(tangent, normal));
  }

  if (closed) {
    applyClosedTwist(tangents, normals, binormals, tubularSegments);
  }

  return { points, normals, binormals };
}

function applyClosedTwist(
  tangents: readonly PrimitivePosition[],
  normals: PrimitivePosition[],
  binormals: PrimitivePosition[],
  tubularSegments: number,
): void {
  const first = normals[0] as PrimitivePosition;
  const last = normals[tubularSegments] as PrimitivePosition;
  let angle = Math.acos(clampUnit(dot(first, last))) / tubularSegments;

  if (dot(tangents[0] as PrimitivePosition, cross(first, last)) > 0) {
    angle = -angle;
  }

  for (let i = 1; i <= tubularSegments; i += 1) {
    const tangent = tangents[i] as PrimitivePosition;
    const normal = rotateAboutAxis(
      normals[i] as PrimitivePosition,
      tangent,
      angle * i,
    );

    normals[i] = normal;
    binormals[i] = normalize(cross(tangent, normal));
  }
}

// Picks the world axis least aligned with `tangent` (smallest absolute
// component) as a seed so the initial normal is well-conditioned.
function seedNormalAxis(tangent: PrimitivePosition): PrimitivePosition {
  const ax = Math.abs(tangent[0]);
  const ay = Math.abs(tangent[1]);
  const az = Math.abs(tangent[2]);

  if (ax <= ay && ax <= az) {
    return [1, 0, 0];
  }

  return ay <= az ? [0, 1, 0] : [0, 0, 1];
}

function rotateAboutAxis(
  value: PrimitivePosition,
  axis: PrimitivePosition,
  angle: number,
): PrimitivePosition {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const oneMinusCos = 1 - cos;
  const axisDot = dot(axis, value);
  const crossed = cross(axis, value);

  return [
    value[0] * cos + crossed[0] * sin + axis[0] * axisDot * oneMinusCos,
    value[1] * cos + crossed[1] * sin + axis[1] * axisDot * oneMinusCos,
    value[2] * cos + crossed[2] * sin + axis[2] * axisDot * oneMinusCos,
  ];
}

function cross(a: PrimitivePosition, b: PrimitivePosition): PrimitivePosition {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(a: PrimitivePosition, b: PrimitivePosition): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
