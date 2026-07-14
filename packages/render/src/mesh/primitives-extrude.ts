import type {
  ExtrudeMeshOptions,
  MeshAsset,
  ShapeOutlinePoint,
} from "./types.js";
import {
  boundsFromPositions,
  createPrimitiveMeshAsset,
  interleavePrimitiveVertexList,
  normalize,
  positiveFinite,
  type PrimitivePosition,
  type PrimitiveVertex,
} from "./primitives-builders.js";
import { triangulateShape } from "./triangulate.js";

/**
 * Straight-depth extrude (three.js `ExtrudeGeometry`, sans bevel). The `shape`
 * outline (and any `holes`) is triangulated in-house (ear clipping) into a front
 * cap at `+depth/2` facing `+Z` and a back cap at `-depth/2` facing `-Z`, then a
 * flat-shaded side wall is stitched around every contour with outward normals.
 * Caps carry `+Z`/`-Z` normals; wall normals are the in-plane edge normals.
 */
export function createExtrudeMeshAsset(options: ExtrudeMeshOptions): MeshAsset {
  const depth = positiveFinite(options.depth, 1);
  const halfDepth = depth * 0.5;
  const shape = options.shape;
  const holes = options.holes ?? [];
  const vertices: PrimitiveVertex[] = [];
  const positions: PrimitivePosition[] = [];
  const indices: number[] = [];

  // Caps: one triangulation shared by both faces. Points are emitted in the
  // caller's order so `triangulateShape`'s indices (into `[...shape, ...holes]`)
  // address them directly; the back cap reverses each triangle.
  const capTriangles = triangulateShape(shape, holes);
  const capPoints: ShapeOutlinePoint[] = [...shape, ...holes.flat()];

  const frontBase = vertices.length;
  for (const point of capPoints) {
    pushCapVertex(vertices, positions, point, halfDepth, [0, 0, 1]);
  }
  for (const triangle of capTriangles) {
    indices.push(
      frontBase + (triangle[0] ?? 0),
      frontBase + (triangle[1] ?? 0),
      frontBase + (triangle[2] ?? 0),
    );
  }

  const backBase = vertices.length;
  for (const point of capPoints) {
    pushCapVertex(vertices, positions, point, -halfDepth, [0, 0, -1]);
  }
  for (const triangle of capTriangles) {
    indices.push(
      backBase + (triangle[2] ?? 0),
      backBase + (triangle[1] ?? 0),
      backBase + (triangle[0] ?? 0),
    );
  }

  // Walls: the outline is oriented CCW and holes CW so the shared edge-normal
  // formula `(dy, -dx)` points out of the solid for both.
  const contours = [
    orientContour(shape, true),
    ...holes.map((hole) => orientContour(hole, false)),
  ];

  for (const contour of contours) {
    appendWall(contour, halfDepth, vertices, positions, indices);
  }

  const bounds = boundsFromPositions(positions);

  return createPrimitiveMeshAsset({
    label: options.label ?? "Extrude",
    vertices: interleavePrimitiveVertexList(vertices),
    vertexCount: vertices.length,
    indices: new Uint16Array(indices),
    localAabb: bounds.aabb,
    localSphere: bounds.sphere,
  });
}

function pushCapVertex(
  vertices: PrimitiveVertex[],
  positions: PrimitivePosition[],
  point: ShapeOutlinePoint,
  z: number,
  normal: PrimitivePosition,
): void {
  const position: PrimitivePosition = [point[0], point[1], z];

  vertices.push({ position, normal, uv: [point[0], point[1]] });
  positions.push(position);
}

function appendWall(
  contour: readonly ShapeOutlinePoint[],
  halfDepth: number,
  vertices: PrimitiveVertex[],
  positions: PrimitivePosition[],
  indices: number[],
): void {
  const count = contour.length;

  for (let edge = 0; edge < count; edge += 1) {
    const a = contour[edge] as ShapeOutlinePoint;
    const b = contour[(edge + 1) % count] as ShapeOutlinePoint;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];

    if (dx === 0 && dy === 0) {
      continue;
    }

    const normal = normalize([dy, -dx, 0]);
    const uA = edge / count;
    const uB = (edge + 1) / count;
    const base = vertices.length;
    const wall: readonly (readonly [PrimitivePosition, [number, number]])[] = [
      [
        [a[0], a[1], halfDepth],
        [uA, 1],
      ],
      [
        [a[0], a[1], -halfDepth],
        [uA, 0],
      ],
      [
        [b[0], b[1], -halfDepth],
        [uB, 0],
      ],
      [
        [b[0], b[1], halfDepth],
        [uB, 1],
      ],
    ];

    for (const [position, uv] of wall) {
      vertices.push({ position, normal, uv });
      positions.push(position);
    }

    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// Returns a copy of `contour` oriented CCW when `ccw`, else CW (matching the
// wall-normal convention). Winding is decided by the shoelace sign.
function orientContour(
  contour: readonly ShapeOutlinePoint[],
  ccw: boolean,
): readonly ShapeOutlinePoint[] {
  const isCcw = shoelace(contour) > 0;

  return isCcw === ccw ? contour : [...contour].reverse();
}

function shoelace(contour: readonly ShapeOutlinePoint[]): number {
  let sum = 0;

  for (let i = 0, j = contour.length - 1; i < contour.length; j = i, i += 1) {
    const a = contour[j] as ShapeOutlinePoint;
    const b = contour[i] as ShapeOutlinePoint;
    sum += (a[0] - b[0]) * (b[1] + a[1]);
  }

  return sum;
}
