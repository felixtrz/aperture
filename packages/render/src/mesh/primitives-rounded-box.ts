import type { MeshAsset, RoundedBoxMeshOptions } from "./types.js";
import {
  boundsFromPositions,
  clampInteger,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";

interface RoundedBoxFace {
  /** Axis (0=x, 1=y, 2=z) the face normal points along. */
  readonly w: 0 | 1 | 2;
  /** Sign of the face normal along `w`. */
  readonly s: 1 | -1;
  /** In-plane axis mapped to the grid's u parameter. */
  readonly u: 0 | 1 | 2;
  /** In-plane axis mapped to the grid's v parameter. */
  readonly v: 0 | 1 | 2;
}

// The (u, v, w) triple of each face is an even permutation of (0, 1, 2), so
// e_u x e_v = e_w and the outward winding is decided purely by the face sign.
const FACES: readonly RoundedBoxFace[] = [
  { w: 0, s: 1, u: 1, v: 2 },
  { w: 0, s: -1, u: 1, v: 2 },
  { w: 1, s: 1, u: 2, v: 0 },
  { w: 1, s: -1, u: 2, v: 0 },
  { w: 2, s: 1, u: 0, v: 1 },
  { w: 2, s: -1, u: 0, v: 1 },
];

/**
 * Rounded box built by mapping a subdivided cube onto the rounded surface: for
 * each cube-grid vertex the nearest point on the inner box `q` and the outward
 * unit normal `n = normalize(pOuter - q)` give the exact surface point
 * `q + radius * n`. Flat faces stay flat, edges become quarter-cylinders and
 * corners become sphere octants, all with exact per-vertex normals.
 */
export function createRoundedBoxMeshAsset(
  options: RoundedBoxMeshOptions = {},
): MeshAsset {
  const width = positiveFinite(options.width, 1);
  const height = positiveFinite(options.height, 1);
  const depth = positiveFinite(options.depth, 1);
  const segments = clampInteger(options.segments ?? 4, 1, 64);
  const maxRadius = Math.min(width, height, depth) * 0.5;
  const radius = Math.min(
    positiveFinite(options.radius, Math.min(0.1, maxRadius)),
    maxRadius,
  );
  const half: PrimitivePosition = [width * 0.5, height * 0.5, depth * 0.5];
  const inner: PrimitivePosition = [
    half[0] - radius,
    half[1] - radius,
    half[2] - radius,
  ];
  const vertices: PrimitiveVertex[] = [];
  const positions: PrimitivePosition[] = [];
  const indices: number[] = [];

  for (const face of FACES) {
    const base = vertices.length;

    for (let iv = 0; iv <= segments; iv += 1) {
      for (let iu = 0; iu <= segments; iu += 1) {
        const cube: [number, number, number] = [0, 0, 0];
        cube[face.w] = face.s;
        cube[face.u] = (iu / segments) * 2 - 1;
        cube[face.v] = (iv / segments) * 2 - 1;

        const outer: [number, number, number] = [
          cube[0] * half[0],
          cube[1] * half[1],
          cube[2] * half[2],
        ];
        const anchor: [number, number, number] = [
          clampAbs(outer[0], inner[0]),
          clampAbs(outer[1], inner[1]),
          clampAbs(outer[2], inner[2]),
        ];
        const dx = outer[0] - anchor[0];
        const dy = outer[1] - anchor[1];
        const dz = outer[2] - anchor[2];
        const length = Math.hypot(dx, dy, dz) || 1;
        const normal: PrimitivePosition = [
          dx / length,
          dy / length,
          dz / length,
        ];
        const position: PrimitivePosition = [
          anchor[0] + radius * normal[0],
          anchor[1] + radius * normal[1],
          anchor[2] + radius * normal[2],
        ];

        vertices.push({
          position,
          normal,
          uv: [iu / segments, iv / segments],
        });
        positions.push(position);
      }
    }

    const stride = segments + 1;

    for (let iv = 0; iv < segments; iv += 1) {
      for (let iu = 0; iu < segments; iu += 1) {
        const a = base + iv * stride + iu;
        const b = a + 1;
        const c = a + stride + 1;
        const d = a + stride;

        if (face.s > 0) {
          indices.push(a, b, c, a, c, d);
        } else {
          indices.push(a, c, b, a, d, c);
        }
      }
    }
  }

  const bounds = boundsFromPositions(positions);

  return createPrimitiveMeshAsset({
    label: options.label ?? "RoundedBox",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  });
}

function clampAbs(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}
